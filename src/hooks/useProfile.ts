"use client";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "owner" | "admin" | "viewer" | "financeiro" | "operador";

export type Profile = {
  user_id: string;
  org_id: string | null;
  role: Role;
  nome: string | null;
};

type UseProfileResult = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

/**
 * Carrega o profile do usuário atual (tabela public.profiles).
 * - Recarrega quando o `user?.id` muda
 * - Expõe `reload()` para forçar atualização após alguma edição
 */
export function useProfile(user: User | null): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!user);
  const [error, setError] = useState<string | null>(null);

  const uid = useMemo(() => user?.id ?? null, [user?.id]);

  const fetchProfile = async () => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, org_id, role, nome")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setProfile(null);
    } else {
      const role = (data?.role ?? "viewer") as Role;
      setProfile(
        data
          ? {
              user_id: data.user_id,
              org_id: data.org_id,
              role,
              nome: data.nome,
            }
          : null
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return { profile, loading, error, reload: fetchProfile };
}
