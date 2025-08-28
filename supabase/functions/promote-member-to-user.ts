import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json = (body, status = 200)=>new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin"
    }
  });
function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Env faltando: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: {
      persistSession: false
    }
  });
}
const ALLOWED = new Set([
  "viewer",
  "admin",
  "owner",
  "operador",
  "financeiro"
]);
const isValidEmail = (s)=>!!s && /\S+@\S+\.\S+/.test(s);
async function findUserIdByEmailPaged(supa, email) {
  let page = 1;
  const perPage = 200;
  for(let i = 0; i < 30; i++){
    const { data, error } = await supa.auth.admin.listUsers({
      page,
      perPage
    });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data?.users?.find((u)=>(u.email ?? "").toLowerCase() === email);
    if (found) return found.id;
    if (!data?.users?.length) break;
    page += 1;
  }
  return null;
}
Deno.serve(async (req)=>{
  try {
    if (req.method === "OPTIONS") return json({
      ok: true
    });
    if (req.method !== "POST") return json({
      error: "Method not allowed"
    }, 405);
    const supa = getAdmin();
    let body = {};
    try {
      body = await req.json();
    } catch  {
      return json({
        error: "JSON inválido"
      }, 400);
    }
    const membro_id = body?.membro_id;
    const org_id = body?.org_id;
    let role = String(body?.role ?? "viewer").toLowerCase();
    if (!membro_id || !org_id) return json({
      error: "membro_id e org_id são obrigatórios"
    }, 400);
    if (!ALLOWED.has(role)) role = "viewer";
    // pega membro (nome/email)
    const { data: mem, error: e0 } = await supa.from("membros").select("id, nome, email").eq("id", membro_id).maybeSingle();
    if (e0) return json({
      error: `membros: ${e0.message}`
    }, 400);
    if (!mem) return json({
      error: "Membro inexistente"
    }, 400);
    const email = String(mem.email ?? "").trim().toLowerCase();
    if (!isValidEmail(email)) return json({
      error: "Membro sem e-mail válido"
    }, 400);
    // (opcional) valida org existir
    const { data: terr, error: eOrg } = await supa.from("terreiros").select("id").eq("id", org_id).maybeSingle();
    if (eOrg) return json({
      error: `terreiros: ${eOrg.message}`
    }, 400);
    if (!terr) return json({
      error: "org_id inexistente"
    }, 400);
    // cria/acha usuário
    let user_id = await findUserIdByEmailPaged(supa, email);
    let createdNow = false;
    if (!user_id) {
      const { data: created, error: cErr } = await supa.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: mem?.nome ? {
          nome: mem.nome
        } : {},
        app_metadata: {
          source: "edge.promote-member-to-user"
        }
      });
      if (cErr) {
        // se foi "already registered", tenta varrer de novo
        const already = cErr.status === 422 || /already registered|duplicate/i.test(cErr.message);
        if (!already) return json({
          error: `createUser: ${cErr.message}`
        }, 400);
        user_id = await findUserIdByEmailPaged(supa, email);
      } else {
        user_id = created?.user?.id ?? null;
        createdNow = !!user_id;
      }
    }
    if (!user_id) return json({
      error: "Falha ao obter user_id"
    }, 500);
    // upsert em profiles (PK = user_id) — detectar colunas opcionais
    const probe = await supa.from("profiles").select("*").limit(1);
    const sample = Array.isArray(probe.data) && probe.data[0] ? probe.data[0] : {};
    const hasMustReset = Object.prototype.hasOwnProperty.call(sample, "must_reset_password");
    const hasPaused = Object.prototype.hasOwnProperty.call(sample, "paused");
    const hasMembroId = Object.prototype.hasOwnProperty.call(sample, "membro_id");
    const profileRow = {
      user_id,
      org_id,
      role,
      nome: mem?.nome ?? null
    };
    if (hasMembroId) profileRow.membro_id = membro_id;
    if (hasMustReset) profileRow.must_reset_password = true;
    if (hasPaused) profileRow.paused = false;
    const { error: upErr } = await supa.from("profiles").upsert(profileRow); // <- sem onConflict
    if (upErr) {
      if (createdNow) {
        try {
          await supa.auth.admin.deleteUser(user_id);
        } catch  {}
      }
      return json({
        error: `profiles.upsert: ${upErr.message}`
      }, 400);
    }
    return json({
      ok: true,
      user_id,
      email,
      role
    }, 200);
  } catch (e) {
    return json({
      error: e?.message ?? "Erro inesperado"
    }, 500);
  }
});
export default {};
