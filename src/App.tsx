// src/App.tsx
import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Mantém nome/logo do terreiro estáveis entre páginas
import { OrgProvider } from "@/contexts/OrgContext";
// Mantém avatar do usuário estável entre páginas
import { UserAvatarProvider } from "@/contexts/UserAvatarContext";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import UsuariosPage from "./pages/Usuarios";
import Dashboard from "./pages/Dashboard";
import Membros from "./pages/Membros";
import Planos from "./pages/Planos";
import Assinaturas from "./pages/Assinaturas";
import Faturas from "./pages/Faturas";
import Mensalidades from "./pages/Mensalidades";
import PagamentosDiversos from "./pages/PagamentosDiversos";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import NotFound from "./pages/NotFound";

// Respeita o nome real do arquivo
import SuperadminPage from "./pages/SuperAdmin";

// PDV (POS)
import PDVPage from "./pages/PDV";

/* React Query com menos “piscadas” entre rotas  */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15 * 1000,
    },
  },
});

/* Loader simples para Guards */
function GuardLoader() {
  return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
}

/** Guard de permissão para Configurações (RBAC) */
function SettingsGuard({ children }: { children: ReactNode }) {
  const { can, profile, loading } = useAuth();
  if (loading) return <GuardLoader />;
  const allowed =
    can("settings:view") ||
    profile?.role === "owner" ||
    profile?.role === "admin";
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Guard de superadmin por e-mail */
function SuperadminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <GuardLoader />;
  const isAllowed = (user?.email || "").toLowerCase() === "brunopdlaj@gmail.com";
  if (!isAllowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <UserAvatarProvider>
          {/* OrgProvider precisa ficar DENTRO do AuthProvider (usa profile.org_id) */}
          <OrgProvider>
            {/* Toasters globais */}
            <Toaster />
            <Sonner />

            <BrowserRouter>
              <Routes>
                {/* Públicas */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/onboarding" element={<Onboarding />} />

                {/* Protegidas (guard único) */}
                <Route
                  element={
                    <ProtectedRoute>
                      <Outlet />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/membros" element={<Membros />} />
                  <Route path="/planos" element={<Planos />} />
                  <Route path="/assinaturas" element={<Assinaturas />} />
                  <Route path="/faturas" element={<Faturas />} />
                  <Route path="/mensalidades" element={<Mensalidades />} />
                  <Route path="/pagamentos-diversos" element={<PagamentosDiversos />} />
                  <Route path="/usuarios" element={<UsuariosPage />} />
                  <Route path="/relatorios" element={<Relatorios />} />

                  {/* PDV */}
                  <Route path="/pdv" element={<PDVPage />} />

                  {/* Superadmin — apenas seu e-mail */}
                  <Route
                    path="/superadmin"
                    element={
                      <SuperadminGuard>
                        <SuperadminPage />
                      </SuperadminGuard>
                    }
                  />

                  {/* Configurações com RBAC adicional */}
                  <Route
                    path="/configuracoes"
                    element={
                      <SettingsGuard>
                        <Configuracoes />
                      </SettingsGuard>
                    }
                  />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </OrgProvider>
        </UserAvatarProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
