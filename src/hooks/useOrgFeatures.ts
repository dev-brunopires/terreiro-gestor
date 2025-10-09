// src/hooks/useOrgFeatures.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Regra de janela ativa do contrato */
function isContratoAtivo(c: any): boolean {
  if (!c) return false;
  const today = new Date().toISOString().slice(0, 10);
  const inWindow =
    (!c.inicio || c.inicio <= today) &&
    (!c.fim || c.fim >= today);
  return c.status === "ativo" && inWindow;
}

type State = {
  loading: boolean;
  error: string | null;
  orgId: string | null;
  planId: string | null;
  unlockAll: boolean;                 // true => libera tudo (erro/dados incompletos/sem features)
  has: (feature: string) => boolean;  // checagem de feature
};

/**
 * Regra pedida:
 * 1) Pega SEMPRE o org_id do perfil do usuário logado (profiles.org_id)
 * 2) Busca o contrato ativo dessa org (saas_org_contracts)
 * 3) Busca as features do plano (saas_plan_features)
 *
 * Observações:
 * - Em caso de erro de leitura (ex.: RLS), usamos fail-open (unlockAll=true) para não "matar" a UI.
 * - Se o plano não definiu nenhuma feature (0 linhas), também liberamos tudo (unlockAll=true).
 */
export function useOrgFeatures(): State {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [features, setFeatures] = useState<Set<string>>(new Set());
  const [unlockAll, setUnlockAll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 1) user + org do perfil
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const uid = userRes?.user?.id;
        if (!uid) throw new Error("Usuário não autenticado.");

        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("user_id", uid)
          .maybeSingle();
        if (pErr) throw pErr;

        const org = prof?.org_id ?? null;
        setOrgId(org);

        if (!org) {
          // Sem org no perfil → fail-open (evita travar toda a UI)
          setPlanId(null);
          setFeatures(new Set());
          setUnlockAll(true);
          return;
        }

        // 2) contrato ativo da org
        const { data: contratos, error: cErr } = await supabase
          .from("saas_org_contracts")
          .select("*")
          .eq("org_id", org)
          .order("created_at", { ascending: false })
          .limit(3);
        if (cErr) throw cErr;

        const ativo = (contratos || []).find(isContratoAtivo);
        const plano = ativo?.plan_id ?? null;
        setPlanId(plano);

        if (!plano) {
          // Sem contrato/plano ativo → por política aqui, fail-open para não quebrar navegação
          setFeatures(new Set());
          setUnlockAll(true);
          return;
        }

        // 3) features do plano
        const { data: feats, error: fErr } = await supabase
          .from("saas_plan_features")
          .select("feature")
          .eq("plan_id", plano);
        if (fErr) throw fErr;

        const list = (feats || []).map((r: any) => String(r.feature));
        const set = new Set(list);

        // Plano sem features definidas → libera tudo (fail-open)
        setUnlockAll(set.size === 0);
        setFeatures(set);
      } catch (e: any) {
        // Em erro (ex.: RLS), não bloqueie tudo: fail-open + erro para debug
        setError(e?.message || String(e));
        setOrgId(null);
        setPlanId(null);
        setFeatures(new Set());
        setUnlockAll(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const has = useMemo(() => {
    return (code: string) => features.has(code);
  }, [features]);

  return { loading, error, orgId, planId, unlockAll, has };
}
