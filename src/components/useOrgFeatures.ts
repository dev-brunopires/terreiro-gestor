"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOrgFeatures(orgId?: string | null) {
  const [features, setFeatures] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orgId) { setFeatures(null); return; }
    (async () => {
      setLoading(true);
      try {
        // busca contrato + features do plano
        const { data: rows, error } = await supabase
          .from("saas_org_contracts")
          .select(`
            plan_id,
            status,
            saas_plans!inner(id),
            saas_plan_features:saas_plan_features(plan_id, feature)
          `)
          .eq("org_id", orgId)
          .maybeSingle();
        if (error) throw error;

        // se não houver contrato/ativo, zera features
        if (!rows || rows.status !== "ativo" || !rows.saas_plan_features?.length) {
          setFeatures([]);
          setLoading(false);
          return;
        }

        setFeatures(rows.saas_plan_features.map((f: any) => f.feature));
      } catch {
        setFeatures([]);
      } finally { setLoading(false); }
    })();
  }, [orgId]);

  const has = (code: string) => !!features?.includes(code);
  return { features, has, loading };
}
