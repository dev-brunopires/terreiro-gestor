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
    const { org_id, access_code } = await req.json();
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
    // validação simples
    let code = access_code === null ? null : String(access_code || "").trim().toUpperCase();
    if (code !== null && !/^[A-Z0-9]{4,12}$/.test(code)) {
      return json({
        error: "Código inválido. Use 4–12 caracteres alfanuméricos."
      }, 400);
    }
    // aplica
    const { data, error } = await admin.from("terreiros").update({
      access_code: code
    }).eq("id", org_id).select("id, nome, access_code").single();
    if (error) throw error;
    return json({
      ok: true,
      terreiro: data
    });
  } catch (e) {
    return json({
      error: e?.message ?? "Erro inesperado"
    }, 400);
  }
});
export default {};
