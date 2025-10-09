"use client";

import { NavLink, useNavigate } from "react-router-dom";
import {
  Home, Users, CreditCard, FileText, Receipt, BarChart3, Settings,
  LogOut, Wallet, HandCoins, ChevronRight, Sun, Moon, Shield, User, Building2,
  ShoppingCart, // ⬅️ NOVO
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarFooter
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import FeatureGate from "@/components/FeatureGate";
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
  { title: "PDV", url: "/pdv", icon: ShoppingCart }, // ⬅️ NOVO
];

// ⬇️ Ajuste fino por perfil: operador vê PDV; viewer continua enxugado
function overviewForRole(role?: Role) {
  if (role === "viewer") {
    return allOverview.filter((i) =>
      ["/mensalidades", "/pagamentos-diversos"].includes(i.url)
    );
  }
  if (role === "operador") {
    return allOverview.filter((i) =>
      ["/pdv", "/mensalidades", "/pagamentos-diversos", "/faturas"].includes(i.url)
    );
  }
  return allOverview; // owner/admin/financeiro veem tudo
}

/* -------- utils -------- */
const isHttp = (s?: string | null) => !!s && /^https?:\/\//i.test(s || "");
const isSigned = (u: string) => {
  try {
    const x = new URL(u);
    return (
      x.searchParams.has("token") ||
      x.searchParams.has("X-Amz-Signature") ||
      x.searchParams.has("Signature")
    );
  } catch { return false; }
};
function withCacheBust(url?: string | null) {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (isSigned(url)) return url;
    u.searchParams.set("t", Date.now().toString());
    return u.toString();
  } catch {
    return url ?? undefined;
  }
}
/** Precarrega antes de trocar o src (evita flicker) */
async function preloadImage(url: string): Promise<boolean> {
  try {
    const img = new Image();
    img.src = url;
    if ("decode" in img && typeof (img as any).decode === "function") {
      await (img as any).decode();
      return true;
    }
    return await new Promise<boolean>((res) => {
      img.onload = () => res(true);
      img.onerror = () => res(false);
    });
  } catch { return false; }
}

export function AppSidebar({ className = "" }: { className?: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();
  const { orgName, orgLogoUrl, refreshLogo } = useOrg();

  const role = (profile?.role as Role) || undefined;
  const canManageUsers = role === "owner" || role === "admin";
  const isSuperadmin = (user?.email || "").toLowerCase() === "brunopdlaj@gmail.com";

  /* ========= ORG: nome e logo estáveis (cache) ========= */
  const [localOrgName, setLocalOrgName] = useState<string | undefined>(
    () => sessionStorage.getItem("ui_org_name") || undefined
  );
  const [localOrgLogoUrl, setLocalOrgLogoUrl] = useState<string | undefined>(
    () => sessionStorage.getItem("ui_org_logo_url") || undefined
  );

  useEffect(() => {
    if (orgName && orgName !== sessionStorage.getItem("ui_org_name")) {
      setLocalOrgName(orgName);
      sessionStorage.setItem("ui_org_name", orgName);
    }
  }, [orgName]);

  // 🔑 Se orgLogoUrl vier vazio (logo removida), limpamos o cache e o state
  useEffect(() => {
    if (orgLogoUrl) {
      if (orgLogoUrl !== sessionStorage.getItem("ui_org_logo_url")) {
        setLocalOrgLogoUrl(orgLogoUrl);
        sessionStorage.setItem("ui_org_logo_url", orgLogoUrl);
      }
    } else {
      setLocalOrgLogoUrl(undefined);
      sessionStorage.removeItem("ui_org_logo_url");
    }
  }, [orgLogoUrl]);

  // mantém logo válida se for signed
  useEffect(() => {
    if (localOrgLogoUrl && isSigned(localOrgLogoUrl)) void refreshLogo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayOrgName = localOrgName || "Terreiro";
  const displayOrgLogo = localOrgLogoUrl;

  /* ========= USER AVATAR ========= */
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>(
    () => sessionStorage.getItem("ui_user_avatar_url") || undefined
  );
  const lastAvatarRawRef = useRef<string | null>(null);
  const visibleAvatarUrlRef = useRef<string | undefined>(userAvatarUrl);
  const avatarPathRef = useRef<string | null>(null);
  const renewTimerRef = useRef<number | null>(null);
  const RENEW_MS = 55 * 60 * 1000;

  const stopRenew = () => {
    if (renewTimerRef.current) {
      window.clearInterval(renewTimerRef.current);
      renewTimerRef.current = null;
    }
  };

  const setAvatarVisibleUrl = (next?: string) => {
    if (next === visibleAvatarUrlRef.current) return;
    visibleAvatarUrlRef.current = next;
    setUserAvatarUrl(next);
    if (next) sessionStorage.setItem("ui_user_avatar_url", next);
    else sessionStorage.removeItem("ui_user_avatar_url");
  };

  async function signAndShowAvatar(raw?: string | null) {
    const normalized = raw ?? null;
    if (normalized === lastAvatarRawRef.current) return;
    lastAvatarRawRef.current = normalized;

    stopRenew();

    // 🧹 avatar removido: zera tudo
    if (!normalized) {
      avatarPathRef.current = null;
      setAvatarVisibleUrl(undefined);
      return;
    }

    if (isHttp(normalized)) {
      const final = withCacheBust(normalized)!;
      const ok = await preloadImage(final);
      setAvatarVisibleUrl(ok ? final : undefined);
      avatarPathRef.current = null;
      return;
    }

    // PATH privado no bucket "avatars"
    avatarPathRef.current = normalized;
    const { data, error } = await supabase.storage.from("avatars").createSignedUrl(normalized, 60 * 60);
    const signed = !error ? data?.signedUrl : undefined;

    if (signed) {
      const ok = await preloadImage(signed);
      setAvatarVisibleUrl(ok ? signed : undefined);

      // Renova assinatura silenciosamente e só troca quando a nova imagem já carregou
      renewTimerRef.current = window.setInterval(async () => {
        const path = avatarPathRef.current;
        if (!path) return;
        const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
        const fresh = data?.signedUrl;
        if (!fresh || fresh === visibleAvatarUrlRef.current) return;
        const loaded = await preloadImage(fresh);
        if (loaded) setAvatarVisibleUrl(fresh);
      }, RENEW_MS);
    } else {
      avatarPathRef.current = null;
      setAvatarVisibleUrl(undefined);
    }
  }

  // hidrata avatar
  useEffect(() => {
    const meta = (user?.user_metadata as any) || {};
    const raw: string | undefined =
      (profile as any)?.avatar_url ||
      meta?.avatar_path ||
      meta?.avatar_url ||
      undefined;
    void signAndShowAvatar(raw);
    return () => stopRenew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.avatar_url, user?.user_metadata, user?.id]);

  // realtime: se o profile mudar, atualiza (inclusive para null -> some da sidebar)
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    const ch = supabase
      .channel(`profile-avatar-${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          const nextRaw = payload?.new?.avatar_url as string | null | undefined;
          void signAndShowAvatar(nextRaw ?? null);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // auth state (ex.: updateUser metadata)
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const meta = (session?.user?.user_metadata as any) || {};
      const raw: string | null | undefined = meta?.avatar_path ?? meta?.avatar_url ?? null;
      void signAndShowAvatar(raw ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  /* ========= UI ========= */
  const [isDark, setIsDark] = useState<boolean>(
    typeof window !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );

  const displayName = useMemo(
    () => profile?.nome || user?.email || "Usuário",
    [profile?.nome, user?.email]
  );

  const orgInitials = (displayOrgName.trim()[0] || "T").toUpperCase();
  const userInitials = (displayName.trim()[0] || "?").toUpperCase();

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    [
      "group flex rounded-xl text-sm transition-colors h-10",
      collapsed ? "justify-center px-0" : "items-center gap-2 px-3",
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
    <Sidebar className={`z-50 ${className} ${collapsed ? "w-20" : "w-72"}`} collapsible="icon">
      <SidebarContent className="bg-background border-r">
        {/* TOPO — TERREIRO */}
        <div className="px-4 py-4 border-b">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <Avatar className="h-9 w-9 rounded-xl">
              {displayOrgLogo ? (
                <AvatarImage
                  src={displayOrgLogo}
                  alt="Logo do terreiro"
                  onError={() => {
                    // se a logo quebrar/for removida, limpa imediatamente
                    setLocalOrgLogoUrl(undefined);
                    sessionStorage.removeItem("ui_org_logo_url");
                  }}
                />
              ) : null}
              <AvatarFallback className="rounded-xl grid place-items-center">
                {displayOrgLogo ? orgInitials : <Building2 className="h-4 w-4 opacity-70" />}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight truncate">
                  {displayOrgName}
                </h2>
                <p className="text-xs text-muted-foreground leading-tight">Sistema de gestão</p>
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
                {userAvatarUrl ? (
                  <AvatarImage
                    src={userAvatarUrl}
                    alt="Seu avatar"
                    onError={() => {
                      // avatar quebrado/removido: some da sidebar
                      lastAvatarRawRef.current = null;
                      avatarPathRef.current = null;
                      setAvatarVisibleUrl(undefined);
                    }}
                  />
                ) : null}
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
                {userAvatarUrl ? (
                  <AvatarImage
                    src={userAvatarUrl}
                    alt="Seu avatar"
                    onError={() => {
                      lastAvatarRawRef.current = null;
                      avatarPathRef.current = null;
                      setAvatarVisibleUrl(undefined);
                    }}
                  />
                ) : null}
                <AvatarFallback className="grid place-items-center">
                  {userAvatarUrl ? userInitials : <User className="h-4 w-4 opacity-70" />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{displayName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {displayOrgName}
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
