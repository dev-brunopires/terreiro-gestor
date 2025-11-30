// src/components/DashboardLayout.tsx
"use client";

import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Wallet } from "lucide-react";

import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useAuth } from "@/hooks/useAuth";
import FeatureGate from "@/components/FeatureGate";

interface DashboardLayoutProps { children: ReactNode }

/** Cartão mostrado quando a feature não faz parte do plano */
function NoAccessCard({ needed }: { needed: string }) {
  return (
    <Card className="my-6">
      <CardHeader><CardTitle>Recurso indisponível</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <p>O seu plano atual não permite acessar <b>{needed}</b>.</p>
        <Button asChild variant="outline">
          <Link to="/configuracoes?sec=faturamento">Ver planos</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Mapeia pathname -> feature do plano */
function featureFromPath(pathname: string): string | null {
  if (pathname.startsWith("/superadmin")) return null;
  if (pathname.startsWith("/membros")) return "membros";
  if (pathname.startsWith("/planos")) return "planos";
  if (pathname.startsWith("/assinaturas")) return "assinaturas";
  if (pathname.startsWith("/mensalidades")) return "mensalidades";
  if (pathname.startsWith("/faturas")) return "faturas";
  if (pathname.startsWith("/pagamentos-diversos")) return "pagamentos_diversos";
  if (pathname.startsWith("/relatorios")) return "relatorios";
  if (pathname.startsWith("/usuarios")) return "usuarios";
  if (pathname.startsWith("/pdv")) return "pdv";
  if (pathname.startsWith("/configuracoes")) return "configuracoes";
  return null; // páginas livres
}

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
    : pathname.startsWith("/usuarios") ? "Usuários"
    : pathname.startsWith("/pdv") ? "PDV"
    : pathname.startsWith("/configuracoes") ? "Configurações"
    : pathname.startsWith("/superadmin") ? "Superadmin"
    : "";

  // Superadmin allowlist (apenas você)
  const isSuperadmin = (user?.email || "").toLowerCase() === "brunopdlaj@gmail.com";

  const neededFeature = featureFromPath(pathname);

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <AppSidebar />

        <SidebarInset className="min-h-screen bg-background">
          {/* HEADER */}
          <header className="sticky top-0 z-40 border-b border-border bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50">
            <div className="mx-auto w-full max-w-7xl">
              <div className="h-14 sm:h-16 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-6">
                <SidebarTrigger className="h-8 w-8 shrink-0 rounded-md border hover:bg-muted" />
                <Separator orientation="vertical" className="h-5 sm:h-6 hidden sm:block" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-lg font-semibold leading-none truncate">Terreiro Gestor</h1>
                  {sectionTitle && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{sectionTitle}</p>
                  )}
                </div>

                {/* Atalho de Superadmin */}
                {isSuperadmin && !pathname.startsWith("/superadmin") && (
                  <Button asChild variant="outline" className="mr-2">
                    <Link to="/superadmin">Superadmin</Link>
                  </Button>
                )}

                {/* Botão rápido de Mensalidades */}
                <FeatureGate feature="mensalidades">
                  <Button
                    asChild
                    className="gap-2 bg-gradient-to-br from-primary via-violet-600 to-pink-600 text-white hover:opacity-90"
                  >
                    <Link to="/mensalidades">
                      <Wallet className="h-4 w-4" />
                      <span className="hidden sm:inline">Mensalidades</span>
                    </Link>
                  </Button>
                </FeatureGate>
              </div>
            </div>
          </header>

          {/* MAIN */}
          <main className="flex-1 bg-gradient-to-br from-background to-muted/20">
            <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 md:px-6 md:py-6">
              {neededFeature ? (
                <FeatureGate
                  feature={neededFeature}
                  fallback={<NoAccessCard needed={sectionTitle || neededFeature} />}
                >
                  {children}
                </FeatureGate>
              ) : (
                children
              )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
}

export default DashboardLayout;
