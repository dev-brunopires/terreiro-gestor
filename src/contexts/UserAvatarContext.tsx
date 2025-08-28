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

type Ctx = {
  avatarUrl?: string;   // URL final para exibição (pública e versionada)
  loading: boolean;
  refresh: () => Promise<void>; // força refetch do profile e rehidrata avatarUrl
};

const UserAvatarContext = createContext<Ctx>({
  avatarUrl: undefined,
  loading: true,
  refresh: async () => {},
});

export const useUserAvatar = () => useContext(UserAvatarContext);

const SS_KEYS = {
  uid: "ui_user_id",
  avatarUrl: "ui_user_avatar_url",
};

const isHttp = (s?: string | null) => !!s && /^https?:\/\//i.test(s);
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

/**
 * Regras que vamos seguir:
 * - avatar_url no profile/user_metadata deve ser uma URL pública (de preferência com ?v=<versão>)
 * - NÃO assinar URL de avatar (evita mudar toda hora).
 * - Persistir em sessionStorage para manter estável entre páginas.
 */
export function UserAvatarProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const uid = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(() => {
    const cachedUid = sessionStorage.getItem(SS_KEYS.uid);
    const cachedUrl = sessionStorage.getItem(SS_KEYS.avatarUrl) || undefined;
    return cachedUid && cachedUid === uid ? cachedUrl || undefined : undefined;
  });

  const saveCache = useCallback((url?: string) => {
    if (!uid) return;
    sessionStorage.setItem(SS_KEYS.uid, uid);
    if (url) sessionStorage.setItem(SS_KEYS.avatarUrl, url);
    else sessionStorage.removeItem(SS_KEYS.avatarUrl);
  }, [uid]);

  const readAvatarSource = useCallback((): string | undefined => {
    const meta = (user?.user_metadata as any) || {};
    // prioridade: profile.avatar_url; fallback: user_metadata.avatar_url
    return (profile as any)?.avatar_url || meta?.avatar_url || undefined;
  }, [profile, user?.user_metadata]);

  const hydrate = useCallback(async () => {
    if (!uid) {
      setAvatarUrl(undefined);
      sessionStorage.removeItem(SS_KEYS.uid);
      sessionStorage.removeItem(SS_KEYS.avatarUrl);
      setLoading(false);
      return;
    }
    const src = readAvatarSource();
    if (src && isHttp(src)) {
      // mantém estável; não adiciona cache-buster aqui (ele já deve vir versionado ?v=)
      setAvatarUrl(src);
      saveCache(src);
    } else {
      // sem avatar configurado (ou formato inesperado)
      setAvatarUrl(undefined);
      saveCache(undefined);
    }
    setLoading(false);
  }, [uid, readAvatarSource, saveCache]);

  // hidratar quando trocar de usuário ou quando profile.avatar_url realmente mudar
  const depKey = useMemo(() => readAvatarSource() || "", [readAvatarSource]);
  useEffect(() => { void hydrate(); }, [depKey, uid, hydrate]);

  // realtime: se atualizar a linha de profiles desse usuário, refletir
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel(`user-avatar-row-${uid}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `user_id=eq.${uid}`,
      }, (payload: any) => {
        const nextUrl = payload?.new?.avatar_url as string | null | undefined;
        if (nextUrl && isHttp(nextUrl)) {
          setAvatarUrl(nextUrl);
          saveCache(nextUrl);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, saveCache]);

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const value = useMemo<Ctx>(() => ({
    avatarUrl,
    loading,
    refresh,
  }), [avatarUrl, loading, refresh]);

  return (
    <UserAvatarContext.Provider value={value}>
      {children}
    </UserAvatarContext.Provider>
  );
}
