// supabase/functions/admin-create-terreiro/index.ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const ALLOW = [
  "brunopdlaj@gmail.com"
]; // mesma allowlist do front
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
serve(async (req)=>{
  try {
    // 1) autentica o chamador
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""; // opcional
    const authClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || ""
        }
      }
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({
      error: "Unauthorized"
    }, 401);
    const email = (userData.user.email || "").toLowerCase();
    if (!ALLOW.map((e)=>e.toLowerCase()).includes(email)) {
      return json({
        error: "Forbidden (not a superadmin)"
      }, 403);
    }
    // 2) client SERVICE ROLE para bypass RLS
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(()=>({}));
    const method = body?.method || "POST";
    const nome = (body?.nome || "").trim();
    const id = body?.id || undefined;
    if (!nome) return json({
      error: "Nome obrigatório"
    }, 400);
    if (method === "PATCH") {
      if (!id) return json({
        error: "ID obrigatório para PATCH"
      }, 400);
      const { error } = await admin.from("terreiros").update({
        nome
      }).eq("id", id);
      if (error) return json({
        error: error.message
      }, 500);
      return json({
        ok: true,
        id,
        nome
      });
    }
    // POST → cria terreiro
    const { data, error } = await admin.from("terreiros").insert({
      nome
    }).select("id, nome").single();
    if (error) return json({
      error: error.message
    }, 500);
    return json({
      ok: true,
      terreiro: data
    });
  } catch (e) {
    return json({
      error: e?.message || "Unexpected error"
    }, 500);
  }
});
