import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";

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
// import RelatoriosPagas from "./pages/relatorios/Pagas";
// import RelatoriosInadimplencia from "./pages/relatorios/Inadimplencia";
// import RelatoriosReceitaPlano from "./pages/relatorios/ReceitaPlano";
// import RelatoriosEvolucao from "./pages/relatorios/Evolucao";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/** Guard de permissão para Configurações (RBAC) */
function SettingsGuard({ children }: { children: ReactNode }) {
  const { can, profile, loading } = useAuth();

  if (loading) return null; // opcional: colocar um Spinner/Loader aqui

  const allowed =
    can("settings:view") ||
    profile?.role === "owner" ||
    profile?.role === "admin";

  if (!allowed) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
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
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
