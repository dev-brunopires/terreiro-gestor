"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import FeatureGate from "@/components/FeatureGate";
import UpgradeCard from "@/components/UpgradeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Loader2, UserPlus, ShieldCheck, Mail, Trash2, ChevronsUpDown, Search, User2 } from "lucide-react";

// shadcn/ui combobox (Command) + Popover
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

/* =========================================================================================
   MembroPicker — Combobox com busca (nome/matrícula/e-mail) + paginação com Supabase
   ========================================================================================= */

type MembroLite = {
  id: string;
  nome: string;
  email: string | null;
  matricula: string | null;
  org_id: string | null;
  terreiro_id: string | null;
};

type MembroPickerProps = {
  orgId: string | null;
  value: string | null; // membro_id atual (ou null/"__NONE__")
  onChange: (next: string | "__NONE__") => void;
  placeholder?: string;
  className?: string;
  allowNone?: boolean;
  disabled?: boolean;
  buttonClassName?: string;
};

// debounce simples p/ evitar flood de requisições
function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function MembroPicker({
  orgId,
  value,
  onChange,
  placeholder = "Selecione um membro",
  className,
  allowNone = false,
  disabled = false,
  buttonClassName,
}: MembroPickerProps) {
  const NONE_LOCAL = "__NONE__";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 350);

  const PAGE = 20;
  const pageRef = useRef(0);
  const [rows, setRows] = useState<MembroLite[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const fetchingRef = useRef(false);

  const selected = useMemo(() => rows.find((r) => r.id === value) ?? null, [rows, value]);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!orgId || fetchingRef.current) return;

      fetchingRef.current = true;
      setLoading(true);
      try {
        const like = debouncedQ?.trim() ? `%${debouncedQ.trim()}%` : null;

        const pageNow = reset ? 0 : pageRef.current;
        const from = pageNow * PAGE;
        const to = from + PAGE - 1;

        let query = supabase
          .from("membros")
          .select("id, nome, email, matricula, org_id, terreiro_id")
          .order("nome", { ascending: true })
          .range(from, to);

        if (like) {
          // único .or com grupos and(...)
          const group = [
            `and(org_id.eq.${orgId},nome.ilike.${like})`,
            `and(org_id.eq.${orgId},matricula.ilike.${like})`,
            `and(org_id.eq.${orgId},email.ilike.${like})`,
            `and(terreiro_id.eq.${orgId},nome.ilike.${like})`,
            `and(terreiro_id.eq.${orgId},matricula.ilike.${like})`,
            `and(terreiro_id.eq.${orgId},email.ilike.${like})`,
          ].join(",");
          query = query.or(group);
        } else {
          query = query.or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`);
        }

        const { data, error } = await query;
        if (error) throw error;

        const newRows = (data ?? []) as MembroLite[];
        if (reset) setRows(newRows);
        else setRows((prev) => [...prev, ...newRows]);

        const hasNext = newRows.length === PAGE;
        setHasMore(hasNext);
        pageRef.current = pageNow + (hasNext ? 1 : 0);
      } catch (e) {
        console.error("MembroPicker.fetchPage error:", e);
        setHasMore(false);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [orgId, debouncedQ]
  );

  // carrega ao abrir / mudar a busca
  useEffect(() => {
    if (!open || !orgId) return;
    pageRef.current = 0;
    setRows([]);
    setHasMore(true);
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgId, debouncedQ]);

  // garante que o item selecionado apareça
  useEffect(() => {
    const ensureSelectedVisible = async () => {
      if (!orgId || !value || value === NONE_LOCAL) return;
      if (rows.some((r) => r.id === value)) return;
      const { data, error } = await supabase
        .from("membros")
        .select("id, nome, email, matricula, org_id, terreiro_id")
        .eq("id", value)
        .maybeSingle();
      if (!error && data) {
        setRows((prev) => (prev.some((p) => p.id === data.id) ? prev : [data as MembroLite, ...prev]));
      }
    };
    ensureSelectedVisible();
  }, [orgId, value, rows]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("w-[260px] justify-between", buttonClassName)}
          disabled={disabled}
        >
          {value === NONE_LOCAL
            ? "(sem vínculo)"
            : selected ? (
              <span className="truncate text-left">
                {selected.nome}
                {selected.matricula ? ` • ${selected.matricula}` : ""}
                {selected.email ? ` • ${selected.email}` : ""}
              </span>
            ) : (
              placeholder
            )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className={cn("p-0 w-[420px]", className)} align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center px-2 py-2 gap-2">
            <Search className="h-4 w-4 opacity-60" />
            <CommandInput
              placeholder="Buscar por nome, matrícula ou e-mail…"
              value={q}
              onValueChange={(v) => setQ(v)}
            />
          </div>

          <CommandList className="max-h-72">
            <CommandEmpty>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : (
                <div className="py-4 text-sm text-muted-foreground">Nenhum membro encontrado.</div>
              )}
            </CommandEmpty>

            <CommandGroup heading="Membros">
              {allowNone && (
                <CommandItem
                  value="__NONE__"
                  onSelect={() => {
                    onChange("__NONE__");
                    setOpen(false);
                  }}
                >
                  (sem vínculo)
                </CommandItem>
              )}

              {rows.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <User2 className="h-4 w-4 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="font-medium leading-tight">{m.nome}</span>
                      <span className="text-xs text-muted-foreground leading-tight">
                        {m.matricula ?? "sem matrícula"}
                        {m.email ? ` • ${m.email}` : ""}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>

          <div className="border-t p-2">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => fetchPage(false)}
              disabled={!hasMore || loading}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {hasMore ? "Carregar mais" : "Fim da lista"}
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* =========================================================================================
   Página de Usuários
   ========================================================================================= */

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

  // Popover controlado do papel (create)
  const [openRoleCreate, setOpenRoleCreate] = useState(false);

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

      // Lista leve para exibir nome/email do membro vinculado na tabela
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

  // ===== Edge Functions URLs =====
  const getFunctionsUrlCreate = () => {
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

  const getFunctionsUrlDelete = () => {
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const explicit = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;
    if (explicit) return `${explicit.replace(/\/$/, "")}/delete-user`;
    if (!base) return "";
    try {
      const u = new URL(base);
      const host = u.host.replace(".supabase.co", ".functions.supabase.co");
      return `${u.protocol}//${host}/delete-user`;
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

      // Busca o membro diretamente no banco (garante dados atuais)
      const { data: member, error: mErr } = await supabase
        .from("membros")
        .select("id, nome, email")
        .eq("id", newUserMembroId)
        .maybeSingle();

      if (mErr) throw mErr;

      const email = (member?.email ?? "").trim();
      const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!member || !hasValidEmail) {
        toast({
          title: "Membro sem e-mail válido",
          description: "Defina um e-mail no cadastro do membro antes de promover.",
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
        email,            // usa o e-mail validado do DB
        nome: member.nome // usa o nome do DB
      };

      let createdUserId: string | undefined;

      const fnUrl =
        getFunctionsUrlCreate() || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;

      let respPayload: any = null;
      let raw = "";

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

        try { respPayload = await resp.json(); } catch { try { raw = await resp.text(); } catch {} }

        if (!resp.ok) {
          // ❗ NON-2xx: tenta fallback invoke antes de falhar
          const { data: altData, error: altErr } = await supabase.functions.invoke("create-user", {
            body: bodyPayload,
          });
          if (altErr) {
            const detail =
              respPayload?.error || respPayload?.message || raw || altErr.message || "Falha ao criar usuário";
            throw new Error(detail);
          }
          createdUserId = (altData as any)?.user_id as string | undefined;
        } else {
          createdUserId = respPayload?.user_id as string | undefined;
        }
      } catch (netErr: any) {
        // Erro de rede no fetch: tenta invoke
        const { data: altData, error: altErr } = await supabase.functions.invoke("create-user", {
          body: bodyPayload,
        });
        if (altErr) {
          throw new Error(altErr.message || String(netErr));
        }
        createdUserId = (altData as any)?.user_id as string | undefined;
      }

      if (!createdUserId) {
        throw new Error("Não foi possível obter o user_id da criação.");
      }

      // Best-effort: vincula profiles.membro_id ao membro promovido (se existir o profile recem-criado)
      try {
        await supabase
          .from("profiles")
          .update({ membro_id: newUserMembroId })
          .eq("user_id", createdUserId)
          .eq("org_id", org);
      } catch {
        // silencioso
      }

      toast({
        title: "Usuário criado",
        description: `"${member.nome}" agora é usuário (${newUserRole}).`,
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

  // ===== Vincular / desvincular membro =====
  const setMemberLink = async (user_id: string, membroIdOrNone: string) => {
    try {
      if (!orgId) throw new Error("org_id não definido");
      setBusy(true);
      const membro_id = membroIdOrNone === NONE ? null : membroIdOrNone;
      const { error } = await supabase
        .from("profiles")
        .update({ membro_id })
        .eq("user_id", user_id)
        .eq("org_id", orgId);
      if (error) throw error;

      toast({
        title: membro_id ? "Vínculo atualizado" : "Vínculo removido",
        description: membro_id ? "Usuário vinculado ao membro selecionado." : "Usuário agora está sem vínculo.",
      });
      loadData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Falha ao atualizar vínculo",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // ===== Excluir usuário =====

  const deleteUser = async (user_id: string) => {
    try {
      if (!orgId) throw new Error("org_id não definido");
      setBusy(true);

      // Chama a Edge Function correta (admin-delete-user)
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id, org_id: orgId },
      });

      if (error) {
        // Fallback: se a função não estiver deployada, remove só de profiles
        const { error: delErr } = await supabase
          .from("profiles")
          .delete()
          .eq("user_id", user_id)
          .eq("org_id", orgId);

        if (delErr) throw delErr;

        toast({
          title: "Usuário removido (profiles)",
          description:
            "Removido apenas da tabela profiles. Para remover do Auth, publique a Edge Function admin-delete-user com SERVICE_ROLE_KEY.",
        });
      } else {
        toast({ title: "Usuário excluído com sucesso" });
      }

      loadData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Falha ao excluir usuário",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };


  // ===== Render =====
  return (
    <DashboardLayout title="Usuários">
      <FeatureGate code="usuarios" fallback={<UpgradeCard needed="Usuários" />}>
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((u) => {
                    const member = members.find((m) => m.id === u.membro_id);
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="max-w-[260px]">
                          {member ? (
                            <div className="flex flex-col leading-tight">
                              <span className="font-medium truncate">{member.nome}</span>
                              {member.email && (
                                <span className="text-[12px] text-muted-foreground truncate flex items-center gap-1">
                                  <Mail className="h-3 w-3" /> {member.email}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">(sem vínculo)</span>
                          )}
                        </TableCell>

                        <TableCell className="max-w-[260px]">
                          <MembroPicker
                            orgId={orgId}
                            value={u.membro_id ?? "__NONE__"}
                            onChange={(val) => setMemberLink(u.user_id, val)}
                            allowNone
                            disabled={busy}
                            buttonClassName="h-9 text-sm w-[260px]"
                          />
                        </TableCell>

                        <TableCell>
                          <div className="w-[160px]">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                  {u.role}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0 w-[200px]">
                                <Command>
                                  <CommandInput placeholder="Buscar papel…" />
                                  <CommandList>
                                    <CommandEmpty>Nenhum papel</CommandEmpty>
                                    <CommandGroup>
                                      {ALL_ROLES.map((r) => (
                                        <CommandItem key={r} onSelect={() => setRole(u.user_id, r)}>
                                          {r}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
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

                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={busy}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação é permanente. Se a Edge Function <code>delete-user</code> estiver configurada
                                  com chave de serviço, o usuário será removido do Auth. Caso contrário, será removido
                                  apenas de <code>profiles</code>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteUser(u.user_id)}>
                                  Confirmar exclusão
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {!loading && team.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                        Nenhum usuário neste terreiro ainda.
                      </TableCell>
                    </TableRow>
                  )}

                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
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
              <DialogDescription>
                Promova um membro a usuário do sistema. O membro precisa ter e-mail válido.
              </DialogDescription>
            </DialogHeader>

            {/* ===== CONTEÚDO DO DIALOG ===== */}
            <div className="space-y-4">
              {/* GRID: Membro + Papel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coluna: Membro */}
                <div className="space-y-2">
                  <Label>Membro</Label>
                  <MembroPicker
                    orgId={orgId}
                    value={newUserMembroId}
                    onChange={(val) => setNewUserMembroId(val)}
                    placeholder="Selecione um membro"
                    disabled={busy}
                    buttonClassName="w-full"
                  />
                </div>

                {/* Coluna: Papel */}
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Popover open={openRoleCreate} onOpenChange={setOpenRoleCreate}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {newUserRole}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[240px]">
                      <Command>
                        <CommandInput placeholder="Buscar papel…" />
                        <CommandList>
                          <CommandEmpty>Nenhum papel</CommandEmpty>
                          <CommandGroup>
                            {ALL_ROLES.map((r) => (
                              <CommandItem
                                key={r}
                                onSelect={() => {
                                  setNewUserRole(r as ProfileRow["role"]);
                                  setOpenRoleCreate(false); // fecha o popover ao selecionar
                                }}
                              >
                                {r}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>{/* fecha grid Membro+Papel */}

              {/* GRID: Senha */}
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
            {/* ===== FIM DO CONTEÚDO DO DIALOG ===== */}
          </DialogContent>
        </Dialog>
      </FeatureGate>
    </DashboardLayout>
  );
}
