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
          setPlanId(null);
          setFeatures(new Set());
          setUnlockAll(true);
          return;
        }

        // Por enquanto, liberar todas as features (fail-open)
        // Quando houver tabelas de planos SaaS, usar lógica apropriada
        setPlanId(null);
        setFeatures(new Set());
        setUnlockAll(true);
      } catch (e: any) {
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
