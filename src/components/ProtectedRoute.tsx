// src/components/ProtectedRoute.tsx
"use client";

import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Guard simples de AUTENTICAÇÃO.
 * - Se não autenticado, envia para /login?next=<rota-atual>
 * - Enquanto carrega sessão, exibe skeleton.
 * Regras de permissão específicas (ex.: superadmin, RBAC) ficam em guards dedicados.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    // Não autenticado → envia para /login mantendo o destino (pathname + search + hash)
    if (!user) {
      const next =
        encodeURIComponent(
          `${location.pathname}${location.search ?? ""}${location.hash ?? ""}`
        ) || "/";
      navigate(`/login?next=${next}`, { replace: true });
    }
  }, [user, loading, navigate, location.pathname, location.search, location.hash]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-[300px]">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
