// deno run -A npm:serve
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
  try {
    if (req.method === "OPTIONS") return json({
      ok: true
    });
    if (req.method !== "POST") return json({
      error: "Method not allowed"
    }, 405);
    const { plan_id } = await req.json();
    if (!plan_id) return json({
      error: "plan_id é obrigatório"
    }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    // apaga features
    await admin.from("saas_plan_features").delete().eq("plan_id", plan_id);
    // (opcional) checar contratos ativos e bloquear a exclusão
    const { count } = await admin.from("saas_org_contracts").select("id", {
      count: "exact",
      head: true
    }).eq("plan_id", plan_id);
    if ((count ?? 0) > 0) {
      return json({
        error: "Não é possível excluir: existem contratos usando este plano."
      }, 400);
    }
    const { error } = await admin.from("saas_plans").delete().eq("id", plan_id);
    if (error) throw error;
    return json({
      ok: true
    });
  } catch (e) {
    return json({
      error: e?.message ?? "Erro inesperado"
    }, 400);
  }
});
export default {};
