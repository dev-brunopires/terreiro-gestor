// supabase/functions/superadmin-upsert-terreiro/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const url = Deno.env.get("SUPABASE_URL");
const anon = Deno.env.get("SUPABASE_ANON_KEY");
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// cliente p/ ler usuário do token
const supa = createClient(url, anon, {
  global: {
    headers: {
      Authorization: Deno.env.get("AUTHORIZATION") ?? ""
    }
  }
});
// cliente admin (bypassa RLS)
const admin = createClient(url, service);
const SUPERADMINS = new Set([
  "brunopdlaj@gmail.com"
]); // mantenha sincronizado
Deno.serve(async (req)=>{
  try {
    const { data: { user } } = await supa.auth.getUser(req.headers.get("Authorization")?.replace("Bearer ", "") || "");
    if (!user || !SUPERADMINS.has((user.email ?? "").toLowerCase())) {
      return new Response(JSON.stringify({
        error: "forbidden"
      }), {
        status: 403
      });
    }
    const body = await req.json();
    const id = body?.id ?? null;
    const nome = (body?.nome ?? "").trim();
    if (!nome) return new Response(JSON.stringify({
      error: "nome é obrigatório"
    }), {
      status: 400
    });
    if (id) {
      const { error } = await admin.from("terreiros").update({
        nome
      }).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({
        ok: true,
        id
      }), {
        status: 200
      });
    } else {
      const { data, error } = await admin.from("terreiros").insert({
        nome
      }).select("id").single();
      if (error) throw error;
      return new Response(JSON.stringify({
        ok: true,
        id: data.id
      }), {
        status: 200
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({
      error: e?.message ?? "unknown"
    }), {
      status: 500
    });
  }
});
