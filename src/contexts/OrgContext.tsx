"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type OrgRow = {
  id: string;
  nome: string | null;
  logo_url: string | null;          // pública (compat)
  logo_bucket: string | null;       // ex.: "org-assets"
  logo_path: string | null;         // ex.: "<org_id>/logo.png"
};

type OrgContextValue = {
  orgId?: string | null;
  orgName?: string;
  /** URL final para exibição (pública com cache-buster ou signed) */
  orgLogoUrl?: string;
  /** caminho no Storage (se privado) — útil para re-assinar */
  orgLogoPath?: string | null;
  /** bucket (se privado) */
  orgLogoBucket?: string | null;
  loading: boolean;

  /** Refaz o fetch da organização (nome, logo etc.) */
  refresh: () => Promise<void>;
  /** Re-assina a logo caso seja privada (troca só a URL) */
  refreshLogo: () => Promise<void>;
};

const OrgContext = createContext<OrgContextValue>({
  orgId: undefined,
  orgName: undefined,
  orgLogoUrl: undefined,
  orgLogoPath: null,
  orgLogoBucket: null,
  loading: true,
  refresh: async () => {},
  refreshLogo: async () => {},
});

export function useOrg() {
  return useContext(OrgContext);
}

/* -------- utils -------- */

const SS_KEYS = {
  name: "ui_org_name",
  logoUrl: "ui_org_logo_url",
  logoBucket: "ui_org_logo_bucket",
  logoPath: "ui_org_logo_path",
  orgId: "ui_org_id",
};

const isSigned = (u: string) => {
  try {
    const x = new URL(u);
    return (
      x.searchParams.has("token") ||
      x.searchParams.has("X-Amz-Signature") ||
      x.searchParams.has("Signature")
    );
  } catch {
    return false;
  }
};

function withCacheBust(url?: string | null) {
  if (!url) return undefined;
  try {
    // não tocar em URLs assinadas
    if (isSigned(url)) return url;
    const u = new URL(url);
    u.searchParams.set("t", Date.now().toString());
    return u.toString();
  } catch {
    return url ?? undefined;
  }
}

/* -------- Provider -------- */

export function OrgProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const orgId = profile?.org_id ?? null;

  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState<string | undefined>(() =>
    sessionStorage.getItem(SS_KEYS.name) || undefined
  );
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | undefined>(() =>
    sessionStorage.getItem(SS_KEYS.logoUrl) || undefined
  );
  const [orgLogoBucket, setOrgLogoBucket] = useState<string | null>(() =>
    sessionStorage.getItem(SS_KEYS.logoBucket) || null
  );
  const [orgLogoPath, setOrgLogoPath] = useState<string | null>(() =>
    sessionStorage.getItem(SS_KEYS.logoPath) || null
  );

  const renewTimer = useRef<number | null>(null);
  const stopRenew = () => {
    if (renewTimer.current) {
      window.clearInterval(renewTimer.current);
      renewTimer.current = null;
    }
  };

  const saveToSession = useCallback(
    (payload: {
      name?: string | null;
      logoUrl?: string | null;
      logoBucket?: string | null;
      logoPath?: string | null;
      orgId?: string | null;
    }) => {
      if (payload.name !== undefined) {
        if (payload.name === null) sessionStorage.removeItem(SS_KEYS.name);
        else sessionStorage.setItem(SS_KEYS.name, payload.name);
      }
      if (payload.logoUrl !== undefined) {
        if (payload.logoUrl === null) sessionStorage.removeItem(SS_KEYS.logoUrl);
        else sessionStorage.setItem(SS_KEYS.logoUrl, payload.logoUrl);
      }
      if (payload.logoBucket !== undefined) {
        if (!payload.logoBucket) sessionStorage.removeItem(SS_KEYS.logoBucket);
        else sessionStorage.setItem(SS_KEYS.logoBucket, payload.logoBucket);
      }
      if (payload.logoPath !== undefined) {
        if (!payload.logoPath) sessionStorage.removeItem(SS_KEYS.logoPath);
        else sessionStorage.setItem(SS_KEYS.logoPath, payload.logoPath);
      }
      if (payload.orgId !== undefined) {
        if (!payload.orgId) sessionStorage.removeItem(SS_KEYS.orgId);
        else sessionStorage.setItem(SS_KEYS.orgId, payload.orgId);
      }
    },
    []
  );

  const signLogoIfNeeded = useCallback(
    async (bucket: string | null, path: string | null, fallbackUrl: string | null) => {
      // bucket/path -> signed
      if (bucket && path) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60); // 1h

        if (!error && data?.signedUrl) {
          const signed = data.signedUrl;
          setOrgLogoUrl(signed);
          saveToSession({ logoUrl: signed });
          return;
        }
        // se assinatura falhar, ainda tenta fallback público
      }

      // somente URL pública
      const final = withCacheBust(fallbackUrl) || undefined;
      setOrgLogoUrl(final);
      saveToSession({ logoUrl: final ?? null });
    },
    [saveToSession]
  );

  const scheduleRenewIfNeeded = useCallback(() => {
    stopRenew();
    if (orgLogoBucket && orgLogoPath) {
      // renova 55 minutos antes
      renewTimer.current = window.setInterval(async () => {
        const { data } = await supabase.storage
          .from(orgLogoBucket)
          .createSignedUrl(orgLogoPath, 60 * 60);
        if (data?.signedUrl) {
          setOrgLogoUrl(data.signedUrl);
          saveToSession({ logoUrl: data.signedUrl });
        }
      }, 55 * 60 * 1000);
    }
  }, [orgLogoBucket, orgLogoPath, saveToSession]);

  const fetchOrg = useCallback(async () => {
    if (!orgId) {
      // sem org → limpa
      setOrgName(undefined);
      setOrgLogoUrl(undefined);
      setOrgLogoBucket(null);
      setOrgLogoPath(null);
      saveToSession({
        name: null,
        logoUrl: null,
        logoBucket: null,
        logoPath: null,
        orgId: null,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("terreiros")
      .select("id, nome, logo_url, logo_bucket, logo_path")
      .eq("id", orgId)
      .maybeSingle<OrgRow>();

    if (!error && data) {
      setOrgName(data.nome ?? undefined);
      setOrgLogoBucket(data.logo_bucket);
      setOrgLogoPath(data.logo_path);
      saveToSession({
        name: data.nome ?? null,
        logoBucket: data.logo_bucket,
        logoPath: data.logo_path,
        orgId,
      });

      await signLogoIfNeeded(data.logo_bucket, data.logo_path, data.logo_url);
      scheduleRenewIfNeeded();
    }
    setLoading(false);
  }, [orgId, saveToSession, signLogoIfNeeded, scheduleRenewIfNeeded]);

  /** Re-assina somente a logo (sem refetch do row) */
  const refreshLogo = useCallback(async () => {
    if (!orgLogoBucket || !orgLogoPath) return;
    const { data, error } = await supabase.storage
      .from(orgLogoBucket)
      .createSignedUrl(orgLogoPath, 60 * 60);
    if (!error && data?.signedUrl) {
      setOrgLogoUrl(data.signedUrl);
      saveToSession({ logoUrl: data.signedUrl });
    }
  }, [orgLogoBucket, orgLogoPath, saveToSession]);

  const refresh = useCallback(async () => {
    await fetchOrg();
  }, [fetchOrg]);

  /* -------- effects -------- */

  // quando o orgId muda (login/troca de org), hidrata do cache e busca do DB
  useEffect(() => {
    // hidratação suave do cache
    const cachedOrgId = sessionStorage.getItem(SS_KEYS.orgId);
    if (cachedOrgId && cachedOrgId === orgId) {
      setOrgName(sessionStorage.getItem(SS_KEYS.name) || undefined);
      setOrgLogoUrl(sessionStorage.getItem(SS_KEYS.logoUrl) || undefined);
      setOrgLogoBucket(sessionStorage.getItem(SS_KEYS.logoBucket) || null);
      setOrgLogoPath(sessionStorage.getItem(SS_KEYS.logoPath) || null);
      setLoading(false);
      scheduleRenewIfNeeded(); // se já era privada, re-agenda a renovação
    } else {
      // limpa cache se mudou de organização
      saveToSession({
        name: null,
        logoUrl: null,
        logoBucket: null,
        logoPath: null,
        orgId: orgId ?? null,
      });
      setOrgName(undefined);
      setOrgLogoUrl(undefined);
      setOrgLogoBucket(null);
      setOrgLogoPath(null);
    }

    // busca do DB
    void fetchOrg();

    return () => stopRenew();
  }, [orgId, fetchOrg, saveToSession, scheduleRenewIfNeeded]);

  // realtime: atualiza quando a linha do terreiro mudar
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`org-row-${orgId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "terreiros", filter: `id=eq.${orgId}` },
        async (payload) => {
          const row = payload.new as OrgRow;
          setOrgName(row.nome ?? undefined);
          saveToSession({ name: row.nome ?? null });
          setOrgLogoBucket(row.logo_bucket);
          setOrgLogoPath(row.logo_path);
          saveToSession({ logoBucket: row.logo_bucket, logoPath: row.logo_path });

          await signLogoIfNeeded(row.logo_bucket, row.logo_path, row.logo_url);
          scheduleRenewIfNeeded();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, saveToSession, signLogoIfNeeded, scheduleRenewIfNeeded]);

  const value = useMemo<OrgContextValue>(
    () => ({
      orgId,
      orgName,
      orgLogoUrl,
      orgLogoPath,
      orgLogoBucket,
      loading,
      refresh,
      refreshLogo,
    }),
    [orgId, orgName, orgLogoUrl, orgLogoPath, orgLogoBucket, loading, refresh, refreshLogo]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}
