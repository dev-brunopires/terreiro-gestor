"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Busca o org_id do usuário logado e retorna as features liberadas
 * pelo plano do contrato ativo desse org (terreiro).
 */
export function useOrgFeatures() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setOrgId(null); setFeatures([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        // 1) pega o org do perfil
        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (pErr) throw pErr;
        const oid = prof?.org_id ?? null;
        setOrgId(oid);

        if (!oid) { setFeatures([]); setLoading(false); return; }

        // 2) contrato + features do plano do org (APENAS se status = ativo)
        const { data: row, error: cErr } = await supabase
          .from("saas_org_contracts")
          .select(`
            status,
            saas_plan_features:saas_plans ( saas_plan_features ( feature ) )
          `)
          .eq("org_id", oid)
          .maybeSingle();
        if (cErr) throw cErr;

        if (!row || row.status !== "ativo") { setFeatures([]); }
        else {
          const feats = (row.saas_plan_features?.saas_plan_features ?? [])
            .map((f: any) => f.feature);
          setFeatures(feats ?? []);
        }
      } catch {
        setFeatures([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const has = useMemo(() => (code: string) => !!features?.includes(code), [features]);

  return { orgId, features: features ?? [], has, loading };
}
