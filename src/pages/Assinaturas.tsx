// src/pages/Assinaturas.tsx
"use client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Edit,
  Trash2,
  FileText,
  Search,
  ArrowUpDown,
  Wand2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import FeatureGate from "@/components/FeatureGate";
import UpgradeCard from "@/components/UpgradeCard";

interface Assinatura {
  id: string;
  inicio: string;
  fim?: string | null;
  status: "ativa" | "pausada" | "cancelada";
  membro: { id: string; nome: string; matricula?: string | null };
  plano: { id: string; nome: string; valor_centavos: number; dia_vencimento?: number | null };
  created_at: string;
}

interface Membro {
  id: string;
  nome: string;
  matricula?: string | null;
  ativo?: boolean; // <- usado para filtrar
}

interface Plano {
  id: string;
  nome: string;
  valor_centavos: number;
  dia_vencimento?: number | null;
}

type StatusAss = "ativa" | "pausada" | "cancelada";
type SortKey = "nome" | "matricula" | "plano" | "valor" | "inicio";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function Assinaturas() {
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssinatura, setEditingAssinatura] = useState<Assinatura | null>(null);
  const referFromISO = (iso: string) => iso.slice(0, 7).replace("-", "");

  // “Gerar Faltantes”
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSelectedPlanoId, setBulkSelectedPlanoId] = useState<string>("");
  const [bulkMissingMembers, setBulkMissingMembers] = useState<Membro[]>([]);
  const [bulkGerarFaturas, setBulkGerarFaturas] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusAss>("all");
  const { toast } = useToast();

  const [orgIdState, setOrgIdState] = useState<string | null>(null);

  // Ordenação
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Seleção de membro no modal de Nova Assinatura
  const [membroDialogOpen, setMembroDialogOpen] = useState(false);
  const [membroQuery, setMembroQuery] = useState("");

  // Paginação
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState<number>(1);

  // ===== Helpers / utils =====
  async function parseSbError(err: any): Promise<string> {
    if (!err) return "Erro desconhecido";
    const basic = err.message || err.error_description || err.hint || String(err);
    try {
      const body = err?.context?.body;
      if (body && typeof body.getReader === "function") {
        const txt = await new Response(body).text();
        try {
          const j = JSON.parse(txt);
          return j.message || j.error || basic;
        } catch {
          return txt || basic;
        }
      }
    } catch {}
    return basic;
  }
  const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  const isUUID = (v?: string | null) => !!v && UUID_RE.test(v);
  const originalPlanoIdRef = useRef<string | null>(null);
  const originalInicioRef = useRef<string | null>(null);
  const originalFimRef = useRef<string | null>(null);
  const originalStatusRef = useRef<StatusAss | null>(null);

  const ymd = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const formatCurrency = (c: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
  const getStatusBadge = (status: StatusAss) => {
    const variants: Record<StatusAss, "default" | "secondary" | "destructive"> = {
      ativa: "default",
      pausada: "secondary",
      cancelada: "destructive",
    };
    return <Badge variant={variants[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  // ===== Data load =====
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resetar para a primeira página quando filtros/ordenações mudarem
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, sortKey, sortDir, pageSize]);

  useEffect(() => {
    if (!dialogOpen) {
      setEditingAssinatura(null);
      originalPlanoIdRef.current = null;
      originalInicioRef.current = null;
      originalFimRef.current = null;
      originalStatusRef.current = null;
      setFormData((f) => ({
        membro_id: "",
        plano_id: "",
        inicio: new Date().toISOString().split("T")[0],
        tem_fim: false,
        fim: "",
        status: "ativa",
        gerar_faturas_24m: true,
        atualizar_faturas_abertas: true,
      }));
    }
  }, [dialogOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Usuário não autenticado");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", auth.user.id)
        .single();

      if (profErr) throw profErr;
      if (!profile?.org_id) throw new Error("org_id não encontrado no profile");

      const orgId = profile.org_id;
      setOrgIdState(orgId);

      // 🔎 Membros ATIVOS apenas (para seleção/elegibilidade)
      const [membrosResult, planosResult] = await Promise.all([
        supabase
          .from("membros")
          .select("id, nome, matricula, ativo")
          .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`)
          .eq("ativo", true) // <-- só ativos
          .order("nome"),
        supabase
          .from("planos")
          .select("id, nome, valor_centavos, dia_vencimento")
          .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`)
          .order("nome"),
      ]);

      if (!membrosResult.error && membrosResult.data) setMembros(membrosResult.data);
      if (!planosResult.error && planosResult.data) setPlanos(planosResult.data);

      const assinaturasResult = await supabase
        .from("assinaturas")
        .select(
          `
          id,
          inicio,
          fim,
          status,
          created_at,
          membros:membro_id ( id, nome, matricula ),
          planos:plano_id ( id, nome, valor_centavos, dia_vencimento )
        `
        )
        .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`)
        .order("created_at", { ascending: false });

      if (!assinaturasResult.error && assinaturasResult.data) {
        setAssinaturas(
          assinaturasResult.data.map((a: any) => ({
            id: a.id,
            inicio: ymd(a.inicio),
            fim: a.fim ? ymd(a.fim) : null,
            status: a.status,
            created_at: a.created_at,
            membro: {
              id: a.membros?.id || "",
              nome: a.membros?.nome || "N/A",
              matricula: a.membros?.matricula ?? null,
            },
            plano: {
              id: a.planos?.id || "",
              nome: a.planos?.nome || "N/A",
              valor_centavos: a.planos?.valor_centavos || 0,
              dia_vencimento: a.planos?.dia_vencimento ?? null,
            },
          }))
        );
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao carregar dados",
        description: err?.message ?? "Tente recarregar a página",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ===== Helpers de datas / faturas =====
  const eomDay = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  /** Calcula 24 vencimentos */
  function compute24DueDates(inicioISO: string, diaVenc: number): string[] {
    const start = new Date(inicioISO + "T00:00:00");
    let y = start.getFullYear();
    let m = start.getMonth(); // 0..11

    if (start.getDate() > diaVenc) {
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }

    const out: string[] = [];
    for (let i = 0; i < 24; i++) {
      const dd = Math.min(diaVenc, eomDay(y, m));
      out.push(iso(new Date(y, m, dd)));
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    return out;
  }

  async function replaceFaturasAbertasDaAssinatura(params: {
    assinatura_id: string;
    membro_id: string;
    plano_id: string;
    org_id: string;
    inicioISO: string;
  }) {
    const { assinatura_id, membro_id, plano_id, org_id, inicioISO } = params;

    const { data: plano, error: pErr } = await supabase
      .from("planos")
      .select("valor_centavos, dia_vencimento")
      .eq("id", plano_id)
      .single();
    if (pErr || !plano) throw new Error(pErr?.message ?? "Plano não encontrado");

    const dia = Number(plano.dia_vencimento ?? 1);
    const vencs = compute24DueDates(inicioISO, dia);
    const valorCent = Number(plano.valor_centavos || 0);

    await supabase
      .from("faturas")
      .delete()
      .eq("org_id", org_id)
      .eq("assinatura_id", assinatura_id)
      .in("status", ["pendente", "vencida"]);

    const rows = vencs.map((dt) => ({
      assinatura_id,
      membro_id,
      plano_id,
      org_id,
      terreiro_id: org_id,
      valor_centavos: valorCent,
      dt_vencimento: dt,
      refer: referFromISO(dt),
      status: "pendente" as const,
    }));

    const { error: insErr } = await supabase.from("faturas").insert(rows);
    if (insErr) throw insErr;
  }

  /** Criação inicial de 24 meses (idempotente) */
  const gerarFaturas24Meses = async (
    assinaturaId: string,
    membroId: string,
    planoId: string,
    orgId: string,
    inicioIso: string
  ) => {
    try {
      const { data: plano, error: pErr } = await supabase
        .from("planos")
        .select("valor_centavos, dia_vencimento")
        .eq("id", planoId)
        .single();
      if (pErr || !plano) throw new Error(pErr?.message ?? "Plano não encontrado para gerar faturas");

      const vencs = compute24DueDates(inicioIso, Number(plano.dia_vencimento ?? 1));
      const valorCent = Number(plano.valor_centavos || 0);

      await supabase
        .from("faturas")
        .delete()
        .eq("org_id", orgId)
        .eq("assinatura_id", assinaturaId)
        .in("status", ["pendente", "vencida"])
        .in("dt_vencimento", vencs);

      const rows = vencs.map((dt) => ({
        assinatura_id: assinaturaId,
        membro_id: membroId,
        plano_id: planoId,
        org_id: orgId,
        terreiro_id: OrgId,
        valor_centavos: valorCent,
        dt_vencimento: dt,
        refer: referFromISO(dt),
        status: "pendente" as const,
      }));

      const { error: insErr } = await supabase.from("faturas").insert(rows);
      if (insErr) throw insErr;
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Falha ao gerar faturas",
        description: e?.message ?? "Não foi possível gerar as faturas (24 meses).",
        variant: "destructive",
      });
    }
  };

  // ===== Elegibilidade =====
  const membrosComAssinaturaAtiva = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    const set = new Set<string>();
    for (const a of assinaturas) {
      const fimOK = !a.fim || new Date(a.fim).getTime() >= today;
      if (a.status === "ativa" && fimOK) set.add(a.membro.id);
    }
    return set;
  }, [assinaturas]);

  // Membros elegíveis = ativos AND sem assinatura ativa
  const membrosElegiveis = useMemo(
    () => membros.filter((m) => (m.ativo ?? true) && !membrosComAssinaturaAtiva.has(m.id)),
    [membros, membrosComAssinaturaAtiva]
  );

  // Busca dentro dos elegíveis para o modal de seleção
  const membrosFiltradosPorQuery = useMemo(() => {
    const q = membroQuery.trim().toLowerCase();
    const base = membrosElegiveis;
    if (!q) return base;
    return base.filter(
      (m) =>
        (m.nome || "").toLowerCase().includes(q) ||
        (m.matricula || "").toLowerCase().includes(q)
    );
  }, [membrosElegiveis, membroQuery]);

  // ===== Form =====
  const [formData, setFormData] = useState({
    membro_id: "",
    plano_id: "",
    inicio: new Date().toISOString().split("T")[0],
    tem_fim: false,
    fim: "",
    status: "ativa" as StatusAss,
    gerar_faturas_24m: true,
    atualizar_faturas_abertas: true,
  });

  const openNewDialog = () => {
    setEditingAssinatura(null);
    originalPlanoIdRef.current = null;
    originalInicioRef.current = null;
    originalFimRef.current = null;
    originalStatusRef.current = null;
    setFormData({
      membro_id: "",
      plano_id: "",
      inicio: new Date().toISOString().split("T")[0],
      tem_fim: false,
      fim: "",
      status: "ativa",
      gerar_faturas_24m: true,
      atualizar_faturas_abertas: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (assinatura: Assinatura) => {
    const inicio = ymd(assinatura.inicio);
    const fim = assinatura.fim ? ymd(assinatura.fim) : "";
    setFormData({
      membro_id: assinatura.membro.id,
      plano_id: assinatura.plano.id,
      inicio,
      tem_fim: Boolean(fim),
      fim,
      status: assinatura.status,
      gerar_faturas_24m: false,
      atualizar_faturas_abertas: true,
    });
    originalPlanoIdRef.current = assinatura.plano.id;
    originalInicioRef.current = inicio;
    originalFimRef.current = fim || null;
    originalStatusRef.current = assinatura.status;
    setEditingAssinatura(assinatura);
    setDialogOpen(true);
  };

  const buildPayloadCreate = (orgId: string) => {
    const fimValue = formData.tem_fim && formData.fim ? formData.fim : null;
    return {
      membro_id: formData.membro_id,
      plano_id: formData.plano_id,
      inicio: formData.inicio,
      fim: fimValue,
      status: formData.status,
      org_id: orgId,
      terreiro_id: orgId,
    };
  };

  const buildPayloadEdit = (orgId: string) => {
    const payload: Record<string, any> = { org_id: orgId, terreiro_id: orgId };
    if (formData.plano_id !== originalPlanoIdRef.current) payload.plano_id = formData.plano_id;
    const fimValue = formData.tem_fim && formData.fim ? formData.fim : null;
    if ((originalFimRef.current ?? null) !== fimValue) payload.fim = fimValue;
    if (formData.status !== originalStatusRef.current) payload.status = formData.status;
    if (formData.inicio !== (originalInicioRef.current ?? "")) payload.inicio = formData.inicio;
    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Usuário não autenticado");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", auth.user.id)
        .single();
      if (profErr) throw profErr;
      if (!profile?.org_id) throw new Error("org_id não encontrado no profile");

      const orgId = profile.org_id;

      if (editingAssinatura) {
        const originalPlanoId = originalPlanoIdRef.current;
        const planoMudou = originalPlanoId && originalPlanoId !== formData.plano_id;

        const payload = buildPayloadEdit(orgId);
        if (Object.keys(payload).length <= 2) {
          setDialogOpen(false);
          return;
        }

        const { error: upAssErr } = await supabase
          .from("assinaturas")
          .update(payload)
          .eq("id", editingAssinatura.id)
          .eq("org_id", orgId);
        if (upAssErr) throw upAssErr;

        if (planoMudou && formData.atualizar_faturas_abertas) {
          const inicioEfetivo =
            formData.inicio && formData.inicio !== (originalInicioRef.current ?? "")
              ? formData.inicio
              : (originalInicioRef.current ?? formData.inicio);

          await replaceFaturasAbertasDaAssinatura({
            assinatura_id: editingAssinatura.id,
            membro_id: formData.membro_id,
            plano_id: formData.plano_id,
            org_id: orgId,
            inicioISO: inicioEfetivo,
          });
        }

        toast({ title: "Assinatura atualizada", description: "Alterações aplicadas com sucesso." });
      } else {
        const payload = buildPayloadCreate(orgId);

        // segurança extra: impedir criação se já houver ativa
        if (membrosComAssinaturaAtiva.has(formData.membro_id)) {
          toast({
            title: "Membro já possui assinatura ativa",
            description: "Selecione outro membro.",
            variant: "destructive",
          });
          return;
        }

        const { data, error } = await supabase
          .from("assinaturas")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;

        if (data?.id && formData.gerar_faturas_24m) {
          await gerarFaturas24Meses(data.id, formData.membro_id, formData.plano_id, orgId, formData.inicio);
        }

        toast({
          title: "Assinatura criada",
          description: "A assinatura foi criada com sucesso.",
        });
      }

      setDialogOpen(false);
      await loadData();
    } catch (error: any) {
      console.error(error);
      const msg = await parseSbError(error);
      toast({ title: "Erro ao salvar assinatura", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (assinatura: Assinatura) => {
    try {
      const { error } = await supabase.from("assinaturas").delete().eq("id", assinatura.id);
      if (error) throw error;
      toast({ title: "Assinatura excluída", description: "A assinatura foi excluída do sistema" });
      await loadData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir assinatura",
        description: error?.message ?? "Tente novamente",
        variant: "destructive",
      });
    }
  };

  // ===== Filtros/ordenação da lista principal =====
  const filteredAssinaturas = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return assinaturas.filter((a) => {
      const matchesSearch =
        a.membro.nome.toLowerCase().includes(s) ||
        (a.membro.matricula && a.membro.matricula.toLowerCase().includes(s)) ||
        a.plano.nome.toLowerCase().includes(s);
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [assinaturas, searchTerm, statusFilter]);

  const sortBy = (key: SortKey) =>
    sortKey === key ? setSortDir((d) => (d === "asc" ? "desc" : "asc")) : (setSortKey(key), setSortDir("asc"));

  const sortedAssinaturas = useMemo(() => {
    const arr = [...filteredAssinaturas];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      switch (sortKey) {
        case "nome": return a.membro.nome.localeCompare(b.membro.nome, "pt-BR") * dir;
        case "matricula": {
          const na = Number(a.membro.matricula ?? NaN);
          const nb = Number(b.membro.matricula ?? NaN);
          if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
          return (a.membro.matricula ?? "").localeCompare(b.membro.matricula ?? "", "pt-BR") * dir;
        }
        case "plano":  return a.plano.nome.localeCompare(b.plano.nome, "pt-BR") * dir;
        case "valor":  return (a.plano.valor_centavos - b.plano.valor_centavos) * dir;
        case "inicio": {
          const ta = new Date(a.inicio || "1970-01-01").getTime();
          const tb = new Date(b.inicio || "1970-01-01").getTime();
          return (ta - tb) * dir;
        }
        default: return 0;
      }
    });

    return arr;
  }, [filteredAssinaturas, sortKey, sortDir]);

  // ===== Paginação (client-side) =====
  const totalItems = sortedAssinaturas.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalItems);
  const pageData = sortedAssinaturas.slice(startIdx, endIdx);

  const goFirst = () => setPage(1);
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));
  const goLast = () => setPage(totalPages);

  // --- Bulk: abrir modal com ELEGÍVEIS (ativos e sem assinatura)
  const openBulkDialog = async () => {
    setBulkLoading(true);
    setBulkSelectedPlanoId("");
    setBulkGerarFaturas(true);
    try {
      // você pode manter a RPC se quiser; aqui garantimos o filtro localmente:
      setBulkMissingMembers(membrosElegiveis);
      setBulkDialogOpen(true);
    } finally {
      setBulkLoading(false);
    }
  };

  // --- Bulk: gerar assinaturas (e faturas) para faltantes ---
  const isUniqueViolation = (err: any) =>
    err?.code === "23505" ||
    String(err?.message ?? "").includes("duplicate key value") ||
    String(err?.message ?? "").includes("one_active_per_member");

  const humanizeError = (err: any) => {
    const raw = String(
      err?.message ??
      err?.error_description ??
      err?.hint ??
      err
    );

    if (/invalid input syntax for type uuid/i.test(raw)) {
      // geralmente acontece quando plano_id ou membro_id está vazio ("")
      if (/plano|plano_id/i.test(raw)) return "Selecione um plano.";
      if (/membro|membro_id/i.test(raw)) return "Selecione um membro.";
      return "Há campos obrigatórios sem selecionar (membro e/ou plano).";
    }
    if (/null value in column .* violates not-null constraint/i.test(raw)) {
      const col = raw.match(/column\s+"?([a-z_]+)"?/i)?.[1];
      if (col === "plano_id") return "Selecione um plano.";
      if (col === "membro_id") return "Selecione um membro.";
      if (col === "inicio") return "Informe a data de início.";
      return "Preencha os campos obrigatórios.";
    }
    if (/duplicate key value|unique constraint/i.test(raw)) {
      return "Já existe uma assinatura ativa para este membro.";
    }
    return raw || "Erro desconhecido. Tente novamente.";
  };

  // Valida o formulário antes de enviar
  const validateForm = (f: typeof formData) => {
    const errs: string[] = [];
    if (!isUUID(f.membro_id)) errs.push("Selecione um membro.");
    if (!isUUID(f.plano_id)) errs.push("Selecione um plano.");
    if (!f.inicio) errs.push("Informe a data de início.");
    return errs;
  };
  const handleBulkGenerate = async () => {
    if (!orgIdState) {
      toast({ title: "Sem organização", description: "Org não encontrado.", variant: "destructive" });
      return;
    }
    if (!bulkSelectedPlanoId) {
      toast({ title: "Selecione um plano", description: "Escolha o plano para gerar/atualizar as assinaturas." });
      return;
    }

    setBulkLoading(true);
    try {
      const now = new Date();
      const until = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const { data, error } = await supabase.rpc(
        "cleanup_and_generate_assinaturas_one_per_member",
        {
          p_org_id: orgIdState,
          p_plano_id: bulkSelectedPlanoId,
          p_gerar_faturas: bulkGerarFaturas,
          p_until: until,
          p_usuario: (await supabase.auth.getUser())?.data?.user?.email ?? null,
        }
      );
      if (error) throw error;

      // data é uma linha com métricas
      const row = Array.isArray(data) ? data[0] : data;
      const created  = Number(row?.created_count  ?? 0);
      const updated  = Number(row?.updated_count  ?? 0);
      const canceled = Number(row?.canceled_dups ?? 0);
      const skipped  = Number(row?.skipped_same_plan ?? 0);

      const pieces = [
        created ? `${created} criada(s)` : null,
        updated ? `${updated} atualizada(s)` : null,
        canceled ? `${canceled} duplicada(s) cancelada(s)` : null,
        skipped ? `${skipped} já estavam no mesmo plano` : null,
      ].filter(Boolean);

      toast({
        title: "Assinaturas normalizadas",
        description: pieces.length ? pieces.join(" · ") : "Nada a fazer: todos já estavam corretos.",
      });

      setBulkDialogOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Falha ao gerar/atualizar",
        description: humanizeError(err),
        variant: "destructive",
      });
    } finally {
      setBulkLoading(false);
    }
  };


  // ===== UI helpers =====
  const HeaderSortBtn = ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 ${active ? "text-foreground" : "text-muted-foreground"} hover:text-foreground`}
      title={`Ordenar por ${label}`}
    >
      {label}
      <ArrowUpDown className={`h-3.5 w-3.5 transition ${active ? "opacity-100" : "opacity-50"}`} />
    </button>
  );

  const PaginationBar = () => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <div className="text-sm text-muted-foreground">
        {totalItems > 0 ? `Mostrando ${startIdx + 1}–${endIdx} de ${totalItems}` : "Nenhum registro"}
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm">Linhas por página</Label>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {PAGE_SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={String(opt)}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goFirst} disabled={currentPage === 1} title="Primeira página">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goPrev} disabled={currentPage === 1} title="Página anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm">
            Página {currentPage} de {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={goNext} disabled={currentPage === totalPages} title="Próxima página">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goLast} disabled={currentPage === totalPages} title="Última página">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // ===== Render =====
  return (
    <DashboardLayout>
      <FeatureGate feature="assinaturas" fallback={<UpgradeCard needed="Assinaturas" />}>
        <div className="space-y-6 relative z-0 pt-1 md:pt-2">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-8 w-8 text-primary" />
                Assinaturas
              </h1>
              <p className="text-muted-foreground">Gerencie as assinaturas de planos</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Gerar Faltantes */}
              <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-primary/40 text-primary hover:bg-primary/10"
                    onClick={openBulkDialog}
                    disabled={bulkLoading}
                    title="Criar assinatura para quem não tem"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Gerar Faltantes
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Gerar assinaturas faltantes</DialogTitle>
                    <DialogDescription>
                      Cria uma assinatura <strong>ativa</strong> para cada <strong>membro ativo</strong> que ainda não
                      possui assinatura ativa.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    {/* Plano obrigatório */}
                    <div className="space-y-2">
                      <Label>Plano *</Label>
                      <Select value={bulkSelectedPlanoId} onValueChange={setBulkSelectedPlanoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um plano" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {planos.map((pl) => (
                            <SelectItem key={pl.id} value={pl.id}>
                              {pl.nome} — {formatCurrency(pl.valor_centavos)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="mr-3">Gerar faturas (24 meses)</Label>
                      <Switch checked={bulkGerarFaturas} onCheckedChange={setBulkGerarFaturas} />
                    </div>

                    <div className="rounded border border-border/50 p-3 text-sm">
                      {bulkLoading ? (
                        <div className="animate-pulse h-5 w-40 bg-muted/40 rounded" />
                      ) : (
                        <>
                          <div className="font-medium">
                            Membros ativos sem assinatura: {bulkMissingMembers.length}
                          </div>
                          {bulkMissingMembers.length > 0 && (
                            <ul className="mt-2 max-h-40 overflow-auto space-y-1">
                              {bulkMissingMembers.slice(0, 20).map((m) => (
                                <li key={m.id} className="text-muted-foreground">
                                  {m.nome} {m.matricula ? `(${m.matricula})` : ""}
                                </li>
                              ))}
                              {bulkMissingMembers.length > 20 && (
                                <li className="text-muted-foreground">
                                  … e mais {bulkMissingMembers.length - 20}
                                </li>
                              )}
                            </ul>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={bulkLoading}>
                        Cancelar
                      </Button>
                      <Button
                        className="bg-gradient-sacred hover:opacity-90"
                        onClick={handleBulkGenerate}
                        disabled={bulkLoading || !bulkSelectedPlanoId || bulkMissingMembers.length === 0}
                      >
                        {bulkLoading ? "Gerando..." : "Gerar"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Nova Assinatura / Editar */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-sacred hover:opacity-90" onClick={openNewDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Assinatura
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingAssinatura ? "Editar Assinatura" : "Nova Assinatura"}</DialogTitle>
                    <DialogDescription>
                      {editingAssinatura
                        ? "Atualize os dados da assinatura"
                        : "Vincule um membro ativo a um plano"}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Membro *</Label>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setMembroDialogOpen(true)}
                          disabled={!!editingAssinatura}
                          title={editingAssinatura ? "Não é possível trocar o membro ao editar" : "Selecionar membro"}
                          className="h-9"
                        >
                          {(() => {
                            if (!formData.membro_id) return "Selecionar membro (apenas ativos e sem assinatura)";
                            const mm = membrosElegiveis.find((m) => m.id === formData.membro_id);
                            return mm ? `${mm.nome}${mm.matricula ? ` • ${mm.matricula}` : ""}` : "Selecionar membro";
                          })()}
                        </Button>

                        {!!formData.membro_id && !editingAssinatura && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-9"
                            onClick={() => setFormData((f) => ({ ...f, membro_id: "" }))}
                          >
                            Limpar
                          </Button>
                        )}
                      </div>

                      <Dialog open={membroDialogOpen} onOpenChange={setMembroDialogOpen}>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Selecionar membro</DialogTitle>
                            <DialogDescription>
                              Somente <strong>membros ativos</strong> sem assinatura ativa. Busque por nome ou matrícula.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-2">
                            <Input
                              autoFocus
                              placeholder="Digite nome ou matrícula..."
                              value={membroQuery}
                              onChange={(e) => setMembroQuery(e.target.value)}
                              className="h-9"
                            />

                            <ScrollArea className="h-72 rounded-md border">
                              <div className="p-2 space-y-1">
                                {membrosFiltradosPorQuery.map((m) => (
                                  <button
                                    key={m.id}
                                    onClick={() => {
                                      setFormData((f) => ({ ...f, membro_id: m.id }));
                                      setMembroDialogOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-md hover:bg-muted"
                                  >
                                    <div className="text-sm font-medium">{m.nome}</div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {m.matricula ? `Matrícula: ${m.matricula}` : "—"}
                                    </div>
                                  </button>
                                ))}

                                {membrosFiltradosPorQuery.length === 0 && (
                                  <div className="text-sm text-muted-foreground px-3 py-6 text-center">
                                    Nenhum membro ativo elegível encontrado
                                  </div>
                                )}
                              </div>
                            </ScrollArea>

                            <div className="flex justify-end gap-2 pt-1">
                              <Button variant="secondary" onClick={() => setMembroDialogOpen(false)}>
                                Fechar
                              </Button>
                              {!!formData.membro_id && !editingAssinatura && (
                                <Button variant="outline" onClick={() => setFormData((f) => ({ ...f, membro_id: "" }))}>
                                  Limpar seleção
                                </Button>
                              )}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {editingAssinatura && (
                        <p className="text-xs text-muted-foreground">
                          Para manter histórico consistente, a troca de membro não é aplicada na edição desta assinatura.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="plano_id">Plano *</Label>
                      <Select value={formData.plano_id} onValueChange={(value) => setFormData({ ...formData, plano_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um plano" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {planos.map((plano) => (
                            <SelectItem key={plano.id} value={plano.id}>
                              {plano.nome} — {formatCurrency(plano.valor_centavos)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="inicio">Data de início *</Label>
                      <Input
                        id="inicio"
                        type="date"
                        value={formData.inicio}
                        onChange={(e) => setFormData({ ...formData, inicio: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="tem_fim">Tem data fim?</Label>
                        <Switch
                          id="tem_fim"
                          checked={formData.tem_fim}
                          onCheckedChange={(checked) => setFormData((f) => ({ ...f, tem_fim: checked, fim: checked ? f.fim : "" }))}
                        />
                      </div>
                      {formData.tem_fim && (
                        <>
                          <Label htmlFor="fim" className="sr-only">Data de fim</Label>
                          <Input id="fim" type="date" value={formData.fim} onChange={(e) => setFormData({ ...formData, fim: e.target.value })} />
                        </>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Status *</Label>
                      <Select value={formData.status} onValueChange={(value: StatusAss) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="ativa">Ativa</SelectItem>
                          <SelectItem value="pausada">Pausada</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {editingAssinatura && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="atualizar_faturas_abertas">Atualizar faturas em aberto</Label>
                          <Switch
                            id="atualizar_faturas_abertas"
                            checked={formData.atualizar_faturas_abertas}
                            onCheckedChange={(v) => setFormData((f) => ({ ...f, atualizar_faturas_abertas: v }))}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Refaz <strong>todas as faturas pendentes/vencidas</strong> desta assinatura nas datas recalculadas
                          pelo novo plano (apaga e recria), preservando as <strong>pagas</strong>.
                        </p>
                      </div>
                    )}

                    {!editingAssinatura && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="gerar_faturas_24m">Gerar faturas (24 meses)</Label>
                          <Switch
                            id="gerar_faturas_24m"
                            checked={formData.gerar_faturas_24m}
                            onCheckedChange={(checked) => setFormData((f) => ({ ...f, gerar_faturas_24m: checked }))}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Na criação, gera/completa faturas a partir da data de início (usa o dia do plano).
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" className="bg-gradient-sacred hover:opacity-90">
                        {editingAssinatura ? "Atualizar" : "Criar"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Filtros */}
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Buscar por membro, matrícula ou plano..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-48">
                  <Select value={statusFilter} onValueChange={(v: "all" | StatusAss) => setStatusFilter(v)}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="ativa">Ativas</SelectItem>
                      <SelectItem value="pausada">Pausadas</SelectItem>
                      <SelectItem value="cancelada">Canceladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-56">
                  <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                    <SelectTrigger><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="nome">Nome</SelectItem>
                      <SelectItem value="matricula">Matrícula</SelectItem>
                      <SelectItem value="plano">Plano</SelectItem>
                      <SelectItem value="valor">Valor</SelectItem>
                      <SelectItem value="inicio">Início</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="w-full sm:w-auto"
                  title={`Direção: ${sortDir === "asc" ? "Crescente" : "Decrescente"}`}
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {sortDir === "asc" ? "Crescente" : "Decrescente"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista responsiva: Cards (mobile) + Tabela (desktop) */}
          <Card className="bg-card/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>
                {totalItems} assinatura{totalItems !== 1 ? "s" : ""} encontrada{totalItems !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="grid grid-cols-1 gap-3 sm:hidden">
                    {pageData.map((assinatura) => (
                      <div key={assinatura.id} className="rounded-lg border border-border/50 p-3 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{assinatura.membro.nome}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {assinatura.membro.matricula ?? "—"}
                            </div>
                          </div>
                          <div className="shrink-0">{getStatusBadge(assinatura.status)}</div>
                        </div>

                        <div className="text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span className="font-medium">{assinatura.plano.nome}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-semibold text-secondary">{formatCurrency(assinatura.plano.valor_centavos)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Início</span><span>{new Date(assinatura.inicio).toLocaleDateString("pt-BR")}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Fim</span><span>{assinatura.fim ? new Date(assinatura.fim).toLocaleDateString("pt-BR") : "—"}</span></div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(assinatura)}
                            className="flex-1 hover:bg-accent hover:text-accent-foreground"
                            title="Editar"
                          >
                            <Edit className="h-3 w-3 mr-1" /> Editar
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="flex-1 hover:bg-destructive hover:text-destructive-foreground"
                                title="Excluir"
                              >
                                <Trash2 className="h-3 w-3 mr-1" /> Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja excluir esta assinatura? Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(assinatura)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: tabela */}
                  <div className="hidden sm:block w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead className="min-w-[180px]">
                            <HeaderSortBtn label="Membro" active={sortKey === "nome"} onClick={() => sortBy("nome")} />
                          </TableHead>
                          <TableHead className="min-w-[160px]">
                            <HeaderSortBtn label="Plano" active={sortKey === "plano"} onClick={() => sortBy("plano")} />
                          </TableHead>
                          <TableHead className="whitespace-nowrap min-w-[120px]">
                            <HeaderSortBtn label="Valor" active={sortKey === "valor"} onClick={() => sortBy("valor")} />
                          </TableHead>
                          <TableHead className="whitespace-nowrap min-w-[120px]">
                            <HeaderSortBtn label="Início" active={sortKey === "inicio"} onClick={() => sortBy("inicio")} />
                          </TableHead>
                          <TableHead className="min-w-[120px]">Fim</TableHead>
                          <TableHead className="min-w-[120px]">Status</TableHead>
                          <TableHead className="w-[140px]">
                            <HeaderSortBtn label="Matrícula" active={sortKey === "matricula"} onClick={() => sortBy("matricula")} />
                          </TableHead>
                          <TableHead className="w-[140px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageData.map((assinatura) => (
                          <TableRow key={assinatura.id} className="border-border/50">
                            <TableCell className="font-medium">
                              {assinatura.membro.nome}
                              {assinatura.membro.matricula && (
                                <div className="text-xs text-muted-foreground">{assinatura.membro.matricula}</div>
                              )}
                            </TableCell>
                            <TableCell>{assinatura.plano.nome}</TableCell>
                            <TableCell className="font-semibold text-secondary">{formatCurrency(assinatura.plano.valor_centavos)}</TableCell>
                            <TableCell>{new Date(assinatura.inicio).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell>{assinatura.fim ? new Date(assinatura.fim).toLocaleDateString("pt-BR") : "—"}</TableCell>
                            <TableCell>{getStatusBadge(assinatura.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{assinatura.membro.matricula ?? "—"}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(assinatura)} className="hover:bg-accent hover:text-accent-foreground" title="Editar">
                                  <Edit className="h-3 w-3" />
                                </Button>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button type="button" size="sm" variant="outline" className="hover:bg-destructive hover:text-destructive-foreground" title="Excluir">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                      <AlertDialogDescription>Tem certeza que deseja excluir esta assinatura? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(assinatura)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Paginação */}
                  <PaginationBar />
                </>
              )}

              {!loading && totalItems === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhuma assinatura encontrada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
