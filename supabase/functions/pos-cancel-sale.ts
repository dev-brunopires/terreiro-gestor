// supabase/functions/pos-cancel-sale/index.ts
// Cancela uma venda, repõe estoque e registra movimentações de entrada.
// Requer: DATABASE_URL (ou SUPABASE_DB_URL/POSTGRES_URL)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import postgres from "npm:postgres@3.4.4";
class HttpError extends Error {
  status;
  constructor(status, msg){
    super(msg);
    this.status = status;
  }
}
const json = (payload, status = 200)=>new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
const dbURL = Deno.env.get("DATABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("POSTGRES_URL") || "";
const sql = postgres(dbURL, {
  ssl: "require",
  max: 3
});
serve(async (req)=>{
  try {
    if (req.method !== "POST") return json({
      error: "Method not allowed"
    }, 405);
    const body = await req.json();
    if (!body?.venda_id) throw new HttpError(400, "venda_id obrigatório");
    if (!body?.org_id) throw new HttpError(400, "org_id obrigatório");
    const result = await sql.begin(async (trx)=>{
      // Lock da venda
      const [venda] = await trx`
        SELECT id, org_id, terreiro_id, status, observacoes, created_at
        FROM public.vendas
        WHERE id = ${body.venda_id}
        FOR UPDATE
      `;
      if (!venda) throw new HttpError(404, "Venda não encontrada");
      if (String(venda.org_id) !== String(body.org_id)) {
        throw new HttpError(403, "Venda pertence a outra organização");
      }
      if (venda.status === "cancelada") {
        return {
          venda_id: venda.id,
          already_cancelled: true
        };
      }
      // Itens da venda
      const itens = await trx`
        SELECT produto_id, quantidade
        FROM public.itens_venda
        WHERE venda_id = ${venda.id}
        FOR UPDATE
      `;
      // Repor estoque de cada produto
      for (const it of itens){
        // Lock produto
        const [prod] = await trx`
          SELECT id FROM public.produtos
          WHERE id = ${it.produto_id}
          FOR UPDATE
        `;
        if (!prod) continue;
        await trx`
          UPDATE public.produtos
          SET estoque_atual = estoque_atual + ${it.quantidade}, updated_at = now()
          WHERE id = ${it.produto_id}
        `;
        // Movimentação de entrada (estorno)
        await trx`
          INSERT INTO public.movimentacoes_estoque
            (produto_id, quantidade, tipo, referencia, venda_id, terreiro_id, org_id)
          VALUES
            (${it.produto_id}, ${it.quantidade}, ${"entrada"}, ${"CANCEL"}, ${venda.id}, ${venda.terreiro_id}, ${venda.org_id})
        `;
      }
      // Atualiza status e observações
      const novoObs = `[CANCEL ${new Date().toISOString()}${body.usuario_operacao ? " by " + body.usuario_operacao : ""}${body.motivo ? " - " + body.motivo : ""}]` + (venda.observacoes ? `\n${venda.observacoes}` : "");
      await trx`
        UPDATE public.vendas
        SET status = ${"cancelada"}, observacoes = ${novoObs}
        WHERE id = ${venda.id}
      `;
      return {
        venda_id: venda.id,
        cancelled: true
      };
    });
    return json({
      ok: true,
      ...result
    }, 200);
  } catch (err) {
    if (err instanceof HttpError) return json({
      error: err.message
    }, err.status);
    console.error("[pos-cancel-sale] erro:", err);
    return json({
      error: "Erro interno"
    }, 500);
  }
});
