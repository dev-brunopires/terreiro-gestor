import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json = (body, status = 200)=>new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return json({
    ok: true
  });
  if (req.method !== "POST") return json({
    error: "Method not allowed"
  }, 405);
  try {
    const body = await req.json();
    // Compatibilidade de nomes
    const id = body?.id ?? null;
    const nome = (body?.nome ?? "").trim();
    // aceita preco_centavos OU price_cents OU preco (em R$)
    let preco_centavos = typeof body?.preco_centavos === "number" ? body.preco_centavos : typeof body?.price_cents === "number" ? body.price_cents : typeof body?.preco === "number" ? Math.round(body.preco * 100) : null;
    // aceita boolean ou string "true"/"false"
    const ativo = typeof body?.ativo === "boolean" ? body.ativo : String(body?.ativo ?? "true") === "true";
    const descricao = body?.descricao != null ? String(body.descricao) : null;
    if (!nome) return json({
      error: "nome é obrigatório"
    }, 400);
    if (preco_centavos == null || isNaN(preco_centavos)) return json({
      error: "preco_centavos inválido"
    }, 400);
    if (preco_centavos < 0) return json({
      error: "preco_centavos não pode ser negativo"
    }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({
      error: "Variáveis SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes"
    }, 500);
    const admin = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    // Se veio id -> UPDATE pelo id
    if (id) {
      const { data: exists, error: selErr } = await admin.from("saas_plans").select("id").eq("id", id).maybeSingle();
      if (selErr) throw selErr;
      if (!exists) return json({
        error: "Plano não encontrado"
      }, 400);
      const { data, error } = await admin.from("saas_plans").update({
        nome,
        preco_centavos,
        ativo,
        descricao
      }).eq("id", id).select("id, nome, preco_centavos, ativo, descricao").single();
      if (error) return json({
        error: error.message
      }, 400);
      return json({
        ok: true,
        plan: data
      });
    }
    // Sem id -> INSERT. 'nome' é UNIQUE no seu schema.
    const { data, error } = await admin.from("saas_plans").insert({
      nome,
      preco_centavos,
      ativo,
      descricao
    }).select("id, nome, preco_centavos, ativo, descricao").single();
    if (error) {
      // Mensagem mais amigável para UNIQUE(nome)
      if (error.message?.toLowerCase().includes("duplicate")) {
        return json({
          error: "Já existe um plano com esse nome"
        }, 400);
      }
      return json({
        error: error.message
      }, 400);
    }
    return json({
      ok: true,
      plan: data
    });
  } catch (e) {
    return json({
      error: e?.message ?? "Erro inesperado"
    }, 400);
  }
});
export default {};
