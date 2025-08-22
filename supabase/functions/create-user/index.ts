// supabase/functions/create-user/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

async function handler(req: Request) {
  try {
    if (req.method === "OPTIONS") return json({ ok: true });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Missing SUPABASE_URL or SERVICE_ROLE_KEY" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    type Payload = {
      email?: string;
      password?: string;
      org_id?: string;
      role?: Role;
      nome?: string | null;
      membro_id?: string | null;
    };

    let payload: Payload;
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

    // FK: org
    const { data: orgRow, error: orgErr } = await admin
      .from("terreiros")
      .select("id")
      .eq("id", org_id)
      .maybeSingle();
    if (orgErr) return json({ error: `Erro ao validar org_id: ${orgErr.message}` }, 400);
    if (!orgRow) return json({ error: "org_id inexistente" }, 400);

    // FK: membro (se enviado)
    if (membro_id) {
      const { data: memRow, error: memErr } = await admin
        .from("membros")
        .select("id")
        .eq("id", membro_id)
        .maybeSingle();
      if (memErr) return json({ error: `Erro ao validar membro_id: ${memErr.message}` }, 400);
      if (!memRow) return json({ error: "membro_id inexistente" }, 400);
    }

    // cria auth user (SEM e-mail)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, must_reset_password: true },
      app_metadata: { created_by: "edge.create-user" },
    });
    if (createErr) return json({ error: `Falha ao criar auth user: ${createErr.message}` }, 400);

    const user_id = created.user?.id;
    if (!user_id) return json({ error: "Auth user criado sem id" }, 500);

    // upsert em profiles (service role ignora RLS)
    const { error: pErr } = await admin
      .from("profiles")
      .upsert(
        { user_id, org_id, role, nome, membro_id, must_reset_password: true },
        { onConflict: "user_id" }
      );
    if (pErr) {
      try { await admin.auth.admin.deleteUser(user_id); } catch {}
      return json({ error: `Falha ao gravar profile: ${pErr.message}` }, 400);
    }

    return json({ ok: true, user_id, email, org_id, role, message: "Usuário criado e perfil vinculado" });
  } catch (e: any) {
    return json({ error: e?.message || "Erro inesperado" }, 500);
  }
}

Deno.serve(handler);
export default handler;
