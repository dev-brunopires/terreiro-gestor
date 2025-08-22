// src/pages/Configuracoes.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  Shield,
  Users,
  Bell,
  Building2,
  CreditCard,
  Paintbrush,
  Settings2,
  FileCog,
  Upload,
  Lock,
} from "lucide-react";

type Role = "owner" | "admin" | "viewer" | "financeiro" | "operador";
type TeamProfile = { user_id: string; nome: string | null; role: Role; org_id: string | null; email?: string | null };

const SECTIONS = [
  { key: "perfil",        label: "Meu Perfil",                 icon: Settings2 },
  { key: "organizacao",   label: "Organização",                icon: Building2 },
  { key: "usuarios",      label: "Usuários & Acessos",         icon: Users },
  { key: "notificacoes",  label: "Notificações",               icon: Bell },
  { key: "integracoes",   label: "Integrações",                icon: FileCog },
  { key: "faturamento",   label: "Assinatura & Faturamento",   icon: CreditCard },
  { key: "preferencias",  label: "Preferências do Sistema",    icon: Paintbrush },
  { key: "auditoria",     label: "Auditoria & Exportação",     icon: Shield },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export default function Configuracoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get("sec") as SectionKey) || "perfil";

  const { toast } = useToast();
  const { user, profile, can, loading } = useAuth();
  const [active, setActive] = useState<SectionKey>(initial);

  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";
  const isViewer = profile?.role === "viewer";

  useEffect(() => {
    setActive(initial);
  }, [initial]);

  // Redireciona viewer se tentar acessar seções proibidas via URL
  useEffect(() => {
    if (!isViewer) return;
    const blocked: SectionKey[] = ["integracoes", "faturamento", "usuarios", "auditoria"];
    if (blocked.includes(active)) {
      const fallback: SectionKey = "perfil";
      setActive(fallback);
      const next = new URLSearchParams(searchParams);
      next.set("sec", fallback);
      setSearchParams(next, { replace: true });
      toast({
        title: "Acesso restrito",
        description: "Seu perfil de visualização não permite acessar essa seção.",
      });
    }
  }, [active, isViewer, searchParams, setSearchParams, toast]);

  const go = (k: SectionKey) => {
    setActive(k);
    const next = new URLSearchParams(searchParams);
    next.set("sec", k);
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Carregando…</div>
      </DashboardLayout>
    );
  }

  // ✅ Gate geral de acesso às Configurações (mantém viewer com permissão de ver configurações básicas)
  if (!user || !(can("settings:view") || isOwnerOrAdmin)) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Sem permissão</CardTitle>
            </CardHeader>
            <CardContent>Você não tem acesso às Configurações.</CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex gap-6 p-4 md:p-6">
        {/* Sidebar */}
        <aside className="w-64 shrink-0">
          <nav className="space-y-1">
            {SECTIONS.map(({ key, label, icon: Icon }) => {
              const disabled =
                // Bloqueios de viewer:
                (isViewer && ["integracoes", "faturamento", "usuarios", "auditoria"].includes(key)) ||
                // Usuários & Acessos só para owner/admin:
                (key === "usuarios" && !isOwnerOrAdmin) ||
                // Faturamento exige permissão + não ser viewer:
                (key === "faturamento" && (isViewer || !can("billing:view"))) ||
                // Auditoria exige permissão + não ser viewer:
                (key === "auditoria" && (isViewer || !can("logs:view")));

              return (
                <Button
                  key={key}
                  variant={active === key ? "default" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => !disabled && go(key as SectionKey)}
                  disabled={disabled}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 space-y-6">
          {active === "perfil" && <SectionPerfil />}
          {active === "organizacao" && <SectionOrganizacao canEdit={isOwnerOrAdmin} />}
          {active === "usuarios" && <SectionUsuariosEAcessos />}
          {active === "notificacoes" && <SectionNotificacoes />}
          {active === "integracoes" && <SectionIntegracoes />}
          {active === "faturamento" && <SectionFaturamento />}
          {active === "preferencias" && <SectionPreferencias />}
          {active === "auditoria" && <SectionAuditoria />}
        </main>
      </div>
    </DashboardLayout>
  );
}

/* =========================
   Seção: Meu Perfil
========================= */
function SectionPerfil() {
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const [nome, setNome] = useState(profile?.nome ?? "");
  const [telefone, setTelefone] = useState<string>((user?.user_metadata as any)?.telefone ?? "");
  const [senha, setSenha] = useState("");
  const [saving, setSaving] = useState(false);

  // avatar
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(() => {
    const p = (profile as any)?.avatar_url as string | undefined;
    const m = (user?.user_metadata as any)?.avatar_url as string | undefined;
    return p || m || undefined;
  });

  useEffect(() => setNome(profile?.nome ?? ""), [profile?.nome]);

  const salvarPerfil = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase.from("profiles").update({ nome }).eq("user_id", user.id);
      if (pErr) throw pErr;
      const { error: uErr } = await supabase.auth.updateUser({ data: { telefone } });
      if (uErr) throw uErr;
      toast({ title: "Perfil atualizado" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar perfil", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const alterarSenha = async () => {
    if (!senha) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setSenha("");
      toast({ title: "Senha alterada com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao alterar senha", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast({ title: "Arquivo inválido", description: "Envie PNG ou JPG.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Tamanho máximo 2MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}.${ext}`;

      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (metaErr) throw metaErr;

      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);

      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      await supabase.auth.refreshSession();

      toast({ title: "Avatar atualizado" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    const { user } = useAuth();
    if (!user) return;
    setUploading(true);
    try {
      await supabase.storage.from("avatars").remove([`${user.id}.png`, `${user.id}.jpg`]);
      await supabase.auth.updateUser({ data: { avatar_url: null } });
      await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
      setAvatarUrl(undefined);
      toast({ title: "Avatar removido" });
    } catch (e: any) {
      toast({ title: "Erro ao remover avatar", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Meu Perfil</h2>
        <p className="text-sm text-muted-foreground">Atualize suas informações pessoais e credenciais.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {/* Avatar clicável para abrir o seletor */}
            <button
              type="button"
              onClick={onPickAvatar}
              title="Clique para enviar/alterar avatar"
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <Avatar className="h-16 w-16">
                <AvatarImage
                  key={avatarUrl}
                  src={avatarUrl}
                  alt="Avatar"
                  onError={(ev) => {
                    (ev.currentTarget as HTMLImageElement).src = "";
                  }}
                />
                <AvatarFallback>{(profile?.nome?.[0] ?? "?").toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>

            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={onFileChange}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={onPickAvatar} disabled={uploading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Enviando…" : "Enviar/Alterar avatar"}
                </Button>
                <Button size="sm" variant="outline" onClick={removeAvatar} disabled={uploading || !avatarUrl}>
                  Remover avatar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Suporte a PNG/JPG até 2MB. (bucket: <code>avatars</code>)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(xx) xxxxx-xxxx" />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={salvarPerfil} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nova senha</Label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled>
              <Lock className="h-4 w-4 mr-2" />
              Ativar 2FA (em breve)
            </Button>
            <Button onClick={alterarSenha} disabled={saving || !senha}>
              Alterar senha
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================
   Seção: Organização (logo, endereço e contatos)
   -> viewer: SOMENTE LEITURA
   -> owner/admin: pode editar
========================= */
function SectionOrganizacao({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Identidade
  const [nome, setNome] = useState("");
  const [logoUrl, setLogoUrl] = useState<string>("");

  // Contatos
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [site, setSite] = useState("");
  const [instagram, setInstagram] = useState("");

  // Endereço
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [cep, setCep] = useState("");

  useEffect(() => {
    (async () => {
      if (!profile?.org_id) return;
      setLoading(true);
      const { data, error } = await supabase.from("terreiros").select("*").eq("id", profile.org_id).maybeSingle();
      if (error) {
        toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      if (data) {
        const d = data as any;
        setNome(d.nome ?? "");
        setLogoUrl(d.logo_url ? `${d.logo_url}?t=${Date.now()}` : "");
        setEmail(d.email ?? "");
        setTelefone(d.telefone ?? "");
        setWhatsapp(d.whatsapp ?? "");
        setSite(d.site ?? "");
        setInstagram(d.instagram ?? "");
        setEndereco(d.endereco ?? "");
        setBairro(d.bairro ?? "");
        setCidade(d.cidade ?? "");
        setEstado(d.estado ?? "");
        setCep(d.cep ?? "");
      }
      setLoading(false);
    })();
  }, [profile?.org_id, toast]);

  const onPickLogo = () => {
    if (!canEdit) return;
    fileRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file || !profile?.org_id) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast({ title: "Arquivo inválido", description: "Envie PNG, JPG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Tamanho máximo 3MB.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const bucket = "org-assets";
      const path = `${profile.org_id}/logo.${ext}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      const { error: updErr } = await supabase
        .from("terreiros")
        .update({ logo_url: publicUrl, logo_bucket: bucket, logo_path: path })
        .eq("id", profile.org_id);
      if (updErr) throw updErr;

      setLogoUrl(`${publicUrl}?t=${Date.now()}`);
      toast({ title: "Logo atualizada com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e?.message ?? "Falha ao enviar o arquivo", variant: "destructive" });
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = async () => {
    if (!canEdit || !profile?.org_id) return;
    setSaving(true);
    try {
      await supabase.storage.from("org-assets").remove([
        `${profile.org_id}/logo.png`,
        `${profile.org_id}/logo.jpg`,
        `${profile.org_id}/logo.webp`,
      ]);
      const { error } = await supabase.from("terreiros").update({ logo_url: null }).eq("id", profile.org_id);
      if (error) throw error;
      setLogoUrl("");
      toast({ title: "Logo removida" });
    } catch (e: any) {
      toast({ title: "Erro ao remover logo", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const salvar = async () => {
    if (!canEdit || !profile?.org_id) return;
    setSaving(true);
    try {
      const payload = {
        nome,
        logo_url: logoUrl || null,
        email: email || null,
        telefone: telefone || null,
        whatsapp: whatsapp || null,
        site: site || null,
        instagram: instagram || null,
        endereco: endereco || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado || null,
        cep: cep || null,
      } as const;

      const { error } = await supabase.from("terreiros").update(payload).eq("id", profile.org_id);
      if (error) throw error;

      toast({ title: "Organização atualizada" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const disabled = !canEdit || loading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Organização</h2>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Defina a identidade visual, endereço e contatos do seu terreiro/organização."
            : "Visualização dos dados da organização (somente leitura para o seu perfil)."}
        </p>
      </div>

      {/* Identidade */}
      <Card>
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={onPickLogo}
              title={canEdit ? "Clique para enviar/alterar logo" : "Somente leitura"}
              className="rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              disabled={!canEdit}
            >
              <div className="relative h-20 w-20 rounded-xl border bg-muted overflow-hidden grid place-items-center">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={logoUrl}
                    src={logoUrl}
                    alt="Logo"
                    className="h-full w-full object-cover"
                    onError={(ev) => ((ev.currentTarget as HTMLImageElement).src = "")}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Sem logo</span>
                )}
              </div>
            </button>

            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onFileChange}
                disabled={!canEdit}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={onPickLogo} disabled={disabled}>
                  <Upload className="h-4 w-4 mr-2" />
                  {saving ? "Enviando…" : "Enviar/Alterar logo"}
                </Button>
                <Button size="sm" variant="outline" onClick={removeLogo} disabled={disabled || !logoUrl}>
                  Remover logo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                PNG/JPG/WEBP até 3MB. (bucket: <code>org-assets</code>)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome da organização</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Terreiro São Jorge" disabled={!canEdit} />
            </div>
            <div>
              <Label>Site</Label>
              <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://…" disabled={!canEdit} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contatos */}
      <Card>
        <CardHeader>
          <CardTitle>Contatos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>E‑mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@organizacao.com" type="email" disabled={!canEdit} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(22) 1234‑5678" disabled={!canEdit} />
          </div>
          <div>
            <Label>WhatsApp</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(22) 9 9999‑9999" disabled={!canEdit} />
          </div>
          <div className="md:col-span-2">
            <Label>Instagram</Label>
            <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@seu_perfil" disabled={!canEdit} />
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Logradouro</Label>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número e complemento" disabled={!canEdit} />
          </div>
          <div>
            <Label>Bairro</Label>
            <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Centro" disabled={!canEdit} />
          </div>
          <div>
            <Label>CEP</Label>
            <Input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="27900‑000" disabled={!canEdit} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Macaé" disabled={!canEdit} />
          </div>
          <div>
            <Label>Estado (UF)</Label>
            <Input value={estado} onChange={(e) => setEstado(e.target.value)} placeholder="RJ" maxLength={2} disabled={!canEdit} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={salvar} disabled={disabled}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
        {!canEdit && (
          <span className="text-xs text-muted-foreground self-center">Você não tem permissão para editar estes dados.</span>
        )}
      </div>
    </div>
  );
}

/* =========================
   Seção: Usuários & Acessos
========================= */
function SectionUsuariosEAcessos() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [team, setTeam] = useState<TeamProfile[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = profile?.role === "owner" || profile?.role === "admin";

  useEffect(() => {
    (async () => {
      if (!profile?.org_id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, org_id, role, nome")
        .eq("org_id", profile.org_id);
      if (error) {
        toast({ title: "Erro ao carregar equipe", description: error.message, variant: "destructive" });
        return;
      }
      const rows: TeamProfile[] = (data ?? []).map((r: any) => ({
        user_id: r.user_id,
        org_id: r.org_id,
        role: r.role,
        nome: r.nome,
      }));
      setTeam(rows);
    })();
  }, [profile?.org_id, toast]);

  const updateRole = async (user_id: string, role: Role) => {
    if (!canManage) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({ role }).eq("user_id", user_id).eq("org_id", profile?.org_id ?? "");
      if (error) throw error;
      setTeam((prev) => prev.map((u) => (u.user_id === user_id ? { ...u, role } : u)));
      toast({ title: "Papel atualizado" });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar papel", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: inviteEmail });
      if (error) throw error;
      setInviteEmail("");
      toast({ title: "Convite enviado", description: "O usuário receberá um link por e-mail." });
    } catch (e: any) {
      toast({ title: "Erro ao convidar", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Usuários & Acessos</h2>
          <p className="text-sm text-muted-foreground">Gerencie os membros da sua organização e seus papéis.</p>
        </div>
        {canManage && (
          <div className="flex items-end gap-2">
            <div>
              <Label>Novo convite</Label>
              <div className="flex gap-2">
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@dominio.com" />
                <Button onClick={sendInvite}>Enviar</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{(u.nome?.[0] ?? "?").toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div>{u.nome ?? "(sem nome)"}</div>
                        <div className="text-xs text-muted-foreground">{u.user_id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select value={u.role} onValueChange={(v) => updateRole(u.user_id, v as Role)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">owner</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="financeiro">financeiro</SelectItem>
                          <SelectItem value="operador">operador</SelectItem>
                          <SelectItem value="viewer">viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{u.role}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {team.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-sm text-muted-foreground">
                    Nenhum usuário encontrado para esta organização.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================
   Seção: Notificações
========================= */
function SectionNotificacoes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sys, setSys] = useState(true);
  const [fin, setFin] = useState(true);
  const [lem, setLem] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data, error } = await supabase.from("user_prefs").select("email_sys, email_fin, email_lem").eq("user_id", user.id).maybeSingle();
      if (error) return;
      if (data) {
        setSys(Boolean(data.email_sys));
        setFin(Boolean(data.email_fin));
        setLem(Boolean(data.email_lem));
      }
    })();
  }, [user?.id]);

  const salvar = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("user_prefs").upsert(
        {
          user_id: user.id,
          email_sys: sys,
          email_fin: fin,
          email_lem: lem,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      toast({ title: "Preferências salvas" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Notificações</h2>
        <p className="text-sm text-muted-foreground">Escolha quais avisos deseja receber.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Canais & Tipos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Sistema</div>
              <div className="text-sm text-muted-foreground">Atualizações e alertas do sistema</div>
            </div>
            <Switch checked={sys} onCheckedChange={setSys} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Financeiro</div>
              <div className="text-sm text-muted-foreground">Faturas, pagamentos, avisos de cobrança</div>
            </div>
            <Switch checked={fin} onCheckedChange={setFin} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Lembretes</div>
              <div className="text-sm text-muted-foreground">Resumos e lembretes periódicos</div>
            </div>
            <Switch checked={lem} onCheckedChange={setLem} />
          </div>
          <div className="pt-2">
            <Button onClick={salvar} disabled={loading}>
              {loading ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================
   Seção: Integrações
========================= */
function SectionIntegracoes() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">Conecte provedores externos (pagamentos, e-mail, WhatsApp, etc.).</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Configuração do gateway (em breve).</p>
          <Button variant="outline">Configurar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Webhooks / API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Crie chaves e endpoints (em breve).</p>
          <Button variant="outline">Gerar chave</Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================
   Seção: Assinatura & Faturamento
========================= */
function SectionFaturamento() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Assinatura & Faturamento</h2>
        <p className="text-sm text-muted-foreground">Gerencie seu plano e faturas.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Acesso rápido</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Link to="/planos">
            <Button variant="secondary">Planos</Button>
          </Link>
          <Link to="/faturas">
            <Button>Faturas</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================
   Seção: Preferências do Sistema
========================= */
function SectionPreferencias() {
  const [tema, setTema] = useState("system");
  const [idioma, setIdioma] = useState("pt-BR");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Preferências do Sistema</h2>
        <p className="text-sm text-muted-foreground">Ajustes visuais e comportamentais.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Aparência & Idioma</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tema</Label>
            <Select value={tema} onValueChange={setTema}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="system">Automático</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Idioma</Label>
            <Select value={idioma} onValueChange={setIdioma}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                <SelectItem value="en-US">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* =========================
   Seção: Auditoria & Exportação
========================= */
function SectionAuditoria() {
  const { can } = useAuth();
  const allowed = can("logs:view");
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Auditoria & Exportação</h2>
        <p className="text-sm text-muted-foreground">Acompanhe atividades e exporte seus dados.</p>
      </div>
      {!allowed ? (
        <Card>
          <CardHeader>
            <CardTitle>Sem permissão</CardTitle>
          </CardHeader>
          <CardContent>Você não pode visualizar logs de auditoria.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Logs de atividades</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Integre sua tabela de logs aqui (ex.: <code>audit_logs</code>). Em breve.
            </p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline">Exportar CSV</Button>
              <Button variant="outline">Exportar JSON</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
