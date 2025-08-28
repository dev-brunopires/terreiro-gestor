// supabase/functions/pos-create-sale/index.ts
// Deno + postgres (transação) — cria venda, itens e baixa estoque.
// Requer variáveis de ambiente: DATABASE_URL (ou SUPABASE_DB_URL), opcional LOG_LEVEL.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import postgres from "npm:postgres@3.4.4";
const LOG = (level, ...args)=>{
  const allow = Deno.env.get("LOG_LEVEL") ?? "info";
  const order = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
  };
  if (order[level] >= order[allow]) {
    console[level === "error" ? "error" : level === "warn" ? "warn" : "log"]("[pos-create-sale]", ...args);
  }
};
const dbURL = Deno.env.get("DATABASE_URL") || Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("POSTGRES_URL") || "";
if (!dbURL) {
  console.error("[pos-create-sale] Missing DATABASE_URL / SUPABASE_DB_URL / POSTGRES_URL env.");
}
const sql = postgres(dbURL, {
  ssl: "require",
  max: 3
});
serve(async (req)=>{
  try {
    if (req.method !== "POST") {
      return json({
        error: "Method not allowed"
      }, 405);
    }
    const body = await req.json();
    validatePayload(body);
    const result = await sql.begin(async (trx)=>{
      // 1) (Opcional) validar org/terreiro existem
      const [orgRow] = await trx`
        SELECT id FROM public.terreiros WHERE id = ${body.org_id} LIMIT 1
      `;
      if (!orgRow) throw new HttpError(400, "org_id inválido");
      // 2) (Opcional) validar membro se enviado
      if (body.membro_id) {
        const [m] = await trx`
          SELECT id FROM public.membros WHERE id = ${body.membro_id} AND (org_id = ${body.org_id} OR terreiro_id = ${body.org_id})
          LIMIT 1
        `;
        if (!m) throw new HttpError(400, "membro_id inválido ou de outra organização");
      }
      // 3) Validar/atualizar itens e estoque (lock por produto)
      let subtotalCalc = 0;
      for (const it of body.itens){
        // Lock do produto
        const [prod] = await trx`
          SELECT id, preco_centavos, estoque_atual, ativo
          FROM public.produtos
          WHERE id = ${it.produto_id}
          FOR UPDATE
        `;
        if (!prod) throw new HttpError(400, `Produto ${it.produto_id} inexistente`);
        if (prod.ativo === false) throw new HttpError(400, `Produto ${it.produto_id} inativo`);
        const preco = Number(prod.preco_centavos ?? 0);
        const qtt = Number(it.quantidade ?? 0);
        if (!Number.isInteger(qtt) || qtt <= 0) throw new HttpError(400, "Quantidade inválida");
        const total = preco * qtt;
        subtotalCalc += total;
        // Estoque: impede negativo
        const estoqueAtual = Number(prod.estoque_atual ?? 0);
        if (estoqueAtual < qtt) {
          throw new HttpError(409, `Estoque insuficiente para o produto ${prod.id}. Disponível: ${estoqueAtual}, solicitado: ${qtt}`);
        }
        // Atualiza estoque
        await trx`
          UPDATE public.produtos
          SET estoque_atual = estoque_atual - ${qtt}, updated_at = now()
          WHERE id = ${it.produto_id}
        `;
      }
      // 4) Validar totais enviados vs calculados
      if (subtotalCalc !== Number(body.subtotal_centavos)) {
        LOG("warn", "Subtotal divergente. usando subtotal calculado", {
          enviado: body.subtotal_centavos,
          calculado: subtotalCalc
        });
      }
      const desconto = Math.max(0, Number(body.desconto_centavos ?? 0));
      const totalCalc = Math.max(0, subtotalCalc - desconto);
      if (totalCalc !== Number(body.total_centavos)) {
        LOG("warn", "Total divergente. usando total calculado", {
          enviado: body.total_centavos,
          calculado: totalCalc
        });
      }
      const pago = Number(body.pago_centavos ?? 0);
      if (pago < totalCalc) {
        throw new HttpError(400, `Pagamento insuficiente. Falta ${totalCalc - pago} centavos`);
      }
      const troco = Math.max(0, pago - totalCalc);
      // 5) Criar venda
      const [venda] = await trx`
        INSERT INTO public.vendas
          (membro_id, status, subtotal_centavos, desconto_centavos, total_centavos, pago_centavos, troco_centavos,
           metodo_pagamento, observacoes, terreiro_id, org_id, usuario_operacao)
        VALUES
          (${body.membro_id ?? null}, ${"concluida"}, ${subtotalCalc}, ${desconto}, ${totalCalc}, ${pago}, ${troco},
           ${body.metodo_pagamento ?? null}, ${body.observacoes ?? null}, ${body.terreiro_id}, ${body.org_id}, ${body.usuario_operacao ?? "edge"})
        RETURNING id
      `;
      const vendaId = venda.id;
      // 6) Inserir itens + movimentação
      for (const it of body.itens){
        // Buscar preço do produto novamente para consistência
        const [prod] = await trx`
          SELECT id, preco_centavos
          FROM public.produtos
          WHERE id = ${it.produto_id}
        `;
        const preco = Number(prod.preco_centavos ?? 0);
        const qtt = Number(it.quantidade ?? 0);
        const total = preco * qtt;
        await trx`
          INSERT INTO public.itens_venda
            (venda_id, produto_id, quantidade, preco_centavos, total_centavos)
          VALUES
            (${vendaId}, ${it.produto_id}, ${qtt}, ${preco}, ${total})
        `;
        await trx`
          INSERT INTO public.movimentacoes_estoque
            (produto_id, quantidade, tipo, referencia, venda_id, terreiro_id, org_id)
          VALUES
            (${it.produto_id}, ${qtt}, ${"saida"}, ${"PDV"}, ${vendaId}, ${body.terreiro_id}, ${body.org_id})
        `;
      }
      return {
        venda_id: vendaId,
        total_centavos: totalCalc,
        troco_centavos: troco
      };
    });
    return json({
      ok: true,
      ...result
    }, 200);
  } catch (err) {
    LOG("error", "Erro geral", err);
    if (err instanceof HttpError) {
      return json({
        error: err.message
      }, err.status);
    }
    return json({
      error: "Erro interno"
    }, 500);
  }
});
function validatePayload(p) {
  if (!p?.org_id) throw new HttpError(400, "org_id obrigatório");
  if (!p?.terreiro_id) throw new HttpError(400, "terreiro_id obrigatório");
  if (!Array.isArray(p?.itens) || p.itens.length === 0) {
    throw new HttpError(400, "itens obrigatórios");
  }
  for (const it of p.itens){
    if (!it.produto_id) throw new HttpError(400, "produto_id obrigatório");
    if (!Number.isInteger(it.quantidade) || it.quantidade <= 0) throw new HttpError(400, "quantidade inválida");
  }
}
class HttpError extends Error {
  status;
  constructor(status, msg){
    super(msg);
    this.status = status;
  }
}
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
