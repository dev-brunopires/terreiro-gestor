// supabase/functions/admin-send-password-reset/index.ts
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
function anon() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
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
    const { email, redirectTo } = await req.json();
    if (!email) return json({
      error: "email é obrigatório"
    }, 400);
    const supa = anon();
    const { error } = await supa.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${new URL(req.url).origin}/reset-password`
    });
    if (error) return json({
      error: error.message
    }, 400);
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
