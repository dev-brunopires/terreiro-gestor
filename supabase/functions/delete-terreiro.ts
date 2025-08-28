// supabase/functions/delete-terreiro/index.ts
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
function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: {
      persistSession: false
    }
  });
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return json({
    ok: true
  });
  if (req.method !== "POST") return json({
    error: "Method not allowed"
  }, 405);
  try {
    const { org_id } = await req.json();
    if (!org_id) return json({
      error: "org_id é obrigatório"
    }, 400);
    const db = admin();
    // --- 1) faturas -> pagamentos (considera org_id OU terreiro_id legado)
    {
      const { data: fat, error: f1 } = await db.from("faturas").select("id").or(`org_id.eq.${org_id},terreiro_id.eq.${org_id}`);
      if (f1) throw f1;
      const fatIds = (fat ?? []).map((r)=>r.id);
      if (fatIds.length) {
        const { error } = await db.from("pagamentos").delete().in("fatura_id", fatIds);
        if (error) throw error;
        const { error: eFat } = await db.from("faturas").delete().in("id", fatIds);
        if (eFat) throw eFat;
      }
    }
    // --- 2) Demais dependências (org_id/terreiro_id quando existir)
    const steps = [
      [
        "assinaturas",
        "org_id",
        org_id
      ],
      [
        "assinaturas",
        "terreiro_id",
        org_id
      ],
      [
        "membros",
        "org_id",
        org_id
      ],
      [
        "membros",
        "terreiro_id",
        org_id
      ],
      [
        "profiles",
        "org_id",
        org_id
      ],
      [
        "saas_org_contracts",
        "org_id",
        org_id
      ],
      [
        "pessoas",
        "terreiro_id",
        org_id
      ],
      [
        "pagamentos_diversos",
        "terreiro_id",
        org_id
      ],
      [
        "pagamentos_diversos_metodos",
        "terreiro_id",
        org_id
      ],
      [
        "pagamentos_diversos_tipos",
        "terreiro_id",
        org_id
      ]
    ];
    for (const [table, col, val] of steps){
      const { error } = await db.from(table).delete().eq(col, val);
      // Ignora se a tabela não existir neste ambiente
      if (error && !/does not exist/i.test(error.message)) throw error;
    }
    // --- 3) Planos da organização (planos "locais" da org)
    {
      const { data: planos, error: ePlan } = await db.from("planos").select("id").or(`org_id.eq.${org_id},terreiro_id.eq.${org_id}`);
      if (ePlan && !/does not exist/i.test(ePlan.message)) throw ePlan;
      const planoIds = (planos ?? []).map((p)=>p.id);
      if (planoIds.length) {
        // plan_features pode não existir em bancos que migraram para saas_plan_features
        const delFeatures = await db.from("plan_features").delete().in("plano_id", planoIds);
        if (delFeatures.error && !/does not exist/i.test(delFeatures.error.message)) {
          throw delFeatures.error;
        }
        const delPlanos = await db.from("planos").delete().in("id", planoIds);
        if (delPlanos.error && !/does not exist/i.test(delPlanos.error.message)) {
          throw delPlanos.error;
        }
      }
    }
    // --- 4) Por fim, o próprio terreiro
    {
      const { error: terrErr } = await db.from("terreiros").delete().eq("id", org_id);
      if (terrErr) throw terrErr;
    }
    return json({
      ok: true,
      org_id
    });
  } catch (e) {
    return json({
      error: e?.message ?? "Erro inesperado"
    }, 400);
  }
});
export default {};
