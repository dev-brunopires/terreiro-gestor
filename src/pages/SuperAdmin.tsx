// src/pages/SuperAdmin.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { Eye, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import {
  Building2, Plus, Edit, Trash2, Users, Shield, Search, SlidersHorizontal,
  DollarSign, MoreHorizontal, Settings2, Copy as CopyIcon, Share2
} from "lucide-react";

/** SUPERADMIN allowlist */
const SUPERADMINS = ["brunopdlaj@gmail.com"]; // ajuste os e-mails necessários

/** Senha padrão usada pela Edge create-user */
const DEFAULT_OWNER_PASSWORD = "Trocar123!";

/** Tipos alinhados ao BD */
export type Terreiro = {
  id: string;
  nome: string;
  created_at: string;
  logo_url?: string | null;
  email?: string | null;
  access_code?: string | null; // public.terreiros.access_code
};

export type RowWithCounts = Terreiro & { membros_count: number; usuarios_count: number };

export type SaasPlan = {
  id: string;
  nome: string;
  preco_centavos: number;
  ativo: boolean;
  descricao?: string | null;
};

export type OrgContract = {
  id: string;
  org_id: string;
  plan_id: string | null;
  inicio: string | null;
  fim: string | null;
  status: "ativo" | "expirado" | "cancelado";
  owner_email: string | null;
  plan?: SaasPlan | null;
};

export type FeatureRow = { id: string; plan_id: string; feature: string };

/** Leads */
type LeadStatus = "novo" | "em_analise" | "contatado" | "convertido" | "descartado";
type LeadRow = {
  id: string;
  created_at: string;
  nome: string;
  email: string;
  telefone: string | null;
  terreiro_nome: string;
  cidade_uf: string | null;
  tamanho_terreiro: string | null;
  plano: string;
  origem: string | null;
  status: LeadStatus;
  notes: string | null;
};

/** Catálogo de funcionalidades (saas_plan_features.feature) */
const ALL_FEATURES: Array<{ code: string; label: string }> = [
  { code: "membros",              label: "Membros" },
  { code: "planos",               label: "Planos" },
  { code: "assinaturas",          label: "Assinaturas" },
  { code: "faturas",              label: "Faturas" },
  { code: "mensalidades",         label: "Mensalidades" },
  { code: "pagamentos_diversos",  label: "Pagamentos diversos" },
  { code: "relatorios",           label: "Relatórios" },
  { code: "usuarios",             label: "Usuários" },
  { code: "pdv",                  label: "PDV" },
  { code: "configuracoes",        label: "Configurações" },
];

/** Edge Functions (com variações para compat e fallback) */
const EDGE = {
  TERREIRO_UPSERT: [
    "superadmin-upsert-terreiro",
    "admin-upsert-terreiro",
    "admin-create-terreiro",
    "upsert-terreiro",
  ],
  TERREIRO_DELETE: [
    "superadmin-delete-terreiro",
    "admin-delete-terreiro",
    "delete-terreiro",
  ],
  PLAN_UPSERT: [
    "superadmin-upsert-saas-plan",
    "admin-upsert-saas-plan",
    "admin-save-plan",
    "upsert-saas-plan",
  ],
  PLAN_DELETE: [
    "superadmin-delete-saas-plan",
    "admin-delete-saas-plan",
    "delete-saas-plan",
  ],
  SET_ORG_PLAN: [
    "superadmin-set-org-plan",
    "set-org-plan",
  ],
  CREATE_USER: [
    "superadmin-set-owner",
    "create-user",
  ],
} as const;

/** Copia texto com fallback quando navigator.clipboard não existir / não for seguro. */
async function safeCopyToClipboard(text: string) {
  try {
    if (typeof navigator !== "undefined" && (navigator as any)?.clipboard?.writeText && (window as any)?.isSecureContext) {
      await (navigator as any).clipboard.writeText(text);
      return true;
    }
    // Fallback: textarea + execCommand
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, ta.value.length); } catch {}
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (!ok) throw new Error("execCommand copy failed");
    return true;
  } catch (e) {
    console.error("[safeCopyToClipboard]", e);
    return false;
  }
}

/** Invoca Edge e tenta extrair mensagem detalhada do response */
async function callEdge(fnName: string, payload: any) {
  const { data, error } = await supabase.functions.invoke(fnName, { body: payload });
  if (!error) return data;

  let status = (error as any)?.status ?? (error as any)?.context?.response?.status ?? 0;
  let statusText = (error as any)?.context?.response?.statusText ?? "";
  let rawBody: any = null;
  let textBody = "";
  const headers: Record<string, string> = {};

  try {
    const resp: Response | undefined = (error as any)?.context?.response;
    if (resp) {
      const r1 = resp.clone();
      const r2 = resp.clone();
      r1.headers.forEach((v, k) => (headers[k] = v));
      try { rawBody = await r2.json(); }
      catch { try { textBody = await r2.text(); } catch { /* no-op */ } }
      status = resp.status;
      statusText = resp.statusText;
    }
  } catch { /* no-op */ }

  const detail = (
    (data as any)?.error ||
    rawBody?.error ||
    rawBody?.message ||
    textBody ||
    (error as any)?.message ||
    (status ? `HTTP ${status} ${statusText || ""}` : "Erro desconhecido")
  ).toString().trim();

  console.groupCollapsed(`[EDGE][${fnName}] non-2xx`);
  console.log("payload:", payload);
  console.log("status:", status, statusText);
  console.log("headers:", headers);
  console.log("data (invoke):", data);
  console.log("rawBody:", rawBody);
  console.log("textBody:", textBody);
  console.log("error object:", error);
  console.groupEnd();

  const err: any = new Error(detail);
  err.status = status || 0;
  err.fn = fnName;
  err.body = data ?? null;
  err.raw = error;
  throw err;
}

/** Tenta uma sequência de nomes de Edge com fallback p/ DB quando 404/405/0 */
async function tryFunctions(names: string[], payload: any) {
  let lastErr: any = null;
  for (const n of names) {
    try {
      return await callEdge(n, payload);
    } catch (e: any) {
      lastErr = e;
      const s = e?.status;
      if (s === 404 || s === 405 || s === 0 || s == null) continue; // edge ausente/transporte
      throw e; // erro “real”
    }
  }
  throw lastErr;
}

export default function SuperadminPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const allowed = !!user?.email && SUPERADMINS.map(e => e.toLowerCase()).includes(user.email.toLowerCase());

  // listagens
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<RowWithCounts[]>([]);
  const [contracts, setContracts] = useState<Record<string, OrgContract | null>>({});
  const [search, setSearch] = useState("");

  // diálogos de terreiros
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Terreiro | null>(null);
  const [nome, setNome] = useState("");

  // NOVOS: criar com owner
  const [novoOwnerEmail, setNovoOwnerEmail] = useState("");
  const [novoOwnerNome, setNovoOwnerNome] = useState("");

  // Lead: origem da criação (apenas esta parte é “modo antigo”)
  const [leadSourceId, setLeadSourceId] = useState<string | null>(null);

  // link owner
  const [linkDlgOpen, setLinkDlgOpen] = useState(false);
  const [linkOrg, setLinkOrg] = useState<Terreiro | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerNome, setOwnerNome] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  // SaaS Plans
  const [planos, setPlanos] = useState<SaasPlan[]>([]);
  const [featuresByPlan, setFeaturesByPlan] = useState<Record<string, string[]>>({});
  const [planDlgOpen, setPlanDlgOpen] = useState(false);
  const [planEditing, setPlanEditing] = useState<SaasPlan | null>(null);
  const [planNome, setPlanNome] = useState("");
  const [planPreco, setPlanPreco] = useState<string>("0");
  const [planAtivo, setPlanAtivo] = useState<boolean>(true);
  const [planDescricao, setPlanDescricao] = useState<string>("");

  // features
  const [featuresDlg, setFeaturesDlg] = useState(false);
  const [featuresPlano, setFeaturesPlano] = useState<SaasPlan | null>(null);
  const [editFeatures, setEditFeatures] = useState<string[]>([]);

  // LEADS
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<LeadStatus | "todos">("todos");
  const [leadDlgOpen, setLeadDlgOpen] = useState(false);
  const [leadViewing, setLeadViewing] = useState<LeadRow | null>(null);
  const [leadNotesDraft, setLeadNotesDraft] = useState("");

  // contrato do org
  const [contratoDlgOpen, setContratoDlgOpen] = useState(false);
  const [contratoTerreiro, setContratoTerreiro] = useState<Terreiro | null>(null);
  const [contratoPlanoId, setContratoPlanoId] = useState<string>("__none__");
  const [contratoInicio, setContratoInicio] = useState<string>("");
  const [contratoFim, setContratoFim] = useState<string>("");
  const [contratoStatus, setContratoStatus] = useState<OrgContract["status"]>("ativo");
  const [contratoOwnerEmail, setContratoOwnerEmail] = useState<string>("");

  useEffect(() => {
    if (!allowed) return;
    void loadTerreiros();
    void loadSaasPlans();
    void loadLeads();

    // Realtime: leads
    const ch = supabase
      .channel("realtime-superadmin-leads")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => { loadLeads(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [allowed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.nome.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.access_code ?? "").toLowerCase().includes(q) ||
      r.id.toLowerCase().startsWith(q)
    );
  }, [rows, search]);

  /** LEADS: busca + filtro */
  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    return leads.filter(l => {
      const hit =
        l.nome.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.telefone ?? "").toLowerCase().includes(q) ||
        l.terreiro_nome.toLowerCase().includes(q) ||
        (l.cidade_uf ?? "").toLowerCase().includes(q) ||
        l.plano.toLowerCase().includes(q);
      const statusOk = leadStatusFilter === "todos" ? true : l.status === leadStatusFilter;
      return hit && statusOk;
    });
  }, [leads, leadSearch, leadStatusFilter]);

  /** LOAD: terreiros + contratos (2 passos) + contadores */
  async function loadTerreiros() {
    try {
      setLoading(true);

      // 1) Terreiros base
      const { data: ts, error: terrErr } = await supabase
        .from("terreiros")
        .select("id, nome, created_at, logo_url, email, access_code")
        .order("nome", { ascending: true });
      if (terrErr) throw terrErr;

      const base: Terreiro[] = (ts ?? []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        created_at: t.created_at,
        logo_url: t.logo_url,
        email: t.email,
        access_code: t.access_code,
      }));

      const ids = base.map(b => b.id);
      const contractsDict: Record<string, OrgContract | null> = {};
      base.forEach(b => (contractsDict[b.id] = null));

      // 2) Contratos por org (join no plano)
      if (ids.length) {
        const { data: cs, error: cErr } = await supabase
          .from("saas_org_contracts")
          .select("id, org_id, plan_id, inicio, fim, status, owner_email, saas_plans(id, nome, preco_centavos, ativo, descricao)")
          .in("org_id", ids);
        if (cErr) throw cErr;

        for (const c of cs ?? []) {
          contractsDict[c.org_id] = {
            id: c.id,
            org_id: c.org_id,
            plan_id: c.plan_id,
            inicio: c.inicio,
            fim: c.fim,
            status: (c.status as OrgContract["status"]) ?? "ativo",
            owner_email: c.owner_email,
            plan: c.saas_plans
              ? {
                  id: c.saas_plans.id,
                  nome: c.saas_plans.nome,
                  preco_centavos: c.saas_plans.preco_centavos,
                  ativo: c.saas_plans.ativo,
                  descricao: c.saas_plans.descricao,
                }
              : null,
          };
        }
      }

      // 3) Contadores por org
      const withCounts: RowWithCounts[] = [];
      for (const b of base) {
        const orgId = b.id;
        const [{ count: usersCount }, { count: membByOrg }, { count: membByTerr }] = await Promise.all([
          supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("membros").select("id", { count: "exact", head: true }).eq("org_id", orgId),
          supabase.from("membros").select("id", { count: "exact", head: true }).eq("terreiro_id", orgId),
        ]);
        withCounts.push({
          ...b,
          usuarios_count: usersCount ?? 0,
          membros_count: Math.max(membByOrg ?? 0, membByTerr ?? 0),
        });
      }

      setRows(withCounts);
      setContracts(contractsDict);
    } catch (e: any) {
      toast({ title: "Erro ao carregar terreiros", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  /** LEADS: load */
  async function loadLeads() {
    try {
      setLeadsLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("id, created_at, nome, email, telefone, terreiro_nome, cidade_uf, tamanho_terreiro, plano, origem, status, notes")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLeads((data ?? []) as LeadRow[]);
    } catch (e: any) {
      toast({ title: "Erro ao carregar leads", description: e?.message ?? "Tente novamente", variant: "destructive" });
    } finally {
      setLeadsLoading(false);
    }
  }

  function openLead(row: LeadRow) {
    setLeadViewing(row);
    setLeadNotesDraft(row.notes ?? "");
    setLeadDlgOpen(true);
  }

  async function setLeadStatus(row: LeadRow, status: LeadStatus) {
    try {
      const { error } = await supabase.from("leads").update({ status }).eq("id", row.id);
      if (error) throw error;
      toast({ title: "Status atualizado", description: `${row.nome} → ${status}` });
      await loadLeads();
      if (leadViewing?.id === row.id) {
        setLeadViewing({ ...row, status });
      }
    } catch (e:any) {
      toast({ title: "Erro ao atualizar status", description: e?.message, variant: "destructive" });
    }
  }

  async function saveLeadNotes() {
    if (!leadViewing) return;
    try {
      const { error } = await supabase.from("leads").update({ notes: leadNotesDraft }).eq("id", leadViewing.id);
      if (error) throw error;
      toast({ title: "Anotações salvas" });
      setLeadDlgOpen(false);
      await loadLeads();
    } catch (e:any) {
      toast({ title: "Erro ao salvar anotações", description: e?.message, variant: "destructive" });
    }
  }

  async function deleteLead(row: LeadRow) {
    try {
      const { error } = await supabase.from("leads").delete().eq("id", row.id);
      if (error) throw error;
      toast({ title: "Lead excluído", description: row.nome });
      await loadLeads();
    } catch (e:any) {
      toast({ title: "Erro ao excluir lead", description: e?.message, variant: "destructive" });
    }
  }

  // Cria rapidamente um Terreiro a partir do lead (pré-preenche e abre seu diálogo existente)
  async function createOrgFromLead(row: LeadRow) {
    try {
      setDlgOpen(true);
      setEditing(null);
      setNome(row.terreiro_nome);
      setNovoOwnerEmail(row.email);
      setNovoOwnerNome(row.nome);

      // marca que esta criação veio de um lead -> ativa “modo antigo” no submit
      setLeadSourceId(row.id);

      toast({ title: "Pré-preenchido", description: "Abra o modal e clique em Salvar para criar o terreiro." });
    } catch (e:any) {
      toast({ title: "Falha ao preparar criação do terreiro", description: e?.message, variant: "destructive" });
    }
  }

  /** CRUD: terreiros (nome) com fallback */
  const openCreate = () => {
    setEditing(null);
    setNome("");
    setNovoOwnerEmail("");
    setNovoOwnerNome("");
    setLeadSourceId(null); // criação normal não vem de lead
    setDlgOpen(true);
  };
  const openEdit = (t: Terreiro) => { setEditing(t); setNome(t.nome); setDlgOpen(true); };

  const submitTerreiro = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!nome.trim()) throw new Error("Informe o nome do terreiro");

      // ======== MODO ANTIGO (APENAS quando veio de LEAD) ========
      if (!editing && leadSourceId) {
        // 1) cria terreiro direto no PostgREST
        const { data: ins, error: terrErr } = await supabase
          .from("terreiros")
          .insert({ nome: nome.trim(), email: (novoOwnerEmail?.trim() || null) })
          .select("id")
          .single();
        if (terrErr) throw terrErr;
        const createdOrgId = ins?.id as string | undefined;

        // 2) opcional: marcar lead como convertido
        try {
          await supabase.from("leads").update({ status: "convertido" }).eq("id", leadSourceId);
        } catch {}

        toast({ title: "Terreiro criado", description: nome });
        // limpa estado e recarrega
        setDlgOpen(false);
        setNome("");
        setNovoOwnerEmail("");
        setNovoOwnerNome("");
        setEditing(null);
        setLeadSourceId(null);
        await loadTerreiros();
        await loadLeads();

        // IMPORTANTE: não segue para o fluxo novo (Edge), encerra aqui
        return;
      }
      // ======== /MODO ANTIGO ========

      let createdOrgId: string | null = editing?.id ?? null;

      // 1) Upsert do terreiro (inclui email quando criando) — fluxo novo
      try {
        await tryFunctions([...EDGE.TERREIRO_UPSERT], {
          id: editing?.id ?? null,
          nome: nome.trim(),
          email: editing ? undefined : (novoOwnerEmail?.trim() || null),
        });
      } catch (err: any) {
        if (err?.status === 404 || err?.status === 405 || err?.status === 0 || err?.status == null) {
          if (editing?.id) {
            const { error } = await supabase.from("terreiros").update({ nome: nome.trim() }).eq("id", editing.id);
            if (error) throw error;
          } else {
            const { data, error } = await supabase
              .from("terreiros")
              .insert({ nome: nome.trim(), email: novoOwnerEmail?.trim() || null })
              .select("id")
              .single();
            if (error) throw error;
            createdOrgId = data?.id ?? null;
          }
        } else throw err;
      }

      // Descobre orgId caso seja criação via edge
      if (!createdOrgId) {
        const { data: trow, error: terrErr } = await supabase
          .from("terreiros")
          .select("id")
          .eq("nome", nome.trim())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (terrErr) throw terrErr;
        createdOrgId = trow?.id ?? editing?.id ?? null;
      }

      // 2) Se foi criação e tem e-mail de owner: cria usuário (Edge). Se falhar, avisa e segue.
      const email = (novoOwnerEmail || "").trim().toLowerCase();
      if (!editing && createdOrgId && email) {
        try {
          await tryFunctions([...EDGE.CREATE_USER], {
            email,
            password: DEFAULT_OWNER_PASSWORD,
            org_id: createdOrgId,
            role: "owner",
            nome: novoOwnerNome.trim() || null,
            membro_id: null,
          });
        } catch (err: any) {
          if (err?.status === 409 && /user_already_in_other_org/i.test(err?.message || err?.body?.error || "")) {
            throw new Error("Este e-mail já está vinculado a outra organização.");
          }
          const msg = err?.message || err?.body?.error || "Falha ao criar/associar o owner";
          toast({
            title: "Terreiro criado (owner pendente)",
            description: `${msg}. Você pode vincular o owner depois no menu "Vincular Owner".`,
            variant: "destructive",
          });
        }

        // garante email no terreiro
        try { await supabase.from("terreiros").update({ email }).eq("id", createdOrgId); } catch {}

        // owner_email no contrato (upsert)
        try { await supabase.from("saas_org_contracts").upsert([{ org_id: createdOrgId, plan_id: '', owner_email: email }], { onConflict: "org_id" }); } catch {}

        // cria membro matricula '0' se não existir
        const { data: m0, error: m0Err } = await supabase
          .from("membros")
          .select("id")
          .eq("org_id", createdOrgId)
          .eq("terreiro_id", createdOrgId)
          .eq("matricula", "0")
          .maybeSingle();
        if (!m0Err && !m0?.id) {
          const nomeMembro = novoOwnerNome?.trim() || "Responsável";
          try {
            await supabase.from("membros").insert({
              nome: nomeMembro,
              email: email,
              org_id: createdOrgId,
              terreiro_id: createdOrgId,
              ativo: true,
              matricula: "0",
              data_admissao_terreiro: new Date().toISOString().slice(0, 10),
            });
          } catch {}
        }
      }

      toast({ title: editing ? "Terreiro atualizado" : "Terreiro criado", description: nome });
      setDlgOpen(false);
      setNome("");
      setNovoOwnerEmail("");
      setNovoOwnerNome("");
      setEditing(null);
      setLeadSourceId(null);
      await loadTerreiros();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    }
  };

  const deleteTerreiro = async (t: Terreiro) => {
    try {
      try { await tryFunctions([...EDGE.TERREIRO_DELETE], { org_id: t.id }); }
      catch (err: any) {
        if (err?.status === 404 || err?.status === 405 || err?.status === 0 || err?.status == null) {
          const { error } = await supabase.from("terreiros").delete().eq("id", t.id);
          if (error) throw error;
        } else throw err;
      }
      toast({ title: "Terreiro excluído", description: t.nome });
      await loadTerreiros();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e?.message, variant: "destructive" });
    }
  };

  /** OWNER: criar usuário (via edge) e vincular ao org como owner */
  const openLinkOwner = (t: Terreiro) => {
    setLinkOrg(t);
    setOwnerEmail("");
    setOwnerNome("");
    setLinkDlgOpen(true);
  };

  const linkOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkOrg?.id) return;
    const email = ownerEmail.trim().toLowerCase();
    if (!email) return;

    try {
      setLinkSubmitting(true);

      try {
        await tryFunctions([...EDGE.CREATE_USER], {
          email,
          password: DEFAULT_OWNER_PASSWORD,
          org_id: linkOrg.id,
          role: "owner",
          nome: ownerNome.trim() || null,
          membro_id: null,
        });
      } catch (err: any) {
        if (err?.status === 409 && /user_already_in_other_org/i.test(err?.message || err?.body?.error || "")) {
          throw new Error("Este e-mail já está vinculado a outra organização.");
        }
        const msg = err?.message || err?.body?.error || "Falha ao criar/associar owner";
        toast({ title: "Erro ao vincular owner", description: msg, variant: "destructive" });
        return;
      }

      try { await supabase.from("terreiros").update({ email }).eq("id", linkOrg.id); } catch {}
      try { await supabase.from("saas_org_contracts").upsert([{ org_id: linkOrg.id, plan_id: '', owner_email: email }], { onConflict: "org_id" }); } catch {}

      const { data: m0, error: m0Err } = await supabase
        .from("membros")
        .select("id")
        .eq("org_id", linkOrg.id)
        .eq("terreiro_id", linkOrg.id)
        .eq("matricula", "0")
        .maybeSingle();
      if (!m0Err && !m0?.id) {
        const nomeMembro = ownerNome?.trim() || "Responsável";
        try {
          await supabase.from("membros").insert({
            nome: nomeMembro,
            email: email,
            org_id: linkOrg.id,
            terreiro_id: linkOrg.id,
            ativo: true,
            matricula: "0",
            data_admissao_terreiro: new Date().toISOString().slice(0, 10),
          });
        } catch {}
      }

      toast({ title: "Owner vinculado", description: `Usuário ${email} agora é owner de "${linkOrg.nome}".` });
      setLinkDlgOpen(false);
      setOwnerEmail("");
      setOwnerNome("");
      await loadTerreiros();
    } catch (e: any) {
      const msg = e?.message || e?.body?.error || e?.raw?.message || "Falha ao criar/associar owner";
      toast({ title: "Erro ao vincular owner", description: msg, variant: "destructive" });
    } finally {
      setLinkSubmitting(false);
    }
  };

  /** SaaS Plans + features */
  async function loadSaasPlans() {
    try {
      const { data: p, error: e1 } = await supabase
        .from("saas_plans")
        .select("id, nome, preco_centavos, ativo, descricao")
        .order("preco_centavos", { ascending: true });
      if (e1) throw e1;
      setPlanos(p ?? []);

      const { data: f, error: e2 } = await supabase
        .from("saas_plan_features")
        .select("id, plan_id, feature");
      if (e2) throw e2;

      const dict: Record<string, string[]> = {};
      (f ?? []).forEach((row: FeatureRow) => {
        dict[row.plan_id] = [...(dict[row.plan_id] || []), row.feature];
      });
      setFeaturesByPlan(dict);
    } catch (e: any) {
      toast({ title: "Planos do SaaS", description: e?.message, variant: "destructive" });
    }
  }

  const openPlan = (p?: SaasPlan) => {
    setPlanEditing(p ?? null);
    setPlanNome(p?.nome ?? "");
    setPlanPreco(p?.preco_centavos ? String(p.preco_centavos / 100) : "0");
    setPlanAtivo(p?.ativo ?? true);
    setPlanDescricao(p?.descricao ?? "");
    setPlanDlgOpen(true);
  };

  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        id: planEditing?.id ?? null,
        nome: planNome.trim(),
        preco_centavos: Math.round(Number(planPreco) * 100),
        ativo: planAtivo,
        descricao: planDescricao.trim() || null,
      };
      if (!payload.nome) throw new Error("Informe o nome do plano");

      try { await tryFunctions([...EDGE.PLAN_UPSERT], payload); }
      catch (err: any) {
        if (err?.status === 404 || err?.status === 405 || err?.status === 0 || err?.status == null) {
          if (payload.id) {
            const { error } = await supabase.from("saas_plans").update(payload).eq("id", payload.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("saas_plans").insert({
              nome: payload.nome,
              preco_centavos: payload.preco_centavos,
              ativo: payload.ativo,
              descricao: payload.descricao
            });
            if (error) throw error;
          }
        } else throw err;
      }

      toast({ title: planEditing ? "Plano atualizado" : "Plano criado", description: planNome });
      setPlanDlgOpen(false); await loadSaasPlans();
    } catch (e: any) {
      toast({ title: "Erro ao salvar plano", description: e?.message, variant: "destructive" });
    }
  };

  const deletePlan = async (p: SaasPlan) => {
    try {
      try { await tryFunctions([...EDGE.PLAN_DELETE], { id: p.id }); }
      catch (err: any) {
        if (err?.status === 404 || err?.status === 405 || err?.status === 0 || err?.status == null) {
          const { error: e1 } = await supabase.from("saas_org_contracts").update({ plan_id: null }).eq("plan_id", p.id);
          if (e1) throw e1;
          const { error: e2 } = await supabase.from("saas_plan_features").delete().eq("plan_id", p.id);
          if (e2) throw e2;
          const { error: e3 } = await supabase.from("saas_plans").delete().eq("id", p.id);
          if (e3) throw e3;
        } else throw err;
      }
      toast({ title: "Plano excluído", description: p.nome });
      await loadSaasPlans(); await loadTerreiros();
    } catch (e: any) {
      toast({ title: "Erro ao excluir plano", description: e?.message, variant: "destructive" });
    }
  };

  const openEditFeatures = (p: SaasPlan) => {
    const current = featuresByPlan[p.id] || [];
    setFeaturesPlano(p);
    setEditFeatures(current);
    setFeaturesDlg(true);
  };
  const toggleFeature = (code: string) =>
    setEditFeatures(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);

  const saveFeatures = async () => {
    if (!featuresPlano) return;
    try {
      await supabase.from("saas_plan_features").delete().eq("plan_id", featuresPlano.id);
      const inserts = editFeatures.map(feature => ({ plan_id: featuresPlano.id, feature }));
      if (inserts.length) await supabase.from("saas_plan_features").insert(inserts);
      toast({ title: "Funcionalidades salvas", description: `Plano ${featuresPlano.nome} atualizado` });
      setFeaturesDlg(false); await loadSaasPlans();
    } catch (e: any) {
      toast({ title: "Erro ao salvar features", description: e?.message, variant: "destructive" });
    }
  };

  /** CONTRATO por terreiro (saas_org_contracts — org_id UNIQUE) */
  const openContrato = (t: Terreiro) => {
    const c = contracts[t.id] ?? null;
    setContratoTerreiro(t);
    setContratoPlanoId(c?.plan_id ?? "__none__");
    setContratoInicio(c?.inicio ?? "");
    setContratoFim(c?.fim ?? "");
    setContratoStatus((c?.status as OrgContract["status"]) ?? "ativo");
    setContratoOwnerEmail(c?.owner_email ?? "");
    setContratoDlgOpen(true);
  };

  const saveContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratoTerreiro) return;
    try {
      const isNone = !contratoPlanoId || contratoPlanoId === "__none__";

      if (isNone) {
        try {
          await tryFunctions([...EDGE.SET_ORG_PLAN], {
            org_id: contratoTerreiro.id,
            plano_id: null,
            inicio: contratoInicio || null,
            fim: contratoFim || null,
            status: contratoStatus,
            owner_email: contratoOwnerEmail || null
          });
        } catch (err: any) {
          if (err?.status === 404 || err?.status === 405 || err?.status === 0 || err?.status == null) {
            await supabase.from("saas_org_contracts").delete().eq("org_id", contratoTerreiro.id);
          } else throw err;
        }
      } else {
        const payload = {
          org_id: contratoTerreiro.id,
          plan_id: contratoPlanoId,
          inicio: contratoInicio || null,
          fim: contratoFim || null,
          status: contratoStatus,
          owner_email: contratoOwnerEmail || null
        };
        try {
          await tryFunctions([...EDGE.SET_ORG_PLAN], { ...payload, plano_id: payload.plan_id });
        } catch (err: any) {
          if (err?.status === 404 || err?.status === 405 || err?.status === 0 || err?.status == null) {
            await supabase.from("saas_org_contracts").upsert(payload, { onConflict: "org_id" });
          } else throw err;
        }
      }
      toast({ title: "Contrato salvo", description: `${contratoTerreiro.nome}` });
      setContratoDlgOpen(false); await loadTerreiros();
    } catch (e: any) {
      toast({ title: "Erro ao salvar contrato", description: e?.message, variant: "destructive" });
    }
  };

  /** utils: copiar/compartilhar access_code */
  const onCopyAccessCode = async (code?: string | null) => {
    if (!code) return;
    const ok = await safeCopyToClipboard(code);
    if (ok) {
      toast({ title: "Copiado", description: `Código de acesso: ${code}` });
    } else {
      toast({ title: "Falha ao copiar", description: "Seu navegador bloqueou o acesso à área de transferência. Copie manualmente.", variant: "destructive" });
    }
  };

  const onShareAccessCode = async (t: Terreiro) => {
    const code = t.access_code ?? "";
    if (!code) return;
    const shareText = `Código de acesso ao Terreiro "${t.nome}": ${code}`;
    const shareUrl = typeof window !== "undefined" ? window.location.origin : "";

    try {
      if ((navigator as any)?.share) {
        await (navigator as any).share({ title: "Código de acesso", text: shareText, url: shareUrl });
      } else {
        const ok = await safeCopyToClipboard(`${shareText}\n${shareUrl}`);
        if (ok) {
          toast({ title: "Copiado", description: "Conteúdo copiado para compartilhar." });
        } else {
          toast({ title: "Falha ao copiar", description: "Seu navegador bloqueou o acesso à área de transferência.", variant: "destructive" });
        }
      }
    } catch (e: any) {
      toast({ title: "Falha ao compartilhar", description: e?.message ?? "Erro desconhecido", variant: "destructive" });
    }
  };

  if (!allowed) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Card>
            <CardHeader><CardTitle>Acesso negado</CardTitle></CardHeader>
            <CardContent>Seu usuário não é um Superadmin autorizado.</CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" /> Superadmin
            </h1>
            <p className="text-muted-foreground">Gerencie terreiros, planos do SaaS e contratos.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openCreate} className="bg-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />Novo Terreiro
            </Button>
            <Button variant="outline" onClick={() => setPlanDlgOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Novo Plano SaaS
            </Button>
          </div>
        </div>

        {/* Filtros gerais */}
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, e-mail ou código" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* ===== LEADS: caixa de gestão de leads ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Leads recebidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9 w-[280px]" placeholder="Buscar lead…" value={leadSearch} onChange={e => setLeadSearch(e.target.value)} />
                </div>
                <Select value={leadStatusFilter} onValueChange={(v:any)=>setLeadStatusFilter(v)}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="em_analise">Em análise</SelectItem>
                    <SelectItem value="contatado">Contatado</SelectItem>
                    <SelectItem value="convertido">Convertido</SelectItem>
                    <SelectItem value="descartado">Descartado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">
                {leadsLoading ? "Carregando…" : `${filteredLeads.length} lead(s)`}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Nome / Contato</TableHead>
                  <TableHead>Terreiro</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[1%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsLoading ? (
                  <TableRow><TableCell colSpan={6}>Carregando…</TableCell></TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>Nenhum lead.</TableCell></TableRow>
                ) : filteredLeads.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{l.nome}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="h-3.5 w-3.5" />{l.email}</a>
                        {l.telefone ? (
                          <a
                            href={`https://wa.me/${l.telefone.replace(/\D/g,"")}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <Phone className="h-3.5 w-3.5" />{l.telefone}
                          </a>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{l.terreiro_nome}</div>
                      <div className="text-xs text-muted-foreground">{l.cidade_uf || "—"} {l.tamanho_terreiro ? `• ${l.tamanho_terreiro}` : ""}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{l.plano}</TableCell>
                    <TableCell>
                      <Select value={l.status} onValueChange={(v:any)=>setLeadStatus(l, v)}>
                        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="em_analise">Em análise</SelectItem>
                          <SelectItem value="contatado">Contatado</SelectItem>
                          <SelectItem value="convertido">Convertido</SelectItem>
                          <SelectItem value="descartado">Descartado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={(e)=>{e.preventDefault(); openLead(l);}}>
                            <Eye className="h-4 w-4 mr-2" /> Detalhes / Notas
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e)=>{e.preventDefault(); createOrgFromLead(l);}}>
                            <Building2 className="h-4 w-4 mr-2" /> Criar Terreiro…
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e)=>e.preventDefault()}>
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir lead de {l.nome}?</AlertDialogTitle>
                                <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-red-600" onClick={()=>deleteLead(l)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Lista de terreiros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Terreiros</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código de acesso</TableHead>
                  <TableHead className="text-right">Usuários</TableHead>
                  <TableHead className="text-right">Membros</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="w-[1%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6}>Carregando…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>Nenhum terreiro encontrado.</TableCell></TableRow>
                ) : (
                  filtered.map(t => {
                    const c = contracts[t.id] ?? null;
                    const emailToShow = t.email || c?.owner_email || "";
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="font-medium">{t.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            {emailToShow || "sem e-mail"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {t.access_code ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Badge>access: {t.access_code}</Badge>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onCopyAccessCode(t.access_code)} title="Copiar"><CopyIcon className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onShareAccessCode(t)} title="Compartilhar"><Share2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{t.usuarios_count}</TableCell>
                        <TableCell className="text-right">{t.membros_count}</TableCell>
                        <TableCell>
                          {c ? (
                            <div className="flex items-center gap-2">
                              <Badge variant={c.status === "ativo" ? "default" : c.status === "cancelado" ? "destructive" : "secondary"}>
                                {c.plan?.nome || "Sem plano"}
                              </Badge>
                              {c.fim && <span className="text-xs text-muted-foreground">até {new Date(c.fim).toLocaleDateString("pt-BR")}</span>}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">Sem contrato</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openEdit(t); }}>
                                <Edit className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openContrato(t); }}>
                                <Settings2 className="h-4 w-4 mr-2" /> Contrato/Plano
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openLinkOwner(t); }}>
                                <Users className="h-4 w-4 mr-2" /> Vincular Owner
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir {t.nome}?</AlertDialogTitle>
                                    <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction className="bg-red-600" onClick={() => deleteTerreiro(t)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Planos do SaaS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" /> Planos do SaaS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Button size="sm" onClick={() => openPlan()}><Plus className="h-4 w-4 mr-2" />Novo Plano</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[1%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planos.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.preco_centavos / 100)}
                    </TableCell>
                    <TableCell>{p.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}</TableCell>
                    <TableCell className="max-w-[420px] truncate text-sm text-muted-foreground">{p.descricao || "—"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openPlan(p); }}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openEditFeatures(p); }}>
                            <SlidersHorizontal className="h-4 w-4 mr-2" /> Funcionalidades
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="h-4 w-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir plano {p.nome}?</AlertDialogTitle>
                                <AlertDialogDescription>Não é possível desfazer.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction className="bg-red-600" onClick={() => deletePlan(p)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog: criar/editar terreiro */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Terreiro" : "Novo Terreiro"}</DialogTitle>
            <DialogDescription>Somente o campo nome é obrigatório. O código de acesso é gerado pelo sistema.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitTerreiro} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Terreiro de Iemanjá" />
            </div>

            {!editing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>E-mail do owner (opcional)</Label>
                  <Input
                    type="email"
                    value={novoOwnerEmail}
                    onChange={e => setNovoOwnerEmail(e.target.value)}
                    placeholder="owner@exemplo.com"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se informado, cria o usuário owner, define a matrícula <b>0</b> como membro e grava o e-mail no terreiro.
                  </p>
                </div>
                <div>
                  <Label>Nome do owner (opcional)</Label>
                  <Input
                    value={novoOwnerNome}
                    onChange={e => setNovoOwnerNome(e.target.value)}
                    placeholder="Nome do responsável"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDlgOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* LEADS: Dialog detalhes/notas */}
      <Dialog open={leadDlgOpen} onOpenChange={setLeadDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lead — {leadViewing?.nome}</DialogTitle>
            <DialogDescription>
              Recebido em {leadViewing ? new Date(leadViewing.created_at).toLocaleString("pt-BR") : "—"}
            </DialogDescription>
          </DialogHeader>

          {leadViewing && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Contato</Label>
                  <div className="text-sm">
                    <a href={`mailto:${leadViewing.email}`} className="hover:underline flex gap-2 items-center">
                      <Mail className="h-4 w-4" /> {leadViewing.email}
                    </a>
                    {leadViewing.telefone ? (
                      <a
                        href={`https://wa.me/${leadViewing.telefone.replace(/\D/g,"")}`}
                        target="_blank"
                        className="hover:underline flex gap-2 items-center"
                      >
                        <Phone className="h-4 w-4" /> {leadViewing.telefone}
                      </a>
                    ) : null}
                  </div>
                </div>
                <div>
                  <Label>Plano</Label>
                  <div className="text-sm">{leadViewing.plano}</div>
                </div>
                <div>
                  <Label>Terreiro</Label>
                  <div className="text-sm">{leadViewing.terreiro_nome}</div>
                </div>
                <div>
                  <Label>Cidade/UF — Tamanho</Label>
                  <div className="text-sm">{leadViewing.cidade_uf || "—"} {leadViewing.tamanho_terreiro ? `• ${leadViewing.tamanho_terreiro}` : ""}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={leadViewing.status} onValueChange={(v:any)=> setLeadStatus(leadViewing, v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="em_analise">Em análise</SelectItem>
                      <SelectItem value="contatado">Contatado</SelectItem>
                      <SelectItem value="convertido">Convertido</SelectItem>
                      <SelectItem value="descartado">Descartado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Anotações internas</Label>
                <textarea
                  className="w-full min-h-[120px] border rounded-md p-2 text-sm"
                  value={leadNotesDraft}
                  onChange={e=>setLeadNotesDraft(e.target.value)}
                  placeholder="Ex.: falou no WhatsApp, pediu demo para sexta…"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={()=>setLeadDlgOpen(false)}>Fechar</Button>
                <Button onClick={saveLeadNotes}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: vincular owner */}
      <Dialog open={linkDlgOpen} onOpenChange={setLinkDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Owner</DialogTitle>
            <DialogDescription>Cria (ou associa) um usuário como owner deste terreiro.</DialogDescription>
          </DialogHeader>
          <form onSubmit={linkOwner} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Terreiro</Label>
                <Input value={linkOrg?.nome || ""} disabled />
              </div>
              <div>
                <Label>E-mail do owner</Label>
                <Input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} required />
                <p className="mt-1 text-xs text-muted-foreground">
                  Será criada uma conta com senha padrão <span className="font-medium">{DEFAULT_OWNER_PASSWORD}</span> e exigência de troca no primeiro acesso.
                </p>
              </div>
              <div className="md:col-span-2">
                <Label>Nome (opcional)</Label>
                <Input value={ownerNome} onChange={e => setOwnerNome(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLinkDlgOpen(false)} disabled={linkSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={linkSubmitting}>
                {linkSubmitting ? "Vinculando…" : "Vincular"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: criar/editar plano */}
      <Dialog open={planDlgOpen} onOpenChange={setPlanDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{planEditing ? "Editar Plano" : "Novo Plano"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePlan} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={planNome} onChange={e => setPlanNome(e.target.value)} required />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={planPreco} onChange={e => setPlanPreco(e.target.value)} min={0} />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <Input value={planDescricao} onChange={e => setPlanDescricao(e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={planAtivo ? "ativo" : "inativo"} onValueChange={v => setPlanAtivo(v === "ativo") }>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPlanDlgOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: features do plano */}
      <Dialog open={featuresDlg} onOpenChange={setFeaturesDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Funcionalidades — {featuresPlano?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {ALL_FEATURES.map(f => (
                <label key={f.code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editFeatures.includes(f.code)} onChange={() => toggleFeature(f.code)} />
                  {f.label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFeaturesDlg(false)}>Fechar</Button>
              <Button onClick={saveFeatures}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: contrato/plano do terreiro */}
      <Dialog open={contratoDlgOpen} onOpenChange={setContratoDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contrato — {contratoTerreiro?.nome}</DialogTitle>
            <DialogDescription>Defina o plano do SaaS e o período do contrato para este terreiro (org).</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveContrato} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Plano</Label>
                <Select value={contratoPlanoId} onValueChange={setContratoPlanoId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano ou deixe em branco" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem plano —</SelectItem>
                    {planos.map(p => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={contratoStatus} onValueChange={(v: any) => setContratoStatus(v)}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="expirado">Expirado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Início</Label>
                <Input type="date" value={contratoInicio || ""} onChange={e => setContratoInicio(e.target.value)} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={contratoFim || ""} onChange={e => setContratoFim(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>E-mail do responsável (owner)</Label>
                <Input type="email" value={contratoOwnerEmail} onChange={e => setContratoOwnerEmail(e.target.value)} placeholder="owner@exemplo.com" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setContratoDlgOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
