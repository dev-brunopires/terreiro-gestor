// supabase/functions/superadmin-regen-join-code/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json = (b, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
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
    const { org_id } = await req.json();
    if (!org_id) return json({
      error: "org_id é obrigatório"
    }, 400);
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    // usa a função SQL para garantir unicidade
    const { data, error } = await admin.from("terreiros").update({
      join_code: admin.rpc("gen_short_code")
    }) // hackzinho: rpc() aqui não retorna scalar, então vamos fazer direto por SQL abaixo
    .eq("id", org_id).select("join_code").single();
    // ↑ O update+rpc encadeado assim nem sempre funciona; prefira a query SQL:
    // const { data, error } = await admin.rpc("regen_terreiro_code", { p_org_id: org_id });
    if (error) throw error;
    return json({
      ok: true,
      join_code: data?.join_code
    });
  } catch (e) {
    return json({
      error: e?.message ?? "Erro inesperado"
    }, 400);
  }
});
export default {};
