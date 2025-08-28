// supabase/functions/set-org-plan/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
/** Helper para respostas JSON com CORS */ function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}
/** Normaliza data. Aceita dd/mm/aaaa, mm/dd/yyyy, ISO; devolve YYYY-MM-DD ou null */ function normDate(s) {
  if (!s) return null;
  const v = String(s).trim();
  if (!v) return null;
  // dd/mm/aaaa
  const ddmmyyyy = v.split("/");
  let d;
  if (ddmmyyyy.length === 3) {
    const [dd, mm, yyyy] = ddmmyyyy.map((x)=>parseInt(x, 10));
    d = new Date(yyyy, (mm || 1) - 1, dd || 1);
  } else {
    d = new Date(v);
  }
  if (isNaN(d.getTime())) return null;
  // força meia-noite UTC e corta em YYYY-MM-DD
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return json({
    ok: true
  });
  if (req.method !== "POST") {
    return json({
      ok: false,
      error: "Method not allowed",
      code: "method_not_allowed"
    }, 405);
  }
  /** ======== Parse body com fallback ======== */ const body = await req.json().catch(()=>({}));
  // Compat: aceita plan_id OU plano_id
  const planId = body?.plan_id ?? body?.plan_id ?? null;
  const orgId = body?.org_id ?? null;
  const ownerEmail = body?.owner_email ?? null;
  const status = body?.status ?? "ativo";
  const inicioBody = normDate(body?.inicio ?? null);
  const fimBody = normDate(body?.fim ?? null);
  /** ======== Logs úteis p/ debug no painel do Supabase ======== */ console.log("[set-org-plan] Incoming body:", body);
  try {
    /** ======== Validações básicas ======== */ if (!orgId) {
      return json({
        ok: false,
        error: "org_id é obrigatório",
        code: "missing_org_id"
      }, 400);
    }
    if (![
      "ativo",
      "expirado",
      "cancelado"
    ].includes(status)) {
      return json({
        ok: false,
        error: "status inválido",
        code: "invalid_status"
      }, 400);
    }
    const todayISO = new Date().toISOString().slice(0, 10);
    // A coluna `inicio` é NOT NULL no seu schema: default para HOJE se não vier nada.
    const inicioISO = inicioBody ?? todayISO;
    const fimISO = fimBody ?? null;
    if (fimISO && new Date(inicioISO) > new Date(fimISO)) {
      return json({
        ok: false,
        error: "Início não pode ser maior que Fim",
        code: "invalid_date_range"
      }, 400);
    }
    /** ======== Cliente Admin (service role) ======== */ const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      console.error("[set-org-plan] Missing env SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return json({
        ok: false,
        error: "Configuração do servidor ausente",
        code: "missing_env"
      }, 500);
    }
    const admin = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    /** ======== 1) Terreiro existe? ======== */ const { data: org, error: orgErr } = await admin.from("terreiros").select("id").eq("id", orgId).maybeSingle();
    if (orgErr) {
      console.error("[set-org-plan] terreiros select error:", orgErr);
      return json({
        ok: false,
        error: "Falha ao buscar terreiro",
        code: "db_org_select",
        details: orgErr.message
      }, 400);
    }
    if (!org) {
      return json({
        ok: false,
        error: "Terreiro não encontrado",
        code: "org_not_found"
      }, 400);
    }
    /** ======== 2) Sem plano => limpa contrato ======== */ if (!planId) {
      const { error: delErr } = await admin.from("saas_org_contracts").delete().eq("org_id", orgId);
      if (delErr) {
        console.error("[set-org-plan] delete contract error:", delErr);
        return json({
          ok: false,
          error: "Falha ao remover contrato",
          code: "db_contract_delete",
          details: delErr.message
        }, 400);
      }
      return json({
        ok: true,
        contract: null
      });
    }
    /** ======== 3) Plano existe e está ativo? ======== */ const { data: plan, error: planErr } = await admin.from("saas_plans").select("id, ativo").eq("id", planId).maybeSingle();
    if (planErr) {
      console.error("[set-org-plan] saas_plans select error:", planErr);
      return json({
        ok: false,
        error: "Falha ao buscar plano",
        code: "db_plan_select",
        details: planErr.message
      }, 400);
    }
    if (!plan) {
      return json({
        ok: false,
        error: "Plano não encontrado",
        code: "plan_not_found"
      }, 400);
    }
    if (plan.ativo === false) {
      return json({
        ok: false,
        error: "Plano inativo",
        code: "plan_inactive"
      }, 400);
    }
    /** ======== 4) Upsert do contrato (org_id UNIQUE) ======== */ const payload = {
      org_id: orgId,
      plan_id: planId,
      inicio: inicioISO,
      fim: fimISO,
      status,
      owner_email: ownerEmail ?? null,
      updated_at: new Date().toISOString()
    };
    const { data: up, error: upErr } = await admin.from("saas_org_contracts").insert(payload).onConflict("org_id") // chave única
    .merge().select("id, org_id, plan_id, inicio, fim, status, owner_email").single();
    if (upErr) {
      console.error("[set-org-plan] upsert contract error:", upErr);
      // Pode vir erro por NOT NULL (ex.: inicio), FK, etc.
      return json({
        ok: false,
        error: "Falha ao salvar contrato",
        code: "db_contract_upsert",
        details: upErr.message
      }, 400);
    }
    /** ======== 5) Owner opcional (promove para profiles.owner) ======== */ if (ownerEmail) {
      let userId;
      try {
        const found = await admin.auth.admin.getUserByEmail(ownerEmail);
        userId = found.data.user?.id;
      } catch (e) {
        console.warn("[set-org-plan] getUserByEmail falhou, vai tentar createUser:", e);
      }
      if (!userId) {
        const created = await admin.auth.admin.createUser({
          email: ownerEmail,
          password: crypto.randomUUID(),
          email_confirm: true
        });
        if (created.error) {
          console.error("[set-org-plan] createUser error:", created.error);
          return json({
            ok: false,
            error: "Falha ao criar usuário owner",
            code: "auth_create_user",
            details: created.error.message
          }, 400);
        }
        userId = created.data.user?.id;
      }
      if (userId) {
        const { error: upProfErr } = await admin.from("profiles").upsert({
          user_id: userId,
          org_id: orgId,
          role: "owner"
        }, {
          onConflict: "user_id"
        });
        if (upProfErr) {
          console.error("[set-org-plan] upsert profile error:", upProfErr);
          return json({
            ok: false,
            error: "Falha ao salvar profile de owner",
            code: "db_profile_upsert",
            details: upProfErr.message
          }, 400);
        }
      }
    }
    return json({
      ok: true,
      contract: up
    });
  } catch (e) {
    // Captura qualquer exceção inesperada
    console.error("[set-org-plan] Uncaught error:", e?.message ?? e);
    return json({
      ok: false,
      error: e?.message ?? "Erro inesperado",
      code: "unexpected"
    }, 400);
  }
});
export default {};
