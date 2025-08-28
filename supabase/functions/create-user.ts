// deno run -A npm:serve
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== Helpers =====
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const ROLES: Array<"owner" | "admin" | "viewer" | "financeiro" | "operador"> = [
  "owner",
  "admin",
  "viewer",
  "financeiro",
  "operador",
];

const normalizeRole = (r: unknown) => {
  const v = String(r ?? "viewer").toLowerCase();
  return (ROLES as string[]).includes(v) ? (v as (typeof ROLES)[number]) : "viewer";
};

const isValidEmail = (email?: string | null) => !!email && /\S+@\S+\.\S+/.test(email);

// listUsers não filtra por e-mail; pagina e compara localmente
async function findUserIdByEmailPaged(
  supa: ReturnType<typeof createClient>,
  email: string,
) {
  let page = 1;
  const perPage = 200;
  const target = email.toLowerCase();

  for (let i = 0; i < 30; i++) {
    const { data, error } = await supa.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data?.users?.find((u) => (u.email ?? "").toLowerCase() === target);
    if (found) return found.id;
    if (!data?.users?.length) break; // acabou
    page += 1;
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    // CORS
    if (req.method === "OPTIONS") return json({ ok: true });

    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    // IMPORTANTE: service role puro (sem Authorization do usuário para não acionar RLS)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Body
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const org_id: string | null = payload.org_id ?? null;
    const membro_id: string | null = payload.membro_id ?? null;
    const role = normalizeRole(payload.role);
    const providedPassword = String(payload.password ?? "");
    const password =
      providedPassword.length >= 8 ? providedPassword : "Trocar123!"; // mínimo 8 no seu front
    let email = String(payload.email ?? "").trim().toLowerCase();
    let nome: string | null = payload.nome ?? null;

    if (!org_id) return json({ error: "org_id é obrigatório" }, 400);

    // 1) Valida org existente
    {
      const { data, error } = await admin
        .from("terreiros")
        .select("id")
        .eq("id", org_id)
        .maybeSingle();
      if (error) return json({ error: `Erro ao validar org_id: ${error.message}` }, 400);
      if (!data) return json({ error: "org_id inexistente" }, 400);
    }

    // 2) Completa dados com membro (se informado)
    if (membro_id) {
      const { data: mem, error: memErr } = await admin
        .from("membros")
        .select("id, nome, email, org_id, terreiro_id")
        .eq("id", membro_id)
        .maybeSingle();
      if (memErr) return json({ error: `Erro ao validar membro_id: ${memErr.message}` }, 400);
      if (!mem) return json({ error: "membro_id inexistente" }, 400);

      // (opcional) garantir que o membro pertence à org
      if (mem.org_id !== org_id && mem.terreiro_id !== org_id) {
        return json({ error: "membro_id não pertence a esta organização" }, 400);
      }

      if (!email) email = String(mem.email ?? "").trim().toLowerCase();
      if (!nome && mem?.nome) nome = mem.nome;
    }

    if (!isValidEmail(email)) {
      return json({ error: "E-mail inválido" }, 400);
    }

    // 3) Cria ou reaproveita usuário do Auth
    let user_id: string | null = null;
    let createdNow = false;
    const createRes = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: nome ? { nome } : {},
      app_metadata: { created_by: "edge.create-user" },
    });

    if (createRes.error) {
      const already =
        createRes.error.status === 422 ||
        /already registered|User already registered|duplicate key/i.test(
          createRes.error.message,
        );
      if (!already) {
        return json({ error: `Falha ao criar auth user: ${createRes.error.message}` }, 400);
      }
      // já existe → localizar id
      try {
        const uid = await findUserIdByEmailPaged(admin, email);
        if (!uid) {
          return json(
            {
              error:
                "Usuário já existe no Auth, mas não foi possível localizá-lo via Admin API.",
              detail:
                "Verifique confirmação de e-mail e permissões do Service Role.",
            },
            400,
          );
        }
        user_id = uid;
        // best-effort: atualizar metadata
        if (nome) {
          try {
            await admin.auth.admin.updateUserById(uid, { user_metadata: { nome } });
          } catch {
            /* ignore */
          }
        }
      } catch (scanErr: any) {
        return json(
          { error: `Falha ao varrer usuários por e-mail: ${scanErr?.message ?? scanErr}` },
          400,
        );
      }
    } else {
      user_id = createRes.data.user?.id ?? null;
      createdNow = true;
    }

    if (!user_id) return json({ error: "Auth user sem id" }, 500);

    // 4) Policy de "uma org por usuário"
    //   - profiles tem user_id UNIQUE no seu schema → só pode haver 1 linha por user_id
    //   - se já existir profile com outra org, bloqueia
    const { data: existingProfile, error: profErr } = await admin
      .from("profiles")
      .select("user_id, org_id, role, approved, paused, must_reset_password, membro_id, nome")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profErr) return json({ error: `Erro ao consultar profiles: ${profErr.message}` }, 400);

    // Monta linha base de profile
    const profileRow: any = {
      user_id,
      org_id,
      role,
      nome: nome ?? null,
      approved: true,             // importante p/ RLS
      paused: false,
      must_reset_password: true,  // usuário deve trocar a senha no 1º login
      membro_id: membro_id ?? null,
    };

    if (existingProfile) {
      if (existingProfile.org_id !== org_id) {
        // Não permitir mover de org diferente
        if (createdNow) {
          try {
            await admin.auth.admin.deleteUser(user_id);
          } catch { /* ignore */ }
        }
        return json(
          {
            error: "user_already_in_other_org",
            message:
              "Este e-mail já está vinculado a outra organização. Um usuário só pode pertencer a uma org.",
          },
          409,
        );
      }

      // Mesmo user & mesma org → atualiza dados (mantendo approved=true)
      const { error: updErr } = await admin
        .from("profiles")
        .update(profileRow)
        .eq("user_id", user_id)
        .eq("org_id", org_id);
      if (updErr) {
        if (createdNow) {
          try { await admin.auth.admin.deleteUser(user_id); } catch {}
        }
        return json({ error: `Falha ao atualizar profile: ${updErr.message}` }, 400);
      }
    } else {
      // Não existe profile → insere
      const { error: insErr } = await admin
        .from("profiles")
        .insert(profileRow);
      if (insErr) {
        if (createdNow) {
          try { await admin.auth.admin.deleteUser(user_id); } catch {}
        }
        // conflito em user_id (se já tivesse em outra org) também cai aqui
        return json({ error: `Falha ao criar profile: ${insErr.message}` }, 400);
      }
    }

    return json({
      ok: true,
      message: createdNow
        ? "Usuário criado e perfil vinculado"
        : "Usuário existente vinculado/atualizado na organização",
      user_id,
      email,
      org_id,
      role,
      default_password_used: providedPassword.length < 8,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Erro inesperado (create-user)" }, 500);
  }
});

export default {};
