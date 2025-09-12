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

/* =========================
 * Types
 * =======================*/
type OrgRow = {
  id: string;
  nome: string | null;
  logo_url: string | null;    // pública (compat)
  logo_bucket: string | null; // ex.: "org-assets"
  logo_path: string | null;   // ex.: "<org_id>/logo.png"
};

type OrgContextValue = {
  orgId?: string | null;
  orgName?: string;
  /** URL final para exibição (pública ou assinada) */
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

/* =========================
 * Utils
 * =======================*/
const SS_KEYS = {
  name: "ui_org_name",
  logoUrl: "ui_org_logo_url",
  logoBucket: "ui_org_logo_bucket",
  logoPath: "ui_org_logo_path",
  orgId: "ui_org_id",
};

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Remove cascas como `<uuid>`, `"uuid"`, `'uuid'`, `{uuid}` e espaços; valida formato. */
function sanitizeUuid(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const cleaned = v.trim().replace(/^[<{'"]+|[>'"}]+$/g, "");
  return UUID_RX.test(cleaned) ? cleaned : null;
}

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

/** Mantemos a função (compat), mas **não** aplicamos cache-buster em URLs assinadas. */
function withCacheBust(url?: string | null) {
  if (!url) return undefined;
  try {
    if (isSigned(url)) return url;
    const u = new URL(url);
    u.searchParams.set("t", Date.now().toString());
    return u.toString();
  } catch {
    return url ?? undefined;
  }
}

/* =========================
 * Provider
 * =======================*/
export function OrgProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();

  // sanitize org_id do profile (evita casos como "<uuid>")
  const orgId = useMemo(
    () => sanitizeUuid((profile as any)?.org_id ?? null),
    [profile]
  );

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

  /** Ref para evitar re-renders quando a URL não mudou de fato */
  const orgLogoUrlRef = useRef<string | undefined>(orgLogoUrl);
  useEffect(() => {
    orgLogoUrlRef.current = orgLogoUrl;
  }, [orgLogoUrl]);

  /** Timer para renovar assinatura da logo privada (se houver) */
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
        payload.name === null
          ? sessionStorage.removeItem(SS_KEYS.name)
          : sessionStorage.setItem(SS_KEYS.name, payload.name);
      }
      if (payload.logoUrl !== undefined) {
        payload.logoUrl === null
          ? sessionStorage.removeItem(SS_KEYS.logoUrl)
          : sessionStorage.setItem(SS_KEYS.logoUrl, payload.logoUrl);
      }
      if (payload.logoBucket !== undefined) {
        payload.logoBucket
          ? sessionStorage.setItem(SS_KEYS.logoBucket, payload.logoBucket)
          : sessionStorage.removeItem(SS_KEYS.logoBucket);
      }
      if (payload.logoPath !== undefined) {
        payload.logoPath
          ? sessionStorage.setItem(SS_KEYS.logoPath, payload.logoPath)
          : sessionStorage.removeItem(SS_KEYS.logoPath);
      }
      if (payload.orgId !== undefined) {
        payload.orgId
          ? sessionStorage.setItem(SS_KEYS.orgId, payload.orgId)
          : sessionStorage.removeItem(SS_KEYS.orgId);
      }
    },
    []
  );

  /** Só atualiza a URL se realmente mudou */
  const setLogoUrlIfChanged = useCallback(
    (next?: string) => {
      if (next === orgLogoUrlRef.current) return;
      setOrgLogoUrl(next);
      saveToSession({ logoUrl: next ?? null });
    },
    [saveToSession]
  );

  /** Gera URL assinada se bucket/path estiverem presentes; senão usa logo pública. */
  const signLogoIfNeeded = useCallback(
    async (bucket: string | null, path: string | null, fallbackUrl: string | null) => {
      if (bucket && path) {
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60); // 1h
        if (!error && data?.signedUrl) {
          setLogoUrlIfChanged(data.signedUrl);
          return;
        }
        // se falhar, cai no fallback público
      }
      setLogoUrlIfChanged(withCacheBust(fallbackUrl));
    },
    [setLogoUrlIfChanged]
  );

  /** Agenda renovação ~55min (antes do 1h) para URLs assinadas */
  const scheduleRenewIfNeeded = useCallback(() => {
    stopRenew();
    if (orgLogoBucket && orgLogoPath) {
      renewTimer.current = window.setInterval(async () => {
        const { data } = await supabase.storage
          .from(orgLogoBucket)
          .createSignedUrl(orgLogoPath, 60 * 60);
        if (data?.signedUrl) setLogoUrlIfChanged(data.signedUrl);
      }, 55 * 60 * 1000);
    }
  }, [orgLogoBucket, orgLogoPath, setLogoUrlIfChanged]);

  const fetchOrg = useCallback(async () => {
    if (!orgId) {
      // sem org → limpa tudo
      setOrgName(undefined);
      setLogoUrlIfChanged(undefined);
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
    try {
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
    } finally {
      setLoading(false);
    }
  }, [orgId, saveToSession, signLogoIfNeeded, scheduleRenewIfNeeded]);

  /** Re-assina somente a logo (sem refetch do row) */
  const refreshLogo = useCallback(async () => {
    if (!orgLogoBucket || !orgLogoPath) return;
    const { data, error } = await supabase.storage
      .from(orgLogoBucket)
      .createSignedUrl(orgLogoPath, 60 * 60);
    if (!error && data?.signedUrl) setLogoUrlIfChanged(data.signedUrl);
  }, [orgLogoBucket, orgLogoPath, setLogoUrlIfChanged]);

  const refresh = useCallback(async () => {
    await fetchOrg();
  }, [fetchOrg]);

  /* =========================
   * Effects
   * =======================*/

  // Quando o orgId muda (login/troca de org), hidrata do cache e busca do DB
  useEffect(() => {
    // hidratação suave do cache, com sanitização
    const cached = sanitizeUuid(sessionStorage.getItem(SS_KEYS.orgId));
    if (cached && cached === orgId) {
      setOrgName(sessionStorage.getItem(SS_KEYS.name) || undefined);
      setLogoUrlIfChanged(sessionStorage.getItem(SS_KEYS.logoUrl) || undefined);
      setOrgLogoBucket(sessionStorage.getItem(SS_KEYS.logoBucket) || null);
      setOrgLogoPath(sessionStorage.getItem(SS_KEYS.logoPath) || null);
      setLoading(false);
      scheduleRenewIfNeeded();
    } else {
      // mudou org → limpa cache visual
      saveToSession({
        name: null,
        logoUrl: null,
        logoBucket: null,
        logoPath: null,
        orgId: orgId ?? null,
      });
      setOrgName(undefined);
      setLogoUrlIfChanged(undefined);
      setOrgLogoBucket(null);
      setOrgLogoPath(null);
    }

    void fetchOrg();
    return () => stopRenew();
  }, [orgId, fetchOrg, saveToSession, scheduleRenewIfNeeded, setLogoUrlIfChanged]);

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
          saveToSession({
            logoBucket: row.logo_bucket,
            logoPath: row.logo_path,
          });

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
