// src/pages/Usuarios.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/DashboardLayout";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertTriangle,
  UserPlus,
  Users,
  Trash2,
  KeyRound,
  Link as LinkIcon,
  Search,
  MoreHorizontal,
  Copy,
  ExternalLink,
  CheckCircle2,
  XCircle,
  MailCheck,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Role = "owner" | "admin" | "viewer" | "financeiro" | "operador";

type TeamRow = {
  user_id: string;
  nome: string | null;
  role: Role | null;
  membro_id: string | null;
  must_reset_password: boolean | null;
  paused: boolean | null;          // <—— NOVO
  email?: string | null;
};

type Membro = { id: string; nome: string; matricula: string | null; email?: string | null };

type AccessRequest = {
  id: string;
  org_id: string;
  email: string;
  nome: string | null;
  user_id: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
};

const NONE = "__none__";

const FN = {
  CREATE: "create-user",
  SET_PASSWORD: "admin-set-password",
  SEND_RESET: "admin-send-password-reset",
  DELETE_ACCOUNT: "admin-delete-user",
} as const;

function roleBadgeVariant(role?: Role | null) {
  switch (role) {
    case "owner":
      return "destructive";
    case "admin":
      return "default";
    case "financeiro":
      return "secondary";
    case "operador":
      return "outline";
    case "viewer":
    default:
      return "outline";
  }
}

/** Mostra a mensagem REAL vinda da Edge Function */
function niceError(err: any): string {
  const name = err?.name ? `${err.name}: ` : "";
  const body = err?.context?.body;

  if (!body) return name + (err?.message ?? "Falha ao chamar a Edge Function.");

  if (typeof body === "string") {
    try {
      const j = JSON.parse(body);
      return name + (j.message || j.error || body);
    } catch {
      return name + body;
    }
  }
  return name + (body.message || body.error || JSON.stringify(body));
}

/* -------------------- Modal: Link de recuperação -------------------- */
function ResetLinkDialog({
  open,
  onOpenChange,
  link,
  email,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  link?: string;
  email?: string;
}) {
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Copiado!", description: "Link copiado para a área de transferência." });
    } catch {
      toast({ title: "Não foi possível copiar", description: "Selecione e copie manualmente." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link de recuperação gerado</DialogTitle>
          <DialogDescription>
            {email ? (
              <>Este link foi gerado para <span className="font-medium">{email}</span>.</>
            ) : (
              "Use o link abaixo para redefinir a senha do usuário."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>URL</Label>
          <div className="flex gap-2">
            <Input value={link ?? ""} readOnly className="font-mono text-xs" />
            <Button variant="outline" onClick={handleCopy} title="Copiar">
              <Copy className="h-4 w-4" />
            </Button>
            {link && (
              <Button variant="secondary" onClick={() => window.open(link, "_blank")} title="Abrir">
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            O link também foi enviado por e-mail, se seu provedor SMTP estiver configurado e a URL de redirecionamento for permitida.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/* ------------------------------------------------------------------- */

export default function UsuariosPage() {
  const { toast } = useToast();
  const { user, profile, can, loading } = useAuth();

  const [team, setTeam] = useState<TeamRow[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [accessReqs, setAccessReqs] = useState<AccessRequest[]>([]);

  // Novo usuário (promover membro → viewer)
  const [newUserNome, setNewUserNome] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("viewer"); // <— viewer por padrão
  const [newUserMembroId, setNewUserMembroId] = useState<string>(NONE);
  const [newUserPassword, setNewUserPassword] = useState("Trocar123!");

  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");

  // modal do reset
  const [resetDlgOpen, setResetDlgOpen] = useState(false);
  const [resetDlgLink, setResetDlgLink] = useState<string | undefined>(undefined);
  const [resetDlgEmail, setResetDlgEmail] = useState<string | undefined>(undefined);

  const isAdmin = ["owner", "admin"].includes(profile?.role || "");
  const canViewSettings = typeof can === "function" && can("settings:view");
  const hasAccess = !!user && (isAdmin || canViewSettings);

  useEffect(() => {
    if (!profile?.org_id) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.org_id]);

  const loadData = async () => {
    if (!profile?.org_id) return;

    // Equipe atual (puxa "paused" também)
    const { data: d1, error: e1 } = await supabase
      .from("profiles")
      .select("user_id, nome, role, membro_id, must_reset_password, paused")
      .eq("org_id", profile.org_id)
      .order("role", { ascending: true });

    if (e1) {
      toast({ title: "Erro ao carregar equipe", description: e1.message, variant: "destructive" });
    } else {
      setTeam((d1 ?? []) as TeamRow[]);
    }

    // Pedidos de acesso pendentes (se você estiver usando a tabela de requests)
    const { data: ra, error: er } = await supabase
      .from("org_access_requests")
      .select("id, org_id, email, nome, user_id, status, created_at, approved_at")
      .eq("org_id", profile.org_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!er) setAccessReqs((ra ?? []) as AccessRequest[]);

    // Membros (inclui email)
    const { data: dm, error: em } = await supabase
      .from("membros")
      .select("id, nome, email, matricula, org_id, terreiro_id")
      .or(`org_id.eq.${profile.org_id},terreiro_id.eq.${profile.org_id}`)
      .order("nome", { ascending: true });

    if (em) {
      toast({ title: "Erro ao carregar membros", description: em.message, variant: "destructive" });
    } else {
      setMembros(((dm ?? []) as any[]).map((m) => ({
        id: m.id,
        nome: m.nome,
        email: m.email,
        matricula: m.matricula ?? null,
      })));
    }
  };

  const filteredTeam = useMemo(() => {
    const qx = q.trim().toLowerCase();
    return team.filter((u) => {
      const roleOk = roleFilter === "all" || u.role === roleFilter;
      const text = `${u.nome ?? ""} ${u.user_id}`.toLowerCase();
      const textOk = !qx || text.includes(qx);
      return roleOk && textOk;
    });
  }, [team, q, roleFilter]);

  const selectedMember = useMemo(
    () => membros.find((m) => m.id === newUserMembroId),
    [membros, newUserMembroId]
  );

  /** Promove um membro a usuário (viewer) exigindo troca de senha */
  const createUser = async () => {
    if (!profile?.org_id) return;
    if (newUserMembroId === NONE) {
      toast({ title: "Selecione um membro para promover a usuário.", variant: "destructive" });
      return;
    }
    if (!selectedMember?.email || !/\S+@\S+\.\S+/.test(selectedMember.email)) {
      toast({ title: "Membro sem e‑mail válido", description: "Defina o e‑mail no cadastro do membro.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(FN.CREATE, {
        body: {
          org_id: profile.org_id,
          membro_id: newUserMembroId,
          role: newUserRole,               // normalmente "viewer"
          password: newUserPassword,       // opcional
          nome: newUserNome || null,
          // dica: opcionalmente envie { paused: false } para já liberar o acesso
        },
      });

      if (error) {
        console.error("create-user error:", error?.context?.body || error);
        toast({ title: "Erro ao criar usuário", description: niceError(error), variant: "destructive" });
        return;
      }

      toast({ title: "Usuário criado", description: selectedMember?.email ?? "" });
      setNewUserNome("");
      setNewUserPassword("Trocar123!");
      setNewUserMembroId(NONE);
      setNewUserRole("viewer");
      await loadData();
    } catch (e: any) {
      toast({ title: "Erro ao criar usuário", description: e?.message ?? "Falha inesperada", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** Envia link de reset + abre modal com o link retornado */
  const sendResetLinkForUser = async (user_id: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(FN.SEND_RESET, {
        body: { user_id, redirectTo: `${window.location.origin}/trocar-senha` },
      });
      if (error) {
        console.error("send-reset error:", error?.context?.body || error);
        toast({ title: "Erro ao enviar link", description: niceError(error), variant: "destructive" });
        return;
      }

      const link = (data as any)?.action_link as string | undefined;
      const emailStatus = (data as any)?.email_status as string | undefined;
      const email = (data as any)?.email as string | undefined;

      setResetDlgLink(link);
      setResetDlgEmail(email);
      setResetDlgOpen(true);

      if (emailStatus === "sent") {
        toast({ title: "E-mail de recuperação enviado", description: email ?? "" });
      } else if (emailStatus) {
        toast({ title: "Aviso sobre envio de e-mail", description: emailStatus });
      }
    } catch (e: any) {
      toast({ title: "Erro ao enviar link", description: e?.message ?? "Falha inesperada", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** Define senha temporária forçando a troca no próximo login */
  const setTempPasswordForUser = async (user_id: string) => {
    const pwd = prompt("Nova senha temporária (mín. 8 caracteres):");
    if (!pwd) return;
    if (pwd.length < 8) {
      toast({ title: "Senha curta", description: "Mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke(FN.SET_PASSWORD, {
        body: { user_id, new_password: pwd, force_reset: true },
      });
      if (error) {
        console.error("set-password error:", error?.context?.body || error);
        toast({ title: "Erro ao atualizar senha", description: niceError(error), variant: "destructive" });
        return;
      }
      toast({ title: "Senha atualizada", description: "Obrigatória a troca no próximo acesso." });
      await loadData();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar senha", description: e?.message ?? "Falha inesperada", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** Pausar/Despausar acesso */
  const togglePaused = async (user_id: string, paused: boolean) => {
    if (!isAdmin || !profile?.org_id) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ paused })
        .eq("user_id", user_id)
        .eq("org_id", profile.org_id);
      if (error) throw error;
      setTeam(prev => prev.map(u => (u.user_id === user_id ? { ...u, paused } : u)));
      toast({ title: paused ? "Acesso pausado" : "Acesso reativado" });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar acesso", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** Remove só o vínculo com este terreiro (apenas profiles) */
  const removeUserFromOrg = async (user_id: string) => {
    if (!isAdmin || !profile?.org_id) return;
    if (user_id === user?.id) {
      toast({ title: "Ação bloqueada", description: "Você não pode remover a si mesmo.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").delete().eq("user_id", user_id).eq("org_id", profile.org_id);
      if (error) throw error;
      setTeam((prev) => prev.filter((u) => u.user_id !== user_id));
      toast({ title: "Usuário removido da organização" });
    } catch (e: any) {
      toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** APAGA A CONTA DO PROJETO (Auth). Requer Edge Function admin-delete-user. */
  const deleteAccount = async (user_id: string) => {
    if (!confirm("Tem certeza? Isso APAGA a CONTA do projeto (Auth + vínculos, se ON DELETE CASCADE).")) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke(FN.DELETE_ACCOUNT, {
        body: { user_id },
      });
      if (error) {
        toast({ title: "Erro ao apagar conta", description: niceError(error), variant: "destructive" });
        return;
      }
      toast({ title: "Conta apagada com sucesso" });
      await loadData();
    } catch (e: any) {
      toast({ title: "Erro ao apagar conta", description: e?.message ?? "Falha inesperada", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** ---------- Aprovar/Recusar pedidos de acesso (se houver) ---------- */
  const approveAccess = async (req: AccessRequest) => {
    if (!isAdmin || !profile?.org_id) return;
    setBusy(true);
    try {
      if (req.user_id) {
        const { error: upErr } = await supabase
          .from("profiles")
          .upsert(
            {
              user_id: req.user_id,
              org_id: profile.org_id,
              role: "viewer",
              nome: req.nome ?? null,
              paused: false,
            },
            { onConflict: "user_id" }
          );
        if (upErr) throw upErr;
      }
      const { error: updReqErr } = await supabase
        .from("org_access_requests")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", req.id);
      if (updReqErr) throw updReqErr;

      toast({
        title: "Pedido aprovado",
        description: req.user_id
          ? "O usuário foi vinculado e terá acesso imediato."
          : "Aguardando o usuário concluir o login; o pedido já está aprovado.",
      });
      await loadData();
    } catch (e: any) {
      toast({ title: "Erro ao aprovar", description: e?.message ?? "Falha inesperada", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const rejectAccess = async (req: AccessRequest) => {
    if (!isAdmin || !profile?.org_id) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("org_access_requests")
        .update({ status: "rejected" })
        .eq("id", req.id);
      if (error) throw error;
      toast({ title: "Pedido recusado" });
      await loadData();
    } catch (e: any) {
      toast({ title: "Erro ao recusar", description: e?.message ?? "Falha inesperada", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  /** ------------------------------------------------------------- */

  /** ---------- Helpers existentes ---------- */
  const updateRole = async (user_id: string, role: Role) => {
    if (!isAdmin || !profile?.org_id) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ role }).eq("user_id", user_id).eq("org_id", profile.org_id);
      if (error) throw error;
      setTeam(prev => prev.map(u => (u.user_id === user_id ? { ...u, role } : u)));
      toast({ title: "Papel atualizado" });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar papel", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const updateUserMembro = async (user_id: string, membro_id: string | null) => {
    if (!isAdmin || !profile?.org_id) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ membro_id }).eq("user_id", user_id).eq("org_id", profile.org_id);
      if (error) throw error;
      setTeam(prev => prev.map(u => (u.user_id === user_id ? { ...u, membro_id } : u)));
      toast({ title: "Vínculo atualizado" });
    } catch (e: any) {
      toast({ title: "Erro ao vincular membro", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const forceMustReset = async (user_id: string, flag: boolean) => {
    if (!isAdmin || !profile?.org_id) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ must_reset_password: flag }).eq("user_id", user_id).eq("org_id", profile.org_id);
      if (error) throw error;
      setTeam(prev => prev.map(u => (u.user_id === user_id ? { ...u, must_reset_password: flag } : u)));
      toast({ title: flag ? "Troca obrigatória ativada" : "Troca obrigatória removida" });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  /** -------------------------------------------------------------------------------------- */

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Carregando…</div>
      </DashboardLayout>
    );
  }

  if (!hasAccess) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Sem permissão</CardTitle>
            </CardHeader>
            <CardContent>Você não tem acesso à gestão de usuários.</CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Users className="h-6 w-6" /> Gestão de Usuários
            </h1>
            <p className="text-sm text-muted-foreground">
              Promova membros a usuários viewer, pause/despause acesso, defina senha temporária e envie link de recuperação.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/configuracoes?sec=usuarios">
              <Button variant="secondary">Abrir Configurações → Usuários</Button>
            </Link>
          </div>
        </div>

        {/* Pedidos de acesso (se estiver usando access requests) */}
        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MailCheck className="h-5 w-5" />
                  Pedidos de acesso
                </CardTitle>
                <CardDescription>Solicitações aguardando aprovação para este terreiro</CardDescription>
              </div>
              <Badge variant="secondary">{accessReqs.length} pendente(s)</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {accessReqs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">Nenhum pedido pendente.</div>
            ) : (
              <div className="rounded-xl border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cadastrado</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[180px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessReqs.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{r.nome || "(sem nome)"}</TableCell>
                        <TableCell>{r.email}</TableCell>
                        <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{r.status}</Badge>
                          {!r.user_id && (
                            <div className="text-[11px] text-muted-foreground mt-1">
                              Aguardando o usuário concluir o login (user_id ausente)
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="default" onClick={() => approveAccess(r)} disabled={busy}>
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => rejectAccess(r)} disabled={busy}>
                              <XCircle className="h-4 w-4 mr-1" />
                              Recusar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Criar usuário (promover membro → viewer) */}
        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle>Novo usuário (promover membro → viewer)</CardTitle>
            <CardDescription>
              Promove um <strong>membro</strong> a usuário (conta confirmada) e exige troca de senha no 1º acesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <Label>Membro</Label>
                <Select value={newUserMembroId} onValueChange={(v) => setNewUserMembroId(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o membro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>(selecione)</SelectItem>
                    {membros.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.matricula ? `${m.matricula} — ${m.nome}` : m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  O e‑mail será lido do cadastro do membro.
                </p>
              </div>

              <div className="md:col-span-2">
                <Label>E‑mail do membro</Label>
                <Input value={selectedMember?.email ?? ""} readOnly placeholder="Selecione um membro" />
              </div>

              <div>
                <Label>Papel</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as Role)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">viewer</SelectItem>
                    <SelectItem value="operador">operador</SelectItem>
                    <SelectItem value="financeiro">financeiro</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="owner">owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label>Nome (opcional)</Label>
                <Input
                  value={newUserNome}
                  onChange={(e) => setNewUserNome(e.target.value)}
                  placeholder="Sobrescrever nome no perfil (opcional)"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Senha padrão</Label>
                <Input value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} type="text" />
                <p className="text-xs text-muted-foreground mt-1">Usuário deverá trocá-la no 1º acesso.</p>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Button onClick={createUser} disabled={busy || newUserMembroId === NONE}>
                <UserPlus className="h-4 w-4 mr-2" /> Criar usuário
              </Button>
              <div className="text-xs text-muted-foreground">
                Dica: mantenha e‑mail do membro atualizado para evitar conflitos.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equipe */}
        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle>Equipe do terreiro</CardTitle>
            <CardDescription>Busque por nome/ID e filtre por papel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex items-center gap-2 max-w-md w-full">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou ID…" className="w-full" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Papel</Label>
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="owner">owner</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="financeiro">financeiro</SelectItem>
                    <SelectItem value="operador">operador</SelectItem>
                    <SelectItem value="viewer">viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Membro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[140px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeam.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          Nenhum usuário encontrado com os filtros atuais.
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTeam.map((u) => (
                      <TableRow key={u.user_id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{(u?.nome?.[0] ?? "?").toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{u.nome ?? "(sem nome)"}</div>
                              <div className="text-xs text-muted-foreground">{(u.user_id ?? "").slice(0, 8)}…</div>
                              {u.must_reset_password ? (
                                <Badge className="mt-1" variant="destructive">
                                  Precisa trocar senha
                                </Badge>
                              ) : (
                                <Badge className="mt-1" variant="secondary">
                                  Senha OK
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={roleBadgeVariant(u.role)} className="capitalize">
                              {u.role ?? "viewer"}
                            </Badge>
                            {isAdmin && (
                              <Select value={(u.role ?? "viewer") as Role} onValueChange={(v) => updateRole(u.user_id, v as Role)}>
                                <SelectTrigger className="w-[150px] h-8 text-xs">
                                  <SelectValue placeholder="Papel" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="owner">owner</SelectItem>
                                  <SelectItem value="admin">admin</SelectItem>
                                  <SelectItem value="financeiro">financeiro</SelectItem>
                                  <SelectItem value="operador">operador</SelectItem>
                                  <SelectItem value="viewer">viewer</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          {isAdmin ? (
                            <Select value={u.membro_id ?? NONE} onValueChange={(v) => updateUserMembro(u.user_id, v === NONE ? null : v)}>
                              <SelectTrigger className="w-[260px] h-8 text-xs">
                                <SelectValue placeholder="(sem vínculo)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>(sem vínculo)</SelectItem>
                                {membros.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.matricula ? `${m.matricula} — ${m.nome}` : m.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">
                              {(() => {
                                const mem = membros.find((m) => m.id === u.membro_id);
                                if (!mem) return "(sem vínculo)";
                                return mem.matricula ? `${mem.matricula} — ${mem.nome}` : mem.nome;
                              })()}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          {u.paused ? (
                            <Badge variant="outline" className="gap-1">
                              <PauseCircle className="h-3 w-3" /> Pausado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              Ativo
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>

                              <DropdownMenuItem onClick={() => setTempPasswordForUser(u.user_id)}>
                                <KeyRound className="mr-2 h-4 w-4" /> Definir senha temporária
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => sendResetLinkForUser(u.user_id)}>
                                <LinkIcon className="mr-2 h-4 w-4" /> Enviar link de troca
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {u.paused ? (
                                <DropdownMenuItem onClick={() => togglePaused(u.user_id, false)}>
                                  <PlayCircle className="mr-2 h-4 w-4" /> Despausar acesso
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => togglePaused(u.user_id, true)}>
                                  <PauseCircle className="mr-2 h-4 w-4" /> Pausar acesso
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => forceMustReset(u.user_id, true)}>
                                Exigir troca
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => forceMustReset(u.user_id, false)}>
                                Remover exigência
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => removeUserFromOrg(u.user_id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Remover da organização
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => deleteAccount(u.user_id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Apagar conta (permanente)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              Remover um usuário daqui apaga o vínculo dele com este terreiro (linha em <code>profiles</code>).
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal do link */}
      <ResetLinkDialog open={resetDlgOpen} onOpenChange={setResetDlgOpen} link={resetDlgLink} email={resetDlgEmail} />
    </DashboardLayout>
  );
}
