// deno run -A npm:serve
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin"
};
const json = (b, s = 200)=>new Response(JSON.stringify(b), {
    status: s,
    headers: corsHeaders
  });
const isValidEmail = (e)=>!!e && /\S+@\S+\.\S+/.test(e);
async function findUserIdByEmailPaged(supa, email) {
  let page = 1;
  const perPage = 200;
  const target = email.toLowerCase();
  for(let i = 0; i < 30; i++){
    const { data, error } = await supa.auth.admin.listUsers({
      page,
      perPage
    });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data?.users?.find((u)=>(u.email ?? "").toLowerCase() === target);
    if (found) return found.id;
    if (!data?.users?.length) break;
    page++;
  }
  return null;
}
Deno.serve(async (req)=>{
  const t0 = Date.now();
  try {
    if (req.method === "OPTIONS") return json({
      ok: true
    });
    if (req.method !== "POST") return json({
      error: "Method not allowed"
    }, 405);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({
      error: "Missing env"
    }, 500);
    // service role puro (não encaminha Authorization do usuário → evita RLS)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false
      }
    });
    let payload;
    try {
      payload = await req.json();
    } catch  {
      return json({
        error: "Invalid JSON body"
      }, 400);
    }
    const org_id = payload.org_id ?? null;
    const email = String(payload.email ?? "").trim().toLowerCase();
    const nome = payload.nome ?? null;
    const password = String(payload.password ?? "Trocar123!"); // default opcional
    console.log("[OWNER] payload:", {
      org_id,
      email,
      hasNome: !!nome
    });
    if (!org_id) return json({
      error: "org_id é obrigatório"
    }, 400);
    if (!isValidEmail(email)) return json({
      error: "E-mail inválido"
    }, 400);
    // 1) org existe?
    {
      const { data, error } = await admin.from("terreiros").select("id").eq("id", org_id).maybeSingle();
      if (error) return json({
        error: `Erro ao validar org: ${error.message}`
      }, 400);
      if (!data) return json({
        error: "org_id inexistente"
      }, 400);
    }
    console.log("[OWNER] org validada:", org_id);
    // 2) criar ou localizar usuário no Auth
    let user_id = null;
    let createdNow = false;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: nome ? {
        nome
      } : {},
      app_metadata: {
        created_by: "edge.superadmin-set-owner"
      }
    });
    if (created.error) {
      const already = created.error.status === 422 || /already registered|User already registered|duplicate key/i.test(created.error.message);
      if (!already) return json({
        error: `Falha ao criar auth user: ${created.error.message}`
      }, 400);
      const uid = await findUserIdByEmailPaged(admin, email);
      if (!uid) return json({
        error: "Usuário já existe mas não foi localizado via Admin API"
      }, 400);
      user_id = uid;
      if (nome) {
        try {
          await admin.auth.admin.updateUserById(uid, {
            user_metadata: {
              nome
            }
          });
        } catch  {
        /* ignore */ }
      }
      console.log("[OWNER] usuário já existia no Auth:", {
        user_id
      });
    } else {
      user_id = created.data.user?.id ?? null;
      createdNow = true;
      console.log("[OWNER] usuário criado no Auth:", {
        user_id
      });
    }
    if (!user_id) return json({
      error: "Auth user sem id"
    }, 500);
    // 3) UMA ORG por usuário → verifica profiles
    const { data: existing, error: profErr } = await admin.from("profiles").select("user_id, org_id, role, approved, paused, must_reset_password, membro_id, nome").eq("user_id", user_id).maybeSingle();
    if (profErr) return json({
      error: `Erro ao consultar profiles: ${profErr.message}`
    }, 400);
    const profileRow = {
      user_id,
      org_id,
      role: "owner",
      nome: nome ?? existing?.nome ?? null,
      approved: true,
      paused: false,
      must_reset_password: true
    };
    let profile_action = "inserted";
    if (existing) {
      if (existing.org_id !== org_id) {
        if (createdNow) {
          try {
            await admin.auth.admin.deleteUser(user_id);
          } catch  {}
        }
        console.warn("[OWNER] conflito: user já pertence a outra org", {
          user_id,
          existing_org: existing.org_id,
          target_org: org_id
        });
        return json({
          error: "user_already_in_other_org",
          message: "Usuário pertence a outra organização."
        }, 409);
      }
      // mesma org → promove/garante owner
      const { error: updErr } = await admin.from("profiles").update(profileRow).eq("user_id", user_id).eq("org_id", org_id);
      if (updErr) return json({
        error: `Falha ao promover owner: ${updErr.message}`
      }, 400);
      profile_action = "updated";
      console.log("[OWNER] profile atualizado para owner:", {
        user_id,
        org_id
      });
    } else {
      const { error: insErr } = await admin.from("profiles").insert(profileRow);
      if (insErr) return json({
        error: `Falha ao criar profile owner: ${insErr.message}`
      }, 400);
      profile_action = "inserted";
      console.log("[OWNER] profile inserido como owner:", {
        user_id,
        org_id
      });
    }
    const tookMs = Date.now() - t0;
    console.log("[OWNER] DONE", {
      tookMs,
      createdNow,
      profile_action,
      user_id,
      email,
      org_id,
      role: "owner"
    });
    return json({
      ok: true,
      took_ms: tookMs,
      createdNow,
      profile_action,
      user_id,
      email,
      org_id,
      role: "owner"
    });
  } catch (e) {
    console.error("[OWNER] ERROR:", e);
    return json({
      error: e?.message ?? "Erro inesperado (superadmin-set-owner)"
    }, 500);
  }
});
export default {};
