"use client";
import { useEffect, useMemo, useState } from "react";
import type { Profile } from "./useProfile";
import { supabase } from "@/integrations/supabase/client";

const rolePermissions: Record<NonNullable<Profile["role"]>, string[]> = {
  owner: [
    "membros:create",
    "membros:edit",
    "membros:view",
    "faturas:gerar",
    "faturas:pagar",
    "planos:manage",
    "billing:view",
    "logs:view",
    "assinaturas:link",
    "settings:view",
  ],
  admin: [
    "membros:create",
    "membros:edit",
    "membros:view",
    "faturas:gerar",
    "faturas:pagar",
    "planos:manage",
    "billing:view",
    "logs:view",
    "assinaturas:link",
    "settings:view",
  ],
  financeiro: [
    "membros:view",
    "faturas:gerar",
    "faturas:pagar",
    "planos:manage",
    "billing:view",
    "logs:view",
    "assinaturas:link",
    "settings:view",
  ],
  operador: [
    "membros:create",
    "membros:edit",
    "membros:view",
    "assinaturas:link",
    "settings:view",
  ],
  viewer: ["membros:view"],
};

type UsePermissionsResult = {
  permissions: string[];
  loading: boolean;
  error: string | null;
  can: (perm: string) => boolean;
  reload: () => Promise<void>;
};

/**
 * Carrega permissões do usuário.
 * 1) Tenta ler da view `current_user_permissions` (coluna `permission`)
 * 2) Se vier vazio/erro, aplica fallback por `profile.role`
 */
export function usePermissions(profile: Profile | null): UsePermissionsResult {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(!!profile);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!profile?.user_id) {
      setPermissions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("current_user_permissions")
        .select("permission");

      if (error) throw error;

      if (data && data.length > 0) {
        setPermissions(data.map((d: any) => d.permission as string));
      } else {
        // fallback por role
        setPermissions(rolePermissions[profile.role] ?? []);
      }
    } catch (e: any) {
      // fallback em caso de erro
      setError(e?.message ?? "Erro ao carregar permissões");
      setPermissions(rolePermissions[profile.role] ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.user_id, profile?.role]);

  const can = useMemo(() => {
    const set = new Set(permissions);
    return (perm: string) => set.has(perm);
  }, [permissions]);

  return { permissions, loading, error, can, reload: load };
}
