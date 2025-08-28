"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserPlus, ShieldCheck, Shield, Mail, UserSearch } from "lucide-react";

// ===== Tipos =====
interface ProfileRow {
  user_id: string;
  org_id: string | null;
  nome: string | null;
  role: "owner" | "admin" | "viewer" | "financeiro" | "operador";
  membro_id: string | null;
  must_reset_password?: boolean | null;
  paused?: boolean | null;
}

interface MembroRow {
  id: string;
  nome: string;
  email: string | null;
  matricula: string | null;
  org_id: string | null;
  terreiro_id: string | null;
}

const ALL_ROLES: ProfileRow["role"][] = ["viewer", "operador", "financeiro", "admin", "owner"];
const NONE = "__NONE__";

export default function UsuariosPage() {
  const { toast } = useToast();

  // ===== Estado =====
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [team, setTeam] = useState<ProfileRow[]>([]);
  const [members, setMembers] = useState<MembroRow[]>([]);

  // criar usuário
  const [openCreate, setOpenCreate] = useState(false);
  const [newUserRole, setNewUserRole] = useState<ProfileRow["role"]>("viewer");
  const [newUserMembroId, setNewUserMembroId] = useState<string>(NONE);
  const [newUserPassword, setNewUserPassword] = useState<string>("");

  const selectedMember = useMemo(
    () => members.find((m) => m.id === newUserMembroId) || null,
    [members, newUserMembroId]
  );

  // ===== Helpers =====
  const ensureValidOrgId = async (): Promise<string> => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) throw new Error("Usuário não autenticado");

    const { data: profileRow, error: pErr } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (pErr) throw pErr;

    const org: string | null = (profileRow as any)?.org_id ?? null;

    if (!org) throw new Error("Org nulo/ inválido. Associe o usuário a um terreiro.");

    const { data: exists } = await supabase.from("terreiros").select("id").eq("id", org).maybeSingle();
    if (!exists?.id) throw new Error("Org inválido. Terreiro não encontrado.");

    return org;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const org = await ensureValidOrgId();
      setOrgId(org);

      const { data: d1, error: e1 } = await supabase
        .from("profiles")
        .select("user_id, org_id, nome, role, membro_id, must_reset_password, paused")
        .eq("org_id", org)
        .order("role", { ascending: true });
      if (e1) throw e1;
      setTeam((d1 ?? []) as ProfileRow[]);

      const { data: dm, error: em } = await supabase
        .from("membros")
        .select("id, nome, email, matricula, org_id, terreiro_id")
        .or(`org_id.eq.${org},terreiro_id.eq.${org}`)
        .order("nome", { ascending: true });
      if (em) throw em;
      setMembers((dm ?? []) as MembroRow[]);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao carregar dados",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== URL da Edge Function =====
  const getFunctionsUrl = () => {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const explicit = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
    if (explicit) return `${explicit.replace(/\/$/, "")}/create-user`;
    if (!base) return "";
    try {
      const u = new URL(base);
      const host = u.host.replace(".supabase.co", ".functions.supabase.co");
      return `${u.protocol}//${host}/create-user`;
    } catch {
      return "";
    }
  };

  // ===== Ações =====
  const createUser = async () => {
    try {
      const org = await ensureValidOrgId();

      if (newUserMembroId === NONE) {
        toast({
          title: "Selecione um membro",
          description: "Escolha um membro para promover a usuário.",
          variant: "destructive",
        });
        return;
      }

      const selected = members.find((m) => m.id === newUserMembroId);
      if (!selected?.email || !/\S+@\S+\.\S+/.test(selected.email)) {
        toast({
          title: "Membro sem e-mail válido",
          description: "Defina um e-mail no cadastro do membro.",
          variant: "destructive",
        });
        return;
      }

      if (!newUserPassword || newUserPassword.length < 8) {
        toast({
          title: "Senha inválida",
          description: "Defina uma senha com pelo menos 8 caracteres.",
          variant: "destructive",
        });
        return;
      }

      setBusy(true);

      // Token da sessão
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token ?? "";

      const bodyPayload = {
        org_id: org,
        membro_id: newUserMembroId,
        role: newUserRole,
        password: newUserPassword,
        email: selected.email,
        nome: selected.nome,
      };

      let createdUserId: string | undefined;

      // 1) Tenta via fetch (URL direta/derivada)
      const fnUrl = getFunctionsUrl() || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
      try {
        const resp = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify(bodyPayload),
        });

        let respPayload: any = null;
        let raw = "";
        try {
          respPayload = await resp.json();
        } catch {
          try {
            raw = await resp.text();
          } catch {
            // ignore
          }
        }

        if (!resp.ok) {
          const detail = respPayload?.error || respPayload?.message || raw || `${resp.status} ${resp.statusText}`;
          throw new Error(detail);
        }

        createdUserId = respPayload?.user_id as string | undefined;
      } catch (_httpErr) {
        // 2) Fallback: invoke
        const { data: altData, error: altErr } = await supabase.functions.invoke("create-user", {
          body: bodyPayload,
        });
        if (altErr) {
          const detailAlt = (altData as any)?.error || altErr.message || "Falha ao invocar create-user";
          throw new Error(detailAlt);
        }
        createdUserId = (altData as any)?.user_id as string | undefined;
      }

      // 3) Vincula profiles.membro_id (best-effort)
      if (createdUserId) {
        await supabase
          .from("profiles")
          .update({ membro_id: newUserMembroId })
          .eq("user_id", createdUserId)
          .eq("org_id", org);
      }

      toast({
        title: "Usuário criado",
        description: selected?.nome
          ? `"${selected.nome}" agora é usuário (${newUserRole}).`
          : "Usuário criado com sucesso.",
      });

      setOpenCreate(false);
      setNewUserMembroId(NONE);
      setNewUserRole("viewer");
      setNewUserPassword("");
      loadData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Falha ao criar usuário",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const setRole = async (user_id: string, role: ProfileRow["role"]) => {
    try {
      if (!orgId) throw new Error("org_id não definido");
      setBusy(true);
      const { error } = await supabase.from("profiles").update({ role }).eq("user_id", user_id).eq("org_id", orgId);
      if (error) throw error;
      toast({ title: "Papel atualizado", description: `Novo papel: ${role}` });
      loadData();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Falha ao atualizar papel", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const togglePaused = async (user_id: string, next: boolean) => {
    try {
      if (!orgId) throw new Error("org_id não definido");
      setBusy(true);
      const { error } = await supabase.from("profiles").update({ paused: next }).eq("user_id", user_id).eq("org_id", orgId);
      if (error) throw error;
      toast({ title: next ? "Usuário pausado" : "Usuário reativado" });
      loadData();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Falha ao atualizar status", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const forceResetPassword = async (user_id: string) => {
    try {
      if (!orgId) throw new Error("org_id não definido");
      setBusy(true);
      const { error } = await supabase
        .from("profiles")
        .update({ must_reset_password: true })
        .eq("user_id", user_id)
        .eq("org_id", orgId);
      if (error) throw error;
      toast({ title: "Reset de senha marcado" });
      loadData();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Falha ao marcar reset", description: err?.message ?? String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // ===== Render =====
  return (
    <DashboardLayout title="Usuários">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Equipe do terreiro</h2>
          <p className="text-sm text-muted-foreground">Gerencie quem pode acessar o sistema e seus papéis.</p>
        </div>
        <Button onClick={() => setOpenCreate(true)} disabled={loading || busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          Novo usuário
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários ({team.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Membro vinculado</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Reset</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((u) => {
                  const member = members.find((m) => m.id === u.membro_id);
                  return (
                    <TableRow key={u.user_id}>
                      <TableCell className="max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <div className="truncate">
                            <div className="font-medium truncate">{u.nome || u.user_id}</div>
                            {member?.email && (
                              <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {member.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="max-w-[220px]">
                        {member ? (
                          <div className="truncate">
                            <div className="font-medium truncate">{member.nome}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {member.matricula || "sem matrícula"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">(sem vínculo)</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Select
                          value={u.role}
                          onValueChange={(v) => setRole(u.user_id, v as ProfileRow["role"])}
                          disabled={busy}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={busy || !!u.must_reset_password}>
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              {u.must_reset_password ? "Marcado" : "Forçar reset"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Forçar redefinição de senha?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O usuário terá que redefinir a senha no próximo login.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => forceResetPassword(u.user_id)}>
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!u.paused}
                            onCheckedChange={(next) => togglePaused(u.user_id, next)}
                            disabled={busy}
                          />
                          <Badge variant={u.paused ? "secondary" : "default"}>
                            {u.paused ? "Pausado" : "Ativo"}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!loading && team.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Nenhum usuário neste terreiro ainda.
                    </TableCell>
                  </TableRow>
                )}

                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>

            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog criar usuário */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>Promova um membro a usuário do sistema. O membro precisa ter e-mail válido.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Membro</Label>
                <Select value={newUserMembroId} onValueChange={setNewUserMembroId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um membro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE} disabled>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UserSearch className="h-4 w-4" /> Selecione...
                      </div>
                    </SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{m.nome}</span>
                          <span className="text-xs text-muted-foreground">{m.email || "(sem e-mail)"}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as ProfileRow["role"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Senha inicial</Label>
                <Input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="mín. 8 caracteres"
                />
                <p className="text-xs text-muted-foreground">
                  Você pode compartilhar esta senha com o usuário ou marcar reset após criar.
                </p>
              </div>
            </div>

            {selectedMember && !selectedMember.email && (
              <div className="text-sm text-amber-600">
                O membro selecionado não possui e-mail cadastrado. Cadastre um e-mail no Módulo de Membros antes de promover.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpenCreate(false)}>
                Cancelar
              </Button>
              <Button onClick={createUser} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Criar usuário
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
