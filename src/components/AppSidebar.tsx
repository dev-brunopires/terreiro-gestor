import { NavLink, useNavigate } from "react-router-dom";
import {
  Home, Users, CreditCard, FileText, Receipt, BarChart3, Settings,
  LogOut, Wallet, HandCoins, ChevronRight, Sun, Moon, Shield,
  User, Building2,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarFooter
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Role = "owner" | "admin" | "viewer" | "financeiro" | "operador";

const allOverview = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Membros", url: "/membros", icon: Users },
  { title: "Planos", url: "/planos", icon: CreditCard },
  { title: "Assinaturas", url: "/assinaturas", icon: FileText },
  { title: "Mensalidades", url: "/mensalidades", icon: Wallet },
  { title: "Pagamentos Diversos", url: "/pagamentos-diversos", icon: HandCoins },
  { title: "Faturas", url: "/faturas", icon: Receipt },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

function overviewForRole(role?: Role) {
  if (role === "operador" || role === "viewer") {
    return allOverview.filter((i) =>
      ["/mensalidades", "/pagamentos-diversos"].includes(i.url)
    );
  }
  return allOverview; // owner/admin/financeiro
}

type AppSidebarProps = { className?: string };

// util: adiciona cache-buster sem duplicar
function withCacheBust(url?: string | null) {
  if (!url) return undefined;
  const u = new URL(url, window.location.origin);
  u.searchParams.set("t", Date.now().toString());
  return u.toString();
}

export function AppSidebar({ className = "" }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();

  const role = (profile?.role as Role) || undefined;
  const canManageUsers = role === "owner" || role === "admin";

  const [orgName, setOrgName] = useState<string>("");
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | undefined>(undefined);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>(undefined);

  const [isDark, setIsDark] = useState<boolean>(
    typeof window !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );

  // carrega nome/logo do terreiro (com cache-bust)
  useEffect(() => {
    const load = async () => {
      const orgId = profile?.org_id;
      if (!orgId) return;
      const { data } = await supabase
        .from("terreiros")
        .select("nome, logo_url")
        .eq("id", orgId)
        .maybeSingle();
      setOrgName(data?.nome ?? "");
      setOrgLogoUrl(withCacheBust((data as any)?.logo_url));
    };
    load();
  }, [profile?.org_id]);

  // realtime do terreiro (atualiza logo/nome e quebra cache)
  useEffect(() => {
    const orgId = profile?.org_id;
    if (!orgId) return;
    const channel = supabase
      .channel(`terreiros-updates-${orgId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "terreiros", filter: `id=eq.${orgId}` },
        (payload: any) => {
          setOrgName(payload?.new?.nome ?? "");
          setOrgLogoUrl(withCacheBust(payload?.new?.logo_url));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.org_id]);

  const displayName = useMemo(
    () => profile?.nome || user?.email || "Usuário",
    [profile?.nome, user?.email]
  );

  // avatar do usuário: prioriza profile.avatar_url (se existir no seu schema),
  // depois user_metadata.avatar_url/picture/avatar — SEMPRE com cache-buster
  useEffect(() => {
    const meta = (user?.user_metadata as any) || {};
    const candidate =
      (profile as any)?.avatar_url ||
      meta?.avatar_url ||
      meta?.picture ||
      meta?.avatar ||
      undefined;
    setUserAvatarUrl(withCacheBust(candidate));
  }, [profile, user?.user_metadata]);

  // escuta eventos de auth pra capturar updateUser/refresh e refletir avatar novo
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const meta = (session?.user?.user_metadata as any) || {};
      const candidate = meta?.avatar_url || meta?.picture || meta?.avatar || undefined;
      if (candidate) setUserAvatarUrl(withCacheBust(candidate));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const orgInitials = (orgName?.trim()?.[0] || "T").toUpperCase();
  const userInitials = (displayName?.trim()?.[0] || "?").toUpperCase();

  // estilos dos itens de navegação (centraliza quando colapsado)
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    [
      "group flex rounded-xl text-sm transition-colors h-10",
      collapsed
        ? "justify-center px-0"
        : "items-center gap-2 px-3",
      isActive
        ? "bg-muted text-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    ].join(" ");

  const toggleTheme = () => {
    const root = document.documentElement;
    const goingDark = !root.classList.contains("dark");
    root.classList.toggle("dark", goingDark);
    setIsDark(goingDark);
  };

  const settingsUrl = role === "operador" ? "/configuracoes?sec=perfil" : "/configuracoes";

  return (
    <Sidebar
      className={`z-50 ${className} ${collapsed ? "w-20" : "w-72"}`}
      collapsible="icon"
    >
      <SidebarContent className="bg-background border-r">
        {/* TOPO — TERREIRO */}
        <div className="px-4 py-4 border-b">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <Avatar className="h-9 w-9 rounded-xl">
              {orgLogoUrl ? <AvatarImage src={orgLogoUrl} /> : null}
              <AvatarFallback className="rounded-xl grid place-items-center">
                {orgLogoUrl ? orgInitials : <Building2 className="h-4 w-4 opacity-70" />}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight truncate">
                  {orgName || "Terreiro"}
                </h2>
                <p className="text-xs text-muted-foreground leading-tight">
                  Sistema de gestão
                </p>
              </div>
            )}
          </div>
        </div>

        {/* OVERVIEW */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] tracking-wide uppercase text-muted-foreground px-4 mt-3">
              Overview
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent className={`pt-2 ${collapsed ? "px-0" : "px-2"}`}>
            <SidebarMenu className={collapsed ? "px-0 mx-auto w-full" : ""}>
              {overviewForRole(role).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {canManageUsers && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/usuarios" className={getNavCls}>
                      <Shield className="h-5 w-5 shrink-0" />
                      {!collapsed && <span className="truncate">Usuários</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* CONTA */}
        <div className="h-px bg-border mx-4 my-2" />
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] tracking-wide uppercase text-muted-foreground px-4">
              Conta
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent className={`pt-2 ${collapsed ? "px-0" : "px-2"}`}>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to={settingsUrl} className={getNavCls}>
                    <Settings className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>Configurações</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* RODAPÉ */}
      <SidebarFooter className="border-t">
        {/* Tema */}
        <div className={`px-3 pt-2 ${collapsed ? "flex justify-center" : ""}`}>
          {collapsed ? (
            <button
              onClick={toggleTheme}
              title={isDark ? "Tema claro" : "Tema escuro"}
              className="h-10 w-10 rounded-xl border bg-card hover:bg-accent/40 grid place-items-center transition"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          ) : (
            <Button
              variant="secondary"
              className="w-full justify-start gap-2 rounded-xl"
              onClick={toggleTheme}
              title={isDark ? "Tema claro" : "Tema escuro"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{isDark ? "Claro" : "Escuro"}</span>
            </Button>
          )}
        </div>

        {/* Perfil */}
        <div className={collapsed ? "px-3 py-2 flex justify-center" : "px-3 py-2"}>
          {collapsed ? (
            <div
              className="rounded-xl border bg-card cursor-pointer p-1"
              title={displayName}
              onClick={() => navigate("/configuracoes?sec=perfil")}
            >
              <Avatar className="h-8 w-8">
                {userAvatarUrl ? <AvatarImage src={userAvatarUrl} /> : null}
                <AvatarFallback className="grid place-items-center">
                  {userAvatarUrl ? userInitials : <User className="h-4 w-4 opacity-70" />}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <button
              onClick={() => navigate("/configuracoes?sec=perfil")}
              className="w-full flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left hover:bg-accent/40 transition"
            >
              <Avatar className="h-9 w-9">
                {userAvatarUrl ? <AvatarImage src={userAvatarUrl} /> : null}
                <AvatarFallback className="grid place-items-center">
                  {userAvatarUrl ? userInitials : <User className="h-4 w-4 opacity-70" />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{displayName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {orgName || "Terreiro"}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Logout */}
        <div className={`pb-3 ${collapsed ? "px-3 flex justify-center" : "px-3"}`}>
          {collapsed ? (
            <button
              onClick={signOut}
              title="Sair"
              className="h-10 w-10 rounded-xl border bg-card hover:bg-destructive/10 hover:text-destructive grid place-items-center transition"
            >
              <LogOut className="h-5 w-5" />
            </button>
          ) : (
            <Button
              variant="outline"
              onClick={signOut}
              className="w-full justify-start gap-2 rounded-xl hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </Button>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
