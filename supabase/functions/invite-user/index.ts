// functions/create-user/index.ts
import "jsr:@supabase/functions-js/edge-runtime";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Role = "owner" | "admin" | "viewer" | "financeiro" | "operador";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });

export default async function handler(req: Request) {
  try {
    if (req.method === "OPTIONS") return json({ ok: true });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("ENV MISSING", { SUPABASE_URL: !!SUPABASE_URL, SERVICE_ROLE_KEY: !!SERVICE_ROLE_KEY });
      return json({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    let payload: {
      email?: string;
      password?: string;
      org_id?: string;
      role?: Role;
      nome?: string | null;
      membro_id?: string | null;
    };
    try {
      payload = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const email = (payload.email || "").trim().toLowerCase();
    const password = payload.password || "Trocar123!";
    const org_id = payload.org_id;
    const role: Role = (payload.role as Role) || "operador";
    const nome = payload.nome ?? null;
    const membro_id = payload.membro_id ?? null;

    if (!email || !/\S+@\S+\.\S+/.test(email)) return json({ error: "E-mail inválido" }, 400);
    if (!org_id) return json({ error: "org_id é obrigatório" }, 400);

    // (debug) log insumo crítico (sem senha)
    console.log("create-user: input", { email, org_id, role, hasMembro: !!membro_id });

    // 1) Verificações rápidas de FK antes de inserir (evita erro feio)
    const { data: orgRow, error: orgErr } = await admin
      .from("terreiros")
      .select("id")
      .eq("id", org_id)
      .maybeSingle();
    if (orgErr) {
      console.error("FK check terreiro failed", orgErr);
      return json({ error: `Erro ao validar org_id: ${orgErr.message}` }, 400);
    }
    if (!orgRow) return json({ error: "org_id inexistente" }, 400);

    if (membro_id) {
      const { data: memRow, error: memErr } = await admin
        .from("membros")
        .select("id")
        .eq("id", membro_id)
        .maybeSingle();
      if (memErr) {
        console.error("FK check membro failed", memErr);
        return json({ error: `Erro ao validar membro_id: ${memErr.message}` }, 400);
      }
      if (!memRow) return json({ error: "membro_id inexistente" }, 400);
    }

    // 2) Criar usuário no Auth (confirmado)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { must_reset_password: true, nome },
      app_metadata: { created_by: "edge.create-user" },
    });
    if (createErr) {
      console.error("auth.createUser failed", createErr);
      return json({ error: `Falha ao criar auth user: ${createErr.message}` }, 400);
    }

    const user_id = created.user?.id;
    if (!user_id) {
      console.error("auth.createUser returned no id", created);
      return json({ error: "Auth user criado sem id" }, 500);
    }

    // 3) Upsert em profiles com Service Role (bypass RLS)
    const { error: pErr } = await admin
      .from("profiles")
      .upsert(
        { user_id, org_id, role, nome, membro_id, must_reset_password: true },
        { onConflict: "user_id" }
      );
    if (pErr) {
      console.error("profiles upsert failed", pErr);
      try { await admin.auth.admin.deleteUser(user_id); } catch (e) { console.error("rollback deleteUser failed", e); }
      return json({ error: `Falha ao gravar profile: ${pErr.message}` }, 400);
    }

    console.log("create-user: success", { user_id, email, org_id, role });
    return json({ ok: true, user_id, email, org_id, role, message: "Usuário criado e perfil vinculado" });
  } catch (e: any) {
    console.error("create-user: unhandled", e);
    return json({ error: e?.message || "Erro inesperado" }, 500);
  }
}
