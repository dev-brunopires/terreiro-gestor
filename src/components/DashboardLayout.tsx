// src/components/DashboardLayout.tsx
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { Wallet } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

interface DashboardLayoutProps { children: ReactNode }

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const sectionTitle =
    pathname === "/mensalidades" ? "Mensalidades"
    : pathname === "/faturas" ? "Faturas"
    : pathname === "/assinaturas" ? "Assinaturas"
    : pathname === "/membros" ? "Membros"
    : pathname === "/planos" ? "Planos"
    : pathname === "/relatorios" ? "Relatórios"
    : pathname.startsWith("/superadmin") ? "Superadmin"
    : "";

  // Superadmin allowlist (apenas você)
  const isSuperadmin = (user?.email || "").toLowerCase() === "brunopdlaj@gmail.com";

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <AppSidebar />

        <SidebarInset className="min-h-screen bg-background">
          {/* HEADER */}
          <header className="sticky top-1 z-70 h-17 border-b border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50">
            {/* mesmo container do main, garantindo alinhamento */}
            <div className="mx-auto w-full max-w-7xl">
              <div className="h-16 flex items-center gap-3 px-4 md:px-6">
                <SidebarTrigger className="h-8 w-8 rounded-md border hover:bg-muted" />
                {/* separa o ícone da “linha” do sidebar */}
                <Separator orientation="vertical" className="h-6" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-semibold leading-none truncate">Terreiro Gestor</h1>
                  {sectionTitle && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{sectionTitle}</p>
                  )}
                </div>

                {/* Atalho de Superadmin — só para o seu e-mail e fora da própria página */}
                {isSuperadmin && !pathname.startsWith("/superadmin") && (
                  <Button asChild variant="outline" className="mr-2">
                    <Link to="/superadmin" title="Área de Superadmin">Superadmin</Link>
                  </Button>
                )}

                <Button
                  asChild
                  className="gap-2 bg-gradient-to-br from-primary via-violet-600 to-pink-600 text-white hover:opacity-90"
                >
                  <Link to="/mensalidades" title="Ir para Mensalidades">
                    <Wallet className="h-4 w-4" />
                    <span className="hidden sm:inline">Mensalidades</span>
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          {/* MAIN */}
          <main className="flex-1 bg-gradient-to-br from-background to-muted/20">
            <div className="mx-auto w-full max-w-7xl px-6 py-6">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
