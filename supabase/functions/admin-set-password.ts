// supabase/functions/admin-set-password/index.ts
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
    const { email, user_id, new_password } = await req.json();
    if (!new_password) return json({
      error: "new_password é obrigatório"
    }, 400);
    const supa = admin();
    let uid = user_id;
    if (!uid && email) {
      const list = await supa.auth.admin.listUsers({
        page: 1,
        perPage: 1,
        email
      });
      uid = list.data.users?.[0]?.id;
    }
    if (!uid) return json({
      error: "Informe email ou user_id"
    }, 400);
    const upd = await supa.auth.admin.updateUserById(uid, {
      password: new_password
    });
    if (upd.error) return json({
      error: upd.error.message
    }, 400);
    return json({
      ok: true,
      user_id: uid
    });
  } catch (e) {
    return json({
      error: e?.message ?? "Erro inesperado"
    }, 400);
  }
});
export default {};
