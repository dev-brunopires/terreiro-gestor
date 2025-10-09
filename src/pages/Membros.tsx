"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/SectionHeader";
import {
  Plus, Search, Edit, Trash2, Power,
  Users, FileBadge2, Flower2, MapPin, Briefcase, FileText,
  Upload, Download, FileSpreadsheet
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import FeatureGate from "@/components/FeatureGate";
import UpgradeCard from "@/components/UpgradeCard";

/* ----------------------- utils ----------------------- */
function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}
function usePageVisibility() {
  const [visible, setVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState !== "hidden"
  );
  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("blur", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("blur", onVis);
    };
  }, []);
  return visible;
}

// Natural sort p/ strings com números, com tratamento "YYYY-SEQ".
function matriculaKey(m: string | null | undefined): [number, number, string] {
  const s = (m ?? "").trim();
  if (!s) return [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, ""];
  const mYearSeq = /^(\d{4})-(\d+)$/.exec(s);
  if (mYearSeq) {
    const year = parseInt(mYearSeq[1], 10);
    const seq = parseInt(mYearSeq[2], 10);
    return [year, seq, s];
  }
  const digits = s.replace(/\D+/g, "");
  const num = digits ? parseInt(digits, 10) : Number.NEGATIVE_INFINITY;
  return [0, num, s];
}
function compareMatricula(a?: string | null, b?: string | null, dir: "asc" | "desc" = "asc") {
  const ka = matriculaKey(a);
  const kb = matriculaKey(b);
  let cmp = 0;
  if (ka[0] !== kb[0]) cmp = ka[0] - kb[0];
  else if (ka[1] !== kb[1]) cmp = ka[1] - kb[1];
  else cmp = ka[2].localeCompare(kb[2], "pt-BR", { numeric: true, sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

/* ----------------------- tipos ----------------------- */
type TipoPessoa = "PF" | "PJ";
interface Membro {
  id: string;
  org_id: string;
  nome: string;
  matricula?: string | null;
  dt_nascimento?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cep?: string | null;
  data_admissao_terreiro?: string | null;
  ativo: boolean;
  observacoes?: any | null;
  created_at: string;
  updated_at?: string | null;
  cidade?: string | null;
  uf?: string | null;
  numero?: string | null;
  complemento?: string | null;
  profissao?: string | null;
  espiritual_umbanda?: any | null;
  espiritual_candomble?: any | null;
  docs?: any | null;
  tipo_pessoa?: TipoPessoa | null;
  digina?: string | null;
}
interface Terreiro { id: string; nome: string; }
interface Plano {
  id: string;
  nome: string;
  valor_centavos: number;
  dia_vencimento: number;
  ativo: boolean;
  terreiro_id: string;
  org_id?: string | null;
}

/* layout helper */
function TextGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

/* ----------------------- componente ----------------------- */
export default function Membros() {
  const { toast } = useToast();
  const isVisible = usePageVisibility();
  const didInitRef = useRef(false);
  const mountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgNome, setOrgNome] = useState<string>("");
  const [terreiros, setTerreiros] = useState<Terreiro[]>([]);
  const [selectedTerreiroId, setSelectedTerreiroId] = useState<string>("");
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const claimSetRef = useRef(false); // evita repetir updateUser
  // --- filtros ---
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounced(searchTerm, 400);

  type StatusFilter = "all" | "active" | "inactive";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [sortField, setSortField] = useState<"nome" | "matricula">("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // paginação
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // contadores
  const [totalCount, setTotalCount] = useState(0);
  const [totalActiveCount, setTotalActiveCount] = useState(0);
  const [resultCount, setResultCount] = useState(0);

  // planos (form + busca por nome de plano)
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [selectedPlanoId, setSelectedPlanoId] = useState<string>("");

  useEffect(() => () => { mountedRef.current = false; }, []);

  const normalize = (v: string) => (v?.trim() ? v.trim() : null);
  const normalizeDate = (v: string) => (v ? v : null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditingLoading, setIsEditingLoading] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    matricula: "",
    dt_nascimento: "",
    telefone: "",
    email: "",
    endereco: "",
    bairro: "",
    cep: "",
    cidade: "",
    uf: "",
    numero: "",
    complemento: "",
    profissao: "",
    data_admissao_terreiro: "",
    ativo: true,
    observacoes: "",
    tipo_pessoa: "PF" as TipoPessoa,
    docs_pf: { cpf: "", rg: "", orgao_emissor: "", dt_emissao: "" },
    docs_pj: { razao_social: "", cnpj: "", ie: "", im: "" },
    umbanda: {
      orixas: ["", "", "", ""],
      pretoVelho: ["", ""],
      exu: ["", ""],
      pombaGira: ["", ""],
      caboclo: ["", ""],
      ere: ["", ""],
      outros: "",
    },
    candomble: {
      orixas: [
        { nome: "", qualidade: "" },
        { nome: "", qualidade: "" },
        { nome: "", qualidade: "" },
        { nome: "", qualidade: "" },
      ],
      obrigacoes: [
        { nome: "", data: "" },
        { nome: "", data: "" },
        { nome: "", data: "" },
        { nome: "", data: "" },
      ],
      digina: "",
    },
  });

  const buildPayload = (finalOrgId: string) => ({
    org_id: finalOrgId,
    terreiro_id: finalOrgId, // 👈 ADICIONE ISTO
    nome: formData.nome.trim(),
    matricula: normalize(formData.matricula),
    dt_nascimento: normalizeDate(formData.dt_nascimento),
    telefone: normalize(formData.telefone),
    email: normalize(formData.email),
    endereco: normalize(formData.endereco),
    bairro: normalize(formData.bairro),
    cep: normalize(formData.cep),
    cidade: normalize(formData.cidade || ""),
    uf: normalize(formData.uf || ""),
    numero: normalize(formData.numero || ""),
    complemento: normalize(formData.complemento || ""),
    profissao: normalize(formData.profissao || ""),
    data_admissao_terreiro: normalizeDate(formData.data_admissao_terreiro),
    ativo: formData.ativo,
    observacoes: formData.observacoes?.trim() ? { texto: formData.observacoes.trim() } : null,
    tipo_pessoa: formData.tipo_pessoa,
    docs:
      formData.tipo_pessoa === "PF"
        ? { tipo: "PF", ...formData.docs_pf }
        : { tipo: "PJ", ...formData.docs_pj },
    espiritual_umbanda: {
      orixas: (formData.umbanda.orixas || []).filter(Boolean),
      pretoVelho: (formData.umbanda.pretoVelho || []).filter(Boolean),
      exu: (formData.umbanda.exu || []).filter(Boolean),
      pombaGira: (formData.umbanda.pombaGira || []).filter(Boolean),
      caboclo: (formData.umbanda.caboclo || []).filter(Boolean),
      ere: (formData.umbanda.ere || []).filter(Boolean),
      outros: normalize(formData.umbanda.outros || ""),
    },
    espiritual_candomble: {
      orixas: (formData.candomble.orixas || [])
        .map((o) => (o?.nome ? { nome: o.nome, qualidade: o.qualidade || null } : null))
        .filter(Boolean),
      obrigacoes: (formData.candomble.obrigacoes || [])
        .map((o) => (o?.nome ? { nome: o.nome, data: o.data || null } : null))
        .filter(Boolean),
    },
    digina: formData.candomble?.digina?.trim() ? formData.candomble.digina.trim() : null,
  });

  const ensureValidOrgId = async (): Promise<string> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) throw new Error("Usuário não autenticado");

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", auth.user.id)
      .single();
    if (error) throw error;

    let org = (profile as any)?.org_id ?? null;

    const exists = async (id: string | null) => {
      if (!id) return false;
      const { data } = await supabase
        .from("terreiros")
        .select("id,nome")
        .eq("id", id)
        .maybeSingle();
      if (data?.nome) setOrgNome(data.nome);
      return !!data;
    };

    if (!(await exists(org))) {
      const { data: ensured, error: rpcErr } = await supabase.rpc("ensure_default_org", { p_nome: "Xango Menino" });
      if (rpcErr || !ensured) throw new Error(rpcErr?.message ?? "Falha ao garantir terreiro padrão");
      org = ensured as string;
      const { data: terrNome } = await supabase
        .from("terreiros")
        .select("nome")
        .eq("id", org)
        .maybeSingle();
      setOrgNome((terrNome as any)?.nome ?? "");
    }

    // ✅ só atualiza a claim se ela estiver diferente e ainda não fizemos isso
    const currentClaim = (auth.user.user_metadata as any)?.org_id ?? null;
    if (!claimSetRef.current && org && currentClaim !== org) {
      try {
        await supabase.auth.updateUser({ data: { org_id: org } });
        // NÃO chame refreshSession aqui
        claimSetRef.current = true;
      } catch {
        // mesmo que falhe, seguimos com orgId local
      }
    }

    setOrgId(org);
    return org!;
  };



  const loadPlanosByTerreiro = async (terreiroId: string) => {
    if (!terreiroId) { setPlanos([]); return; }
    const { data, error } = await supabase
      .from("planos")
      .select("id, nome, valor_centavos, dia_vencimento, ativo, terreiro_id, org_id")
      .or(`terreiro_id.eq.${terreiroId},org_id.eq.${terreiroId}`)
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar planos", description: error.message, variant: "destructive" });
      setPlanos([]);
      return;
    }
    setPlanos(data || []);
    if (!data?.some(p => p.id === selectedPlanoId)) setSelectedPlanoId("");
  };

  /** busca + status + ordenação + paginação */
  const [allFilteredForClientSort, setAllFilteredForClientSort] = useState<Membro[] | null>(null);

  const loadMembros = async () => {
    if (!isVisible || !orgId) return;
    const ctrl = new AbortController();
    try {
      if (membros.length === 0) setLoading(true);

      // contagens (geral/ativos)
      const [allRes, actRes] = await Promise.all([
        supabase.from("membros").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("membros").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("ativo", true),
      ]);
      if (!ctrl.signal.aborted) {
        setTotalCount(allRes.count ?? 0);
        setTotalActiveCount(actRes.count ?? 0);
      }

      // termo também casa com nome de plano (assinatura ativa)
      let idsPorPlano: string[] = [];
      const term = debouncedSearch.trim();
      if (term) {
        const like = `%${term}%`;
        const { data: planosMatch } = await supabase.from("planos").select("id").ilike("nome", like);
        const planosIds = (planosMatch ?? []).map(p => p.id);
        if (planosIds.length) {
          const { data: assin } = await supabase
            .from("assinaturas")
            .select("membro_id")
            .eq("org_id", orgId)
            .eq("status", "ativa")
            .in("plano_id", planosIds);
          idsPorPlano = (assin ?? []).map(a => a.membro_id).filter(Boolean) as string[];
        }
      }

      const applyCommon = (q: any) => {
        let query = q.eq("org_id", orgId);
        if (term) {
          const like = `%${term}%`;
          const idsChunk = idsPorPlano.length ? `,id.in.(${idsPorPlano.join(",")})` : "";
          query = query.or(`nome.ilike.${like},matricula.ilike.${like}${idsChunk}`);
        }
        if (statusFilter === "active") query = query.eq("ativo", true);
        if (statusFilter === "inactive") query = query.eq("ativo", false);
        return query;
      };

      // count do resultado filtrado
      {
        const { count, error: cErr } = await applyCommon(
          supabase.from("membros").select("id", { count: "exact", head: true })
        );
        if (cErr) throw cErr;
        setResultCount(count ?? 0);
        if ((count ?? 0) === 0) { setMembros([]); setAllFilteredForClientSort(null); setLoading(false); return; }
      }

      if (sortField === "nome") {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        let listQuery = applyCommon(
          supabase.from("membros").select("id, org_id, nome, matricula, telefone, email, ativo")
        );
        listQuery = listQuery
          .order("nome", { ascending: sortDir === "asc" })
          .range(from, to);
        const { data, error } = await listQuery;
        if (ctrl.signal.aborted) return;
        if (error) throw error;
        if (mountedRef.current) {
          setAllFilteredForClientSort(null);
          setMembros((data ?? []) as any);
        }
      } else {
        let listQuery = applyCommon(
          supabase.from("membros").select("id, org_id, nome, matricula, telefone, email, ativo")
        );
        listQuery = listQuery.limit(5000);
        const { data, error } = await listQuery;
        if (ctrl.signal.aborted) return;
        if (error) throw error;

        const full = (data ?? []) as Membro[];
        full.sort((a, b) => {
          const na = a?.matricula ?? null;
          const nb = b?.matricula ?? null;
          if (!na && !nb) return 0;
          if (!na) return sortDir === "asc" ? 1 : -1;
          if (!nb) return sortDir === "asc" ? -1 : 1;
          return compareMatricula(na, nb, sortDir);
        });

        if (mountedRef.current) {
          setAllFilteredForClientSort(full);
          const from = (page - 1) * pageSize;
          const to = from + pageSize;
          setMembros(full.slice(from, to));
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Erro ao carregar membros", description: e?.message ?? "Tente novamente", variant: "destructive" });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    return () => ctrl.abort();
  };

  // cobrança utilitários
  const endOfMonthDay = (y: number, mZeroBased: number) => new Date(y, mZeroBased + 1, 0).getDate();
  const clampDay = (y: number, mZeroBased: number, d: number) => Math.min(d, endOfMonthDay(y, mZeroBased));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const compute24DueDates = (startISO: string, diaVenc: number): string[] => {
    const start = new Date(startISO + "T00:00:00");
    const y0 = start.getFullYear();
    const m0 = start.getMonth();
    const day = start.getDate();
    let firstYear = y0, firstMonth = m0;
    if (day > diaVenc) {
      firstMonth += 1;
      if (firstMonth > 11) { firstMonth = 0; firstYear += 1; }
    }
    const dates: string[] = [];
    let y = firstYear, m = firstMonth;
    for (let i = 0; i < 24; i++) {
      const d = clampDay(y, m, diaVenc);
      dates.push(iso(new Date(y, m, d)));
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
    return dates;
  };
  const generate24Invoices = async (params: {
    assinatura_id: string;
    membro_id: string;
    plano_id: string;
    org: string;
    inicioISO: string;
  }) => {
    const { assinatura_id, membro_id, plano_id, org, inicioISO } = params;
    let plano = planos.find(p => p.id === plano_id) as Plano | undefined;
    if (!plano) {
      const { data } = await supabase
        .from("planos")
        .select("id, nome, valor_centavos, dia_vencimento, terreiro_id, org_id")
        .eq("id", plano_id)
        .maybeSingle();
      plano = data as any;
    }
    if (!plano) throw new Error("Plano não encontrado para gerar faturas");
    const dueDates = compute24DueDates(inicioISO, Number(plano.dia_vencimento));
    const valorCent = Number(plano.valor_centavos || 0);
    const valorNum = Math.round(valorCent) / 100;
    const rows = dueDates.map((dt) => ({
      assinatura_id, membro_id, plano_id,
      valor: valorNum, valor_centavos: valorCent,
      data_vencimento: dt, dt_vencimento: dt,
      status: "pendente", terreiro_id: org, org_id: org,
    }));
    const { error } = await supabase
      .from("faturas")
      .upsert(rows, { onConflict: "assinatura_id,dt_vencimento" });
    if (error) throw error;
  };

  // bootstrap
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const validOrg = await ensureValidOrgId();

        const { data: ts, error: tErr } = await supabase.from("terreiros").select("id, nome").order("nome", { ascending: true });
        if (tErr) throw tErr;
        setTerreiros(ts || []);
        setSelectedTerreiroId(validOrg);

        try { const { data: sup } = await supabase.rpc("is_superadmin"); setIsSuperadmin(!!sup); }
        catch { setIsSuperadmin(false); }

        await loadPlanosByTerreiro(validOrg);
      } catch (e: any) {
        toast({ title: "Erro ao iniciar tela", description: e?.message ?? "Tente novamente", variant: "destructive" });
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset página quando filtros mudarem
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, sortField, sortDir, orgId]);

  // Recarrega sempre que algo relevante muda
  useEffect(() => { if (orgId) loadMembros(); }, [orgId, debouncedSearch, statusFilter, page, sortField, sortDir]); // eslint-disable-line

  useEffect(() => {
    if (dialogOpen && selectedTerreiroId) loadPlanosByTerreiro(selectedTerreiroId);
  }, [dialogOpen, selectedTerreiroId]); // eslint-disable-line

  // matrícula automática robusta
  const sugerirProximaMatricula = async (terreiroId: string) => {
    try {
      if (!terreiroId) return;
      const { data, error } = await supabase
        .from("membros")
        .select("matricula")
        .eq("org_id", terreiroId)
        .not("matricula", "is", null)
        .limit(50000);
      if (error) throw error;

      const lista = (data ?? []).map(r => r.matricula as string);
      const ultima = lista.length
        ? lista.sort((a, b) => compareMatricula(a, b, "desc"))[0]!
        : "";

      let proxima = "";
      const m = /^(\d{4})-(\d+)$/.exec(ultima);
      if (m) {
        const ano = m[1];
        const seq = String(parseInt(m[2] || "0", 10) + 1).padStart(m[2].length, "0");
        proxima = `${ano}-${seq}`;
      } else {
        const digits = ultima.replace(/\D/g, "");
        if (digits) {
          const n = parseInt(digits, 10);
          proxima = String(n + 1).padStart(Math.max(digits.length, 3), "0");
        } else {
          proxima = `${new Date().getFullYear()}-001`;
        }
      }
      setFormData((f) => ({ ...f, matricula: proxima }));
    } catch {
      setFormData((f) => ({ ...f, matricula: `${new Date().getFullYear()}-001` }));
    }
  };

  const resetForm = () => {
    setFormData((f) => ({
      ...f,
      nome: "",
      matricula: "",
      dt_nascimento: "",
      telefone: "",
      email: "",
      endereco: "",
      bairro: "",
      cep: "",
      cidade: "",
      uf: "",
      numero: "",
      complemento: "",
      profissao: "",
      data_admissao_terreiro: "",
      ativo: true,
      observacoes: "",
      tipo_pessoa: "PF",
      docs_pf: { cpf: "", rg: "", orgao_emissor: "", dt_emissao: "" },
      docs_pj: { razao_social: "", cnpj: "", ie: "", im: "" },
      umbanda: {
        orixas: ["", "", "", ""],
        pretoVelho: ["", ""],
        exu: ["", ""],
        pombaGira: ["", ""],
        caboclo: ["", ""],
        ere: ["", ""],
        outros: "",
      },
      candomble: {
        orixas: [
          { nome: "", qualidade: "" },
          { nome: "", qualidade: "" },
          { nome: "", qualidade: "" },
          { nome: "", qualidade: "" },
        ],
        obrigacoes: [
          { nome: "", data: "" },
          { nome: "", data: "" },
          { nome: "", data: "" },
          { nome: "", data: "" },
        ],
        digina: "",
      },
    }));
    setSelectedTerreiroId(orgId ?? "");
    setSelectedPlanoId("");
    setEditingId(null);
    setDialogOpen(false);
  };

  const openEditDialog = async (m: Membro) => {
    setIsEditingLoading(true);
    setDialogOpen(true);
    setEditingId(m.id);

    try {
      // garante um orgId válido (evita ".eq('org_id','')" => invalid input syntax for uuid: "")
      const validOrg = orgId ?? (await ensureValidOrgId());

      // monta a query condicionando o filtro de org_id
      let query = supabase
        .from("membros")
        .select(`
          id, org_id, nome, matricula, ativo,
          telefone, email,
          dt_nascimento, endereco, bairro, cep,
          cidade, uf, numero, complemento, profissao,
          data_admissao_terreiro,
          observacoes,
          tipo_pessoa,
          docs,
          espiritual_umbanda,
          espiritual_candomble,
          digina
        `)
        .eq("id", m.id);

      if (validOrg) {
        query = query.eq("org_id", validOrg);
      }

      // maybeSingle não estoura erro por múltiplos/nenhum; data pode vir null
      const { data: full, error } = await query.maybeSingle();

      if (error) throw error;
      if (!full) {
        throw new Error("Membro não encontrado para este terreiro.");
      }

      const mm = full as any;

      const obsString =
        typeof mm.observacoes === "string"
          ? mm.observacoes
          : (mm?.observacoes?.texto ??
            (mm?.observacoes ? JSON.stringify(mm.observacoes) : ""));

      setFormData((f) => ({
        ...f,
        nome: mm.nome ?? "",
        matricula: mm.matricula ?? "",
        dt_nascimento: mm.dt_nascimento ?? "",
        telefone: mm.telefone ?? "",
        email: mm.email ?? "",
        endereco: mm.endereco ?? "",
        bairro: mm.bairro ?? "",
        cep: mm.cep ?? "",
        cidade: mm.cidade ?? "",
        uf: mm.uf ?? "",
        numero: mm.numero ?? "",
        complemento: mm.complemento ?? "",
        profissao: mm.profissao ?? "",
        data_admissao_terreiro: mm.data_admissao_terreiro ?? "",
        ativo: !!mm.ativo,
        observacoes: obsString,
        tipo_pessoa: (mm.tipo_pessoa as "PF" | "PJ") ?? "PF",
        docs_pf: {
          cpf: mm?.docs?.cpf ?? "",
          rg: mm?.docs?.rg ?? "",
          orgao_emissor: mm?.docs?.orgao_emissor ?? "",
          dt_emissao: mm?.docs?.dt_emissao ?? "",
        },
        docs_pj: {
          razao_social: mm?.docs?.razao_social ?? "",
          cnpj: mm?.docs?.cnpj ?? "",
          ie: mm?.docs?.ie ?? "",
          im: mm?.docs?.im ?? "",
        },
        umbanda: {
          orixas: mm?.espiritual_umbanda?.orixas ?? ["", "", "", ""],
          pretoVelho: mm?.espiritual_umbanda?.pretoVelho ?? ["", ""],
          exu: mm?.espiritual_umbanda?.exu ?? ["", ""],
          pombaGira: mm?.espiritual_umbanda?.pombaGira ?? ["", ""],
          caboclo: mm?.espiritual_umbanda?.caboclo ?? ["", ""],
          ere: mm?.espiritual_umbanda?.ere ?? ["", ""],
          outros: mm?.espiritual_umbanda?.outros ?? "",
        },
        candomble: {
          orixas: mm?.espiritual_candomble?.orixas?.length
            ? mm.espiritual_candomble.orixas
            : [
                { nome: "", qualidade: "" },
                { nome: "", qualidade: "" },
                { nome: "", qualidade: "" },
                { nome: "", qualidade: "" },
              ],
          obrigacoes: mm?.espiritual_candomble?.obrigacoes?.length
            ? mm.espiritual_candomble.obrigacoes
            : [
                { nome: "", data: "" },
                { nome: "", data: "" },
                { nome: "", data: "" },
                { nome: "", data: "" },
              ],
          digina: mm?.digina ?? "",
        },
      }));

      setSelectedTerreiroId(mm.org_id ?? validOrg ?? "");
    } catch (e: any) {
      toast({
        title: "Erro ao carregar membro",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
      setDialogOpen(false);
      setEditingId(null);
    } finally {
      setIsEditingLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const validOrg = await ensureValidOrgId();
      const chosen = isSuperadmin ? (selectedTerreiroId || validOrg) : validOrg;

      const { data: terr } = await supabase.from("terreiros").select("id").eq("id", chosen).maybeSingle();
      if (!terr) {
        return toast({ title: "Terreiro inválido", description: "Selecione um terreiro válido.", variant: "destructive" });
      }

      // PLANO obrigatório ao criar
      if (!editingId && !selectedPlanoId) {
        return toast({ title: "Plano obrigatório", description: "Selecione o plano do membro.", variant: "destructive" });
      }

      const payload = buildPayload(chosen);

      if (editingId) {
        const { error } = await supabase.from("membros").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Membro atualizado", description: `${payload.nome} foi atualizado com sucesso` });
      } else {
        const { data: created, error } = await supabase.from("membros").insert(payload).select("*").single();
        if (error) throw error;

        // cria assinatura + 24 faturas
        if (selectedPlanoId) {
          const inicioDate = (formData.data_admissao_terreiro?.trim()
            ? formData.data_admissao_terreiro
            : new Date().toISOString().slice(0, 10));

          const { data: assinatura, error: subErr } = await supabase
            .from("assinaturas")
            .insert({
              membro_id: created.id,
              plano_id: selectedPlanoId,
              terreiro_id: chosen,
              org_id: chosen,
              inicio: inicioDate,
              status: "ativa",
            })
            .select("id")
            .single();

          if (subErr || !assinatura?.id) {
            toast({ title: "Membro cadastrado, problema na assinatura", description: subErr?.message ?? "", variant: "destructive" });
          } else {
            try {
              await generate24Invoices({
                assinatura_id: assinatura.id,
                membro_id: created.id,
                plano_id: selectedPlanoId,
                org: chosen,
                inicioISO: inicioDate,
              });
              toast({ title: "Assinatura criada", description: "Geramos 24 faturas futuras." });
            } catch (fatErr: any) {
              toast({ title: "Assinatura criada, falha nas faturas", description: fatErr?.message ?? "", variant: "destructive" });
            }
          }
        }

        toast({ title: "Membro cadastrado", description: `${payload.nome} foi cadastrado com sucesso` });
      }

      resetForm();
      if (isVisible) loadMembros();
    } catch (error: any) {
      toast({ title: "Erro ao salvar membro", description: error?.message ?? "Verifique os dados e tente novamente", variant: "destructive" });
    }
  };

  const handleDelete = async (membro: Membro) => {
    try {
      const { error } = await supabase.from("membros").delete().eq("id", membro.id);
      if (error) throw error;
      toast({ title: "Membro excluído", description: `${membro.nome} foi excluído do sistema` });
      if (isVisible) loadMembros();
    } catch (error: any) {
      toast({ title: "Erro ao excluir membro", description: error?.message ?? "Tente novamente", variant: "destructive" });
    }
  };
  
  const handleToggleAtivo = async (m: Membro) => {
    try {
      if (!m?.id) throw new Error("ID do membro ausente.");
      if (!orgId) throw new Error("orgId não definido na sessão.");

      const novo = !m.ativo;

      const { data, error, status } = await supabase
        .from("membros")
        .update({ ativo: novo, updated_at: new Date().toISOString() })
        .eq("id", m.id)
        .eq("org_id", orgId)
        .select("id, ativo")
        .single();

      if (error) {
        console.error("supabase update error", { status, error_message: error.message, id: m.id, orgId });
        throw error;
      }

      // 🔗 SINCRONIZA assinaturas e faturas
      const { error: rpcErr } = await supabase.rpc("sync_membro_status", {
        m_membro_id: m.id,
        m_org_id: orgId,
        m_ativo: novo,
      });
      if (rpcErr) {
        console.error("sync_membro_status error", rpcErr);
        // Não dá rollback no membro, só avisa que efeitos colaterais falharam
        // (se quiser, você pode tratar diferente)
        // segue o fluxo com feedback visual
      }

      setMembros(prev => prev.map(x => (x.id === data!.id ? { ...x, ativo: data!.ativo } : x)));

      toast({
        title: novo ? "Membro ativado" : "Membro inativado",
        description: novo
          ? `${m.nome} reativado. Assinaturas reativadas e faturas futuras (re)geradas.`
          : `${m.nome} inativado. Assinaturas pausadas e faturas futuras removidas.`,
      });

      // (opcional) recarregar listas associadas
      // await loadMembros();
    } catch (e: any) {
      toast({ title: "Erro ao atualizar status", description: e?.message ?? "Tente novamente", variant: "destructive" });
    }
  };






  const OBRIGACOES = ["Bori", "Yawo", "Vodunsei", "Egbomi"];

  // --------- Excel helpers ----------
  const getXLSX = async () => {
    // dynamic import evita pesar o bundle inicial
    const XLSX = await import("xlsx");
    return XLSX;
  };

  const templateHeaders = [
    "nome","matricula","dt_nascimento","telefone","email","endereco","bairro","cep","cidade","uf","numero","complemento","profissao","data_admissao_terreiro","ativo","tipo_pessoa",
    "docs_pf.cpf","docs_pf.rg","docs_pf.orgao_emissor","docs_pf.dt_emissao",
    "docs_pj.razao_social","docs_pj.cnpj","docs_pj.ie","docs_pj.im",
    "umbanda.orixas[0]","umbanda.orixas[1]","umbanda.orixas[2]","umbanda.orixas[3]",
    "umbanda.pretoVelho[0]","umbanda.pretoVelho[1]",
    "umbanda.exu[0]","umbanda.exu[1]",
    "umbanda.pombaGira[0]","umbanda.pombaGira[1]",
    "umbanda.caboclo[0]","umbanda.caboclo[1]",
    "umbanda.ere[0]","umbanda.ere[1]",
    "umbanda.outros",
    "candomble.digina",
    "candomble.orixas[0].nome","candomble.orixas[0].qualidade",
    "candomble.orixas[1].nome","candomble.orixas[1].qualidade",
    "candomble.orixas[2].nome","candomble.orixas[2].qualidade",
    "candomble.orixas[3].nome","candomble.orixas[3].qualidade",
    "candomble.obrigacoes[0].nome","candomble.obrigacoes[0].data",
    "candomble.obrigacoes[1].nome","candomble.obrigacoes[1].data",
    "candomble.obrigacoes[2].nome","candomble.obrigacoes[2].data",
    "candomble.obrigacoes[3].nome","candomble.obrigacoes[3].data",
    "plano_id","plano_nome"
  ] as const;

  const downloadTemplateExcel = async () => {
    try {
      const XLSX = await getXLSX();
      const exampleRow: Record<string, any> = {};
      templateHeaders.forEach(h => exampleRow[h] = "");

      // exemplo mínimo
      exampleRow["nome"] = "Fulano de Tal";
      exampleRow["matricula"] = `${new Date().getFullYear()}-001`;
      exampleRow["data_admissao_terreiro"] = new Date().toISOString().slice(0,10);
      exampleRow["ativo"] = true;
      exampleRow["tipo_pessoa"] = "PF";
      exampleRow["umbanda.orixas[0]"] = "Oxalá";
      exampleRow["candomble.digina"] = "";
      exampleRow["plano_nome"] = (planos[0]?.nome ?? "");

      const ws = XLSX.utils.json_to_sheet([exampleRow], { header: templateHeaders as any });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "membros_template.xlsx";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast({ title: "Falha ao gerar template", description: e?.message ?? "", variant: "destructive" });
    }
  };

  const flattenMembro = (m: any) => {
    const row: Record<string, any> = {};
    const get = (obj: any, path: string, def?: any) => {
      try {
        return path.split(".").reduce((o, k) => o?.[k], obj) ?? def;
      } catch { return def; }
    };

    // básicos
    row["nome"] = m.nome ?? "";
    row["matricula"] = m.matricula ?? "";
    row["dt_nascimento"] = m.dt_nascimento ?? "";
    row["telefone"] = m.telefone ?? "";
    row["email"] = m.email ?? "";
    row["endereco"] = m.endereco ?? "";
    row["bairro"] = m.bairro ?? "";
    row["cep"] = m.cep ?? "";
    row["cidade"] = m.cidade ?? "";
    row["uf"] = m.uf ?? "";
    row["numero"] = m.numero ?? "";
    row["complemento"] = m.complemento ?? "";
    row["profissao"] = m.profissao ?? "";
    row["data_admissao_terreiro"] = m.data_admissao_terreiro ?? "";
    row["ativo"] = !!m.ativo;
    row["tipo_pessoa"] = m.tipo_pessoa ?? "PF";

    // docs
    row["docs_pf.cpf"] = get(m, "docs.cpf", "");
    row["docs_pf.rg"] = get(m, "docs.rg", "");
    row["docs_pf.orgao_emissor"] = get(m, "docs.orgao_emissor", "");
    row["docs_pf.dt_emissao"] = get(m, "docs.dt_emissao", "");
    row["docs_pj.razao_social"] = get(m, "docs.razao_social", "");
    row["docs_pj.cnpj"] = get(m, "docs.cnpj", "");
    row["docs_pj.ie"] = get(m, "docs.ie", "");
    row["docs_pj.im"] = get(m, "docs.im", "");

    // umbanda
    const umb = m.espiritual_umbanda ?? {};
    const arr = (x?: any[], n=2) => Array.from({length:n}, (_,i)=>x?.[i] ?? "");
    const arr4 = (x?: any[], n=4) => Array.from({length:n}, (_,i)=>x?.[i] ?? "");
    const orixas4 = arr4(umb.orixas, 4);
    row["umbanda.orixas[0]"] = orixas4[0];
    row["umbanda.orixas[1]"] = orixas4[1];
    row["umbanda.orixas[2]"] = orixas4[2];
    row["umbanda.orixas[3]"] = orixas4[3];
    const pv2 = arr(umb.pretoVelho, 2);
    row["umbanda.pretoVelho[0]"] = pv2[0];
    row["umbanda.pretoVelho[1]"] = pv2[1];
    const exu2 = arr(umb.exu, 2);
    row["umbanda.exu[0]"] = exu2[0];
    row["umbanda.exu[1]"] = exu2[1];
    const pg2 = arr(umb.pombaGira, 2);
    row["umbanda.pombaGira[0]"] = pg2[0];
    row["umbanda.pombaGira[1]"] = pg2[1];
    const cab2 = arr(umb.caboclo, 2);
    row["umbanda.caboclo[0]"] = cab2[0];
    row["umbanda.caboclo[1]"] = cab2[1];
    const ere2 = arr(umb.ere, 2);
    row["umbanda.ere[0]"] = ere2[0];
    row["umbanda.ere[1]"] = ere2[1];
    row["umbanda.outros"] = umb.outros ?? "";

    // candomblé
    row["candomble.digina"] = m.digina ?? "";
    const cor = m.espiritual_candomble?.orixas ?? [];
    for (let i=0;i<4;i++){
      row[`candomble.orixas[${i}].nome`] = cor?.[i]?.nome ?? "";
      row[`candomble.orixas[${i}].qualidade`] = cor?.[i]?.qualidade ?? "";
    }
    const obr = m.espiritual_candomble?.obrigacoes ?? [];
    for (let i=0;i<4;i++){
      row[`candomble.obrigacoes[${i}].nome`] = obr?.[i]?.nome ?? "";
      row[`candomble.obrigacoes[${i}].data`] = obr?.[i]?.data ?? "";
    }

    // colunas auxiliares para import
    row["plano_id"] = "";
    row["plano_nome"] = "";

    return row;
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await getXLSX();
      // busca completa para export
      const { data, error } = await supabase
        .from("membros")
        .select(`
          id, org_id, nome, matricula, ativo,
          telefone, email,
          dt_nascimento, endereco, bairro, cep,
          cidade, uf, numero, complemento, profissao,
          data_admissao_terreiro,
          observacoes,
          tipo_pessoa, docs,
          espiritual_umbanda,
          espiritual_candomble,
          digina
        `)
        .eq("org_id", orgId!);
      if (error) throw error;

      const rows = (data ?? []).map(flattenMembro);
      const ws = XLSX.utils.json_to_sheet(rows, { header: templateHeaders as any });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Membros");
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `membros_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Exportado", description: `Exportamos ${rows.length} registro(s).` });
    } catch (e: any) {
      toast({ title: "Falha ao exportar", description: e?.message ?? "", variant: "destructive" });
    }
  };

  const parseRowToPayload = (row: Record<string, any>) => {
    const toArr = (keys: string[]) => keys.map(k => (row[k] ?? "").toString().trim()).filter(Boolean);
    const toArr2 = (base: string, n: number) => Array.from({length:n}, (_,i)=> (row[`${base}[${i}]`] ?? "").toString().trim()).filter(Boolean);
    const toPairs = (base: string, n: number) => {
      const arr: {nome:string, qualidade?:string|null, data?:string|null}[] = [];
      for (let i=0;i<n;i++){
        const nome = (row[`${base}[${i}].nome`] ?? "").toString().trim();
        const qualidade = (row[`${base}[${i}].qualidade`] ?? "").toString().trim();
        const data = (row[`${base}[${i}].data`] ?? "").toString().trim();
        if (nome) arr.push({ nome, ...(qualidade?{qualidade}:{ }), ...(data?{data}:{}) });
      }
      return arr;
    };

    const tipo = (row["tipo_pessoa"] ?? "PF").toString().trim().toUpperCase() as TipoPessoa;

    const payload: any = {
      nome: (row["nome"] ?? "").toString().trim(),
      matricula: (row["matricula"] ?? "").toString().trim() || null,
      dt_nascimento: (row["dt_nascimento"] ?? "").toString().trim() || null,
      telefone: (row["telefone"] ?? "").toString().trim() || null,
      email: (row["email"] ?? "").toString().trim() || null,
      endereco: (row["endereco"] ?? "").toString().trim() || null,
      bairro: (row["bairro"] ?? "").toString().trim() || null,
      cep: (row["cep"] ?? "").toString().trim() || null,
      cidade: (row["cidade"] ?? "").toString().trim() || null,
      uf: (row["uf"] ?? "").toString().trim() || null,
      numero: (row["numero"] ?? "").toString().trim() || null,
      complemento: (row["complemento"] ?? "").toString().trim() || null,
      profissao: (row["profissao"] ?? "").toString().trim() || null,
      data_admissao_terreiro: (row["data_admissao_terreiro"] ?? "").toString().trim() || null,
      ativo: String(row["ativo"]).toLowerCase() === "true" || row["ativo"] === true || row["ativo"] === "1",
      tipo_pessoa: tipo,
      docs: tipo === "PF"
        ? {
            tipo: "PF",
            cpf: (row["docs_pf.cpf"] ?? "").toString().trim() || null,
            rg: (row["docs_pf.rg"] ?? "").toString().trim() || null,
            orgao_emissor: (row["docs_pf.orgao_emissor"] ?? "").toString().trim() || null,
            dt_emissao: (row["docs_pf.dt_emissao"] ?? "").toString().trim() || null,
          }
        : {
            tipo: "PJ",
            razao_social: (row["docs_pj.razao_social"] ?? "").toString().trim() || null,
            cnpj: (row["docs_pj.cnpj"] ?? "").toString().trim() || null,
            ie: (row["docs_pj.ie"] ?? "").toString().trim() || null,
            im: (row["docs_pj.im"] ?? "").toString().trim() || null,
          },
      espiritual_umbanda: {
        orixas: toArr2("umbanda.orixas", 4),
        pretoVelho: toArr2("umbanda.pretoVelho", 2),
        exu: toArr2("umbanda.exu", 2),
        pombaGira: toArr2("umbanda.pombaGira", 2),
        caboclo: toArr2("umbanda.caboclo", 2),
        ere: toArr2("umbanda.ere", 2),
        outros: (row["umbanda.outros"] ?? "").toString().trim() || null,
      },
      espiritual_candomble: {
        orixas: toPairs("candomble.orixas", 4).map(o => ({ nome: o.nome, ...(o.qualidade?{qualidade:o.qualidade}:{}) })),
        obrigacoes: toPairs("candomble.obrigacoes", 4).map(o => ({ nome: o.nome, ...(o.data?{data:o.data}:{}) })),
      },
      digina: (row["candomble.digina"] ?? "").toString().trim() || null,
    };

    const plano_id = (row["plano_id"] ?? "").toString().trim();
    const plano_nome = (row["plano_nome"] ?? "").toString().trim();
    return { payload, plano_id, plano_nome };
  };

  const findPlanoId = async (maybeId: string, maybeName: string, org: string) => {
    if (maybeId) return maybeId;
    if (!maybeName) return "";
    const { data } = await supabase
      .from("planos")
      .select("id,nome,terreiro_id,org_id,ativo")
      .or(`terreiro_id.eq.${org},org_id.eq.${org}`)
      .ilike("nome", `%${maybeName}%`)
      .limit(1);
    return data?.[0]?.id ?? "";
  };

  const importFromExcel = async (file: File) => {
    try {
      if (!orgId) throw new Error("Sem org_id");
      const XLSX = await getXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

      if (!rows.length) {
        toast({ title: "Planilha vazia", description: "Nenhuma linha encontrada.", variant: "destructive" });
        return;
      }

      let ok = 0, fail = 0, assin = 0, faturas = 0;

      for (const row of rows) {
        try {
          const { payload, plano_id, plano_nome } = parseRowToPayload(row);
          if (!payload.nome) continue;
          payload.org_id = orgId;

          // upsert por (org_id + matricula) ou (org_id + nome) se matricula ausente
          let existing: any = null;
          if (payload.matricula) {
            const { data } = await supabase
              .from("membros")
              .select("id")
              .eq("org_id", orgId)
              .eq("matricula", payload.matricula)
              .maybeSingle();
            existing = data;
          } else {
            const { data } = await supabase
              .from("membros")
              .select("id")
              .eq("org_id", orgId)
              .ilike("nome", payload.nome)
              .maybeSingle();
            existing = data;
          }

          let membroId = existing?.id as string | undefined;

          if (membroId) {
            const { error } = await supabase.from("membros").update(payload).eq("id", membroId);
            if (error) throw error;
          } else {
            const { data: created, error } = await supabase.from("membros").insert(payload).select("id").single();
            if (error) throw error;
            membroId = created.id;
          }

          ok++;

          // assinatura + 24 faturas se plano informado
          const planId = await findPlanoId(plano_id, plano_nome, orgId);
          if (planId) {
            const inicioDate = payload.data_admissao_terreiro || new Date().toISOString().slice(0, 10);
            const { data: assinatura, error: subErr } = await supabase
              .from("assinaturas")
              .insert({
                membro_id: membroId,
                plano_id: planId,
                terreiro_id: orgId,
                org_id: orgId,
                inicio: inicioDate,
                status: "ativa",
              })
              .select("id")
              .single();
            if (!subErr && assinatura?.id) {
              assin++;
              try {
                await generate24Invoices({
                  assinatura_id: assinatura.id,
                  membro_id: membroId,
                  plano_id: planId,
                  org: orgId,
                  inicioISO: inicioDate,
                });
                faturas += 24;
              } catch { /* continua */ }
            }
          }
        } catch {
          fail++;
        }
      }

      toast({
        title: "Importação concluída",
        description: `Sucesso: ${ok} • Falhas: ${fail} • Assinaturas: ${assin} • Faturas geradas: ${faturas}`,
      });
      loadMembros();
    } catch (e: any) {
      toast({ title: "Falha ao importar", description: e?.message ?? "", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // paginação helpers
  const totalPages = Math.max(1, Math.ceil(resultCount / pageSize));

  return (
    <DashboardLayout>
      <FeatureGate feature="membros" fallback={<UpgradeCard needed="Membros" />}>
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Membros
            </h1>
            <p className="text-muted-foreground">
              Gerencie os membros (filhos de santo) do terreiro
            </p>
          </div>

          {/* Ações: Template / Importar / Exportar */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFromExcel(f);
              }}
            />
            <Button variant="outline" onClick={downloadTemplateExcel} title="Baixar template Excel">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Template
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} title="Importar Excel">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button variant="outline" onClick={exportToExcel} title="Exportar Excel">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* filtros */}
        <div className="mt-2 md:mt-0 space-y-6">
          <div className="sticky top-16 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border/50 rounded-xl">
            <div className="p-3 md:p-4 flex flex-col gap-3 md:flex-row md:items-center">
              {/* busca */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por membro, matrícula ou plano..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* status */}
              <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>

              {/* ordenar por */}
              <Select value={sortField} onValueChange={(v: "nome" | "matricula") => setSortField(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome">Nome</SelectItem>
                  <SelectItem value="matricula">Matrícula</SelectItem>
                </SelectContent>
              </Select>

              {/* direção */}
              <Select value={sortDir} onValueChange={(v: "asc" | "desc") => setSortDir(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Direção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Crescente</SelectItem>
                  <SelectItem value="desc">Decrescente</SelectItem>
                </SelectContent>
              </Select>

              {/* novo membro */}
              <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (open) {
                    const tid = selectedTerreiroId || orgId || "";
                    if (tid) {
                      loadPlanosByTerreiro(tid);
                      sugerirProximaMatricula(tid);
                    }
                  }
                }}
              >
                <Button
                  type="button"
                  onClick={() => {
                    resetForm();
                    const tid = orgId ?? "";
                    setSelectedTerreiroId(tid);
                    setDialogOpen(true);
                    if (tid) {
                      loadPlanosByTerreiro(tid);
                      sugerirProximaMatricula(tid);
                    }
                  }}
                  className="bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Membro
                </Button>

                {/* dialogo de cadastro/edicao */}
                <DialogContent className="w-full max-w-[95vw] md:max-w-[52vw] max-h-[92vh] overflow-y-auto z-[300]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      {editingId ? "Editar Membro" : "Novo Membro"}
                      <FileBadge2 className="h-4 w-4 text-muted-foreground" />
                    </DialogTitle>
                    <DialogDescription>
                      {editingId ? "Atualize os dados do membro" : "Cadastre um novo membro (filho de santo)"}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Tabs defaultValue="principal" className="w-full">
                      <TabsList className="mb-4 flex flex-wrap gap-2 justify-start border-b border-border/50 overflow-x-auto">
                        <TabsTrigger value="principal" className="px-4 py-1 rounded-lg">1. Principal</TabsTrigger>
                        <TabsTrigger value="endereco" className="px-4 py-1 rounded-lg">2. Endereço & Profissão</TabsTrigger>
                        <TabsTrigger value="umbanda" className="px-4 py-1 rounded-lg">3. Espiritual (Umbanda)</TabsTrigger>
                        <TabsTrigger value="candomble" className="px-4 py-1 rounded-lg">4. Espiritual (Candomblé)</TabsTrigger>
                        <TabsTrigger value="docs" className="px-4 py-1 rounded-lg">5. Documentação</TabsTrigger>
                      </TabsList>

                      {/* principal */}
                      <TabsContent value="principal" className="space-y-4">
                        <SectionHeader
                          icon={Users}
                          title="Dados principais"
                          description="Informações básicas e vínculo ao terreiro/plano."
                          className="mb-2"
                        />
                        <TextGrid>
                          {/* Terreiro */}
                          <div className="space-y-2">
                            <Label htmlFor="terreiro">Terreiro *</Label>
                            <Select
                              value={selectedTerreiroId || orgId || ""}
                              onValueChange={(val) => {
                                if (!isSuperadmin && val !== orgId) return;
                                setSelectedTerreiroId(val);
                                loadPlanosByTerreiro(val);
                                sugerirProximaMatricula(val);
                              }}
                            >
                              <SelectTrigger id="terreiro" className={!isSuperadmin ? "opacity-80 cursor-not-allowed" : ""} disabled={!isSuperadmin}>
                                <SelectValue placeholder="Selecione o terreiro" />
                              </SelectTrigger>
                              <SelectContent className="z-[400]" position="popper" sideOffset={6}>
                                {orgId && <SelectItem value={orgId}>Terreiro do Perfil{orgNome ? ` — ${orgNome}` : ""}</SelectItem>}
                                {isSuperadmin && terreiros.filter(t => t.id !== orgId).map(t => (
                                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="matricula">Matrícula</Label>
                            <Input id="matricula" value={formData.matricula} onChange={(e) => setFormData({ ...formData, matricula: e.target.value })} placeholder="ex.: 2025-001" />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="nome">Nome completo *</Label>
                            <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="dt_nascimento">Data de nascimento</Label>
                            <Input id="dt_nascimento" type="date" value={formData.dt_nascimento} onChange={(e) => setFormData({ ...formData, dt_nascimento: e.target.value })} />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="data_admissao_terreiro">Data de admissão</Label>
                            <Input id="data_admissao_terreiro" type="date" value={formData.data_admissao_terreiro} onChange={(e) => setFormData({ ...formData, data_admissao_terreiro: e.target.value })} />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="telefone">Telefone</Label>
                            <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                          </div>
                        </TextGrid>

                        <div className="space-y-2">
                          <Label htmlFor="observacoes">Observações</Label>
                          <Textarea id="observacoes" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Observações sobre o membro..." />
                        </div>

                        {/* Plano obrigatório no cadastro */}
                        <div className="space-y-2">
                          <Label htmlFor="plano">Plano de início *</Label>
                          <Select value={selectedPlanoId} onValueChange={setSelectedPlanoId}>
                            <SelectTrigger id="plano">
                              <SelectValue placeholder={planos.length ? "Selecione o plano" : "Nenhum plano disponível para este terreiro"} />
                            </SelectTrigger>
                            <SelectContent className="z-[400]" position="popper" sideOffset={6}>
                              {planos.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Ao salvar, criaremos uma <strong>assinatura ativa</strong> com a <strong>data de admissão</strong> e <strong>24 faturas</strong>.
                          </p>
                        </div>

                        {isEditingLoading && (
                          <div className="text-sm text-muted-foreground">Carregando dados completos…</div>
                        )}
                      </TabsContent>

                      {/* Endereço & Profissão */}
                      <TabsContent value="endereco" className="space-y-4">
                        <SectionHeader icon={MapPin} title="Endereço & Profissão" description="Endereço completo e profissão." className="mb-2" />
                        <TextGrid>
                          <div className="space-y-2"><Label>Logradouro</Label><Input value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} placeholder="Rua..." /></div>
                          <div className="space-y-2"><Label>Número</Label><Input value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} /></div>
                          <div className="space-y-2"><Label>Complemento</Label><Input value={formData.complemento} onChange={(e) => setFormData({ ...formData, complemento: e.target.value })} /></div>
                          <div className="space-y-2"><Label>Bairro</Label><Input value={formData.bairro} onChange={(e) => setFormData({ ...formData, bairro: e.target.value })} /></div>
                          <div className="space-y-2"><Label>Cidade</Label><Input value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} /></div>
                          <div className="space-y-2"><Label>UF</Label><Input value={formData.uf} onChange={(e) => setFormData({ ...formData, uf: e.target.value })} maxLength={2} /></div>
                          <div className="space-y-2"><Label>CEP</Label><Input value={formData.cep} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} /></div>
                          <div className="space-y-2"><Label>Profissão</Label><Input value={formData.profissao} onChange={(e) => setFormData({ ...formData, profissao: e.target.value })} /></div>
                        </TextGrid>
                      </TabsContent>

                      {/* Umbanda */}
                      <TabsContent value="umbanda" className="space-y-4">
                        <SectionHeader icon={Flower2} title="Umbanda" description="Guias e Orixás de Umbanda." className="mb-2" />
                        <div className="space-y-2">
                          <Label>Orixás</Label>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            {formData.umbanda.orixas.map((v, i) => (
                              <Input key={`orixa-${i}`} placeholder={`Orixá ${i + 1}`} value={v}
                                onChange={(e) => {
                                  const arr = [...formData.umbanda.orixas]; arr[i] = e.target.value;
                                  setFormData({ ...formData, umbanda: { ...formData.umbanda, orixas: arr } });
                                }} />
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[
                            { key: "pretoVelho", label: "Preto Velho" },
                            { key: "exu", label: "Exu" },
                            { key: "pombaGira", label: "Pomba Gira" },
                            { key: "caboclo", label: "Caboclo" },
                            { key: "ere", label: "Erê" },
                          ].map(({ key, label }) => (
                            <div key={key} className="space-y-2">
                              <Label>{label}</Label>
                              <div className="grid grid-cols-2 gap-2">
                                {[0, 1].map((idx) => (
                                  <Input key={`${key}-${idx}`} placeholder={`${label} ${idx + 1}`}
                                    value={(formData.umbanda as any)[key]?.[idx] || ""}
                                    onChange={(e) => {
                                      const list = [...((formData.umbanda as any)[key] as string[])];
                                      list[idx] = e.target.value;
                                      setFormData({ ...formData, umbanda: { ...formData.umbanda, [key]: list } as any });
                                    }} />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <Label>Outros guias</Label>
                          <Input placeholder="Outros guias/entidades" value={formData.umbanda.outros}
                            onChange={(e) => setFormData({ ...formData, umbanda: { ...formData.umbanda, outros: e.target.value } })} />
                        </div>
                      </TabsContent>

                      {/* Candomblé */}
                      <TabsContent value="candomble" className="space-y-4">
                        <SectionHeader icon={Briefcase} title="Candomblé" description="Orixás com qualidade e Obrigações." className="mb-2" />

                        {/* Digina */}
                        <div className="space-y-2">
                          <Label>Digina</Label>
                          <Input
                            placeholder="Ex.: Digina do filho de santo"
                            value={formData.candomble.digina}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                candomble: { ...formData.candomble, digina: e.target.value },
                              })
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Orixás (com qualidade)</Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {formData.candomble.orixas.map((o, i) => (
                              <div key={`cand-orixa-${i}`} className="grid grid-cols-2 gap-2">
                                <Input placeholder={`Orixá ${i + 1}`} value={o.nome}
                                  onChange={(e) => {
                                    const arr = [...formData.candomble.orixas]; arr[i] = { ...arr[i], nome: e.target.value };
                                    setFormData({ ...formData, candomble: { ...formData.candomble, orixas: arr } });
                                  }} />
                                <Input placeholder="Qualidade" value={o.qualidade}
                                  onChange={(e) => {
                                    const arr = [...formData.candomble.orixas]; arr[i] = { ...arr[i], qualidade: e.target.value };
                                    setFormData({ ...formData, candomble: { ...formData.candomble, orixas: arr } });
                                  }} />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Obrigações</Label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {formData.candomble.obrigacoes.map((o, i) => (
                              <div key={`obr-${i}`} className="grid grid-cols-2 gap-2 items-center">
                                <Select value={o.nome} onValueChange={(v) => {
                                  const arr = [...formData.candomble.obrigacoes]; arr[i] = { ...arr[i], nome: v };
                                  setFormData({ ...formData, candomble: { ...formData.candomble, obrigacoes: arr } });
                                }}>
                                  <SelectTrigger className="z-[400]">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent className="z-[400]">
                                    {OBRIGACOES.map((n) => <SelectItem key={`${n}-${i}`} value={n}>{n}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Input type="date" value={o.data} onChange={(e) => {
                                  const arr = [...formData.candomble.obrigacoes]; arr[i] = { ...arr[i], data: e.target.value };
                                  setFormData({ ...formData, candomble: { ...formData.candomble, obrigacoes: arr } });
                                }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>

                      {/* Documentação */}
                      <TabsContent value="docs" className="space-y-4">
                        <SectionHeader icon={FileText} title="Documentação" description="PF/PJ e documentos." className="mb-2" />
                        <div className="space-y-2">
                          <Label>Tipo de pessoa</Label>
                          <Select value={formData.tipo_pessoa} onValueChange={(v: any) => setFormData({ ...formData, tipo_pessoa: v as TipoPessoa })}>
                            <SelectTrigger className="z-[400]"><SelectValue /></SelectTrigger>
                            <SelectContent className="z-[400]">
                              <SelectItem value="PF">Pessoa Física</SelectItem>
                              <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {formData.tipo_pessoa === "PF" ? (
                          <TextGrid>
                            <div className="space-y-2"><Label>CPF</Label><Input value={formData.docs_pf.cpf} onChange={(e) => setFormData({ ...formData, docs_pf: { ...formData.docs_pf, cpf: e.target.value } })} /></div>
                            <div className="space-y-2"><Label>RG</Label><Input value={formData.docs_pf.rg} onChange={(e) => setFormData({ ...formData, docs_pf: { ...formData.docs_pf, rg: e.target.value } })} /></div>
                            <div className="space-y-2"><Label>Órgão emissor</Label><Input value={formData.docs_pf.orgao_emissor} onChange={(e) => setFormData({ ...formData, docs_pf: { ...formData.docs_pf, orgao_emissor: e.target.value } })} /></div>
                            <div className="space-y-2"><Label>Data emissão</Label><Input type="date" value={formData.docs_pf.dt_emissao} onChange={(e) => setFormData({ ...formData, docs_pf: { ...formData.docs_pf, dt_emissao: e.target.value } })} /></div>
                          </TextGrid>
                        ) : (
                          <TextGrid>
                            <div className="space-y-2"><Label>Razão Social</Label><Input value={formData.docs_pj.razao_social} onChange={(e) => setFormData({ ...formData, docs_pj: { ...formData.docs_pj, razao_social: e.target.value } })} /></div>
                            <div className="space-y-2"><Label>CNPJ</Label><Input value={formData.docs_pj.cnpj} onChange={(e) => setFormData({ ...formData, docs_pj: { ...formData.docs_pj, cnpj: e.target.value } })} /></div>
                            <div className="space-y-2"><Label>Inscrição Estadual</Label><Input value={formData.docs_pj.ie} onChange={(e) => setFormData({ ...formData, docs_pj: { ...formData.docs_pj, ie: e.target.value } })} /></div>
                            <div className="space-y-2"><Label>Inscrição Municipal</Label><Input value={formData.docs_pj.im} onChange={(e) => setFormData({ ...formData, docs_pj: { ...formData.docs_pj, im: e.target.value } })} /></div>
                          </TextGrid>
                        )}
                      </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" className="bg-gradient-sacred hover:opacity-90">
                        {editingId ? "Atualizar" : "Cadastrar"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* header com contagens */}
          <Card className="bg-card/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {resultCount} membro{resultCount !== 1 ? "s" : ""} encontrado{resultCount !== 1 ? "s" : ""}
                </span>
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                Total cadastrados: {totalCount} • Ativos: {totalActiveCount} {statusFilter === "active" ? "(listando apenas ativos)" : "(listando todos)"}
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />)}
                </div>
              ) : (
                <>
                  {/* mobile cards */}
                  <div className="grid gap-3 md:hidden">
                    {membros.map((membro) => (
                      <div key={membro.id} className="rounded-lg border border-border/50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{membro.nome}</div>
                            <div className="text-sm text-muted-foreground">Matrícula: {membro.matricula || "-"}</div>
                            <div className="text-sm text-muted-foreground">{membro.telefone || "-"} • {membro.email || "-"}</div>
                          </div>
                          <Badge variant={membro.ativo ? "default" : "secondary"}>{membro.ativo ? "Ativo" : "Inativo"}</Badge>
                        </div>

                        <div className="mt-3 flex items-center justify-end gap-2">
                          {/* Toggle Ativo/Inativo */}
                          <Button
                            size="icon"
                            disabled={!orgId}
                            variant={membro.ativo ? "secondary" : "default"}
                            onClick={() => handleToggleAtivo(membro)}
                            className="hover:bg-accent hover:text-accent-foreground"
                            title={membro.ativo ? "Inativar" : "Ativar"}
                          >
                            <Power className="h-4 w-4" />
                            <span className="sr-only">{membro.ativo ? "Inativar" : "Ativar"}</span>
                          </Button>

                          <Button size="icon" variant="outline" onClick={() => openEditDialog(membro)} className="hover:bg-accent hover:text-accent-foreground" title="Editar">
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="outline" className="hover:bg-destructive hover:text-destructive-foreground" title="Excluir">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Excluir</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>Tem certeza que deseja excluir {membro.nome}? Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(membro)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* desktop tabela */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead>Nome</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[1%] whitespace-nowrap text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {membros.map((membro) => (
                          <TableRow key={membro.id} className="border-border/50">
                            <TableCell className="font-medium">{membro.nome}</TableCell>
                            <TableCell>{membro.matricula || "-"}</TableCell>
                            <TableCell>{membro.telefone || "-"}</TableCell>
                            <TableCell>{membro.email || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={membro.ativo ? "default" : "secondary"}>{membro.ativo ? "Ativo" : "Inativo"}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Toggle Ativo/Inativo */}
                                <Button
                                  size="icon"
                                  variant={membro.ativo ? "secondary" : "default"}
                                  onClick={() => handleToggleAtivo(membro)}
                                  className="hover:bg-accent hover:text-accent-foreground"
                                  title={membro.ativo ? "Inativar" : "Ativar"}
                                >
                                  <Power className="h-4 w-4" />
                                  <span className="sr-only">{membro.ativo ? "Inativar" : "Ativar"}</span>
                                </Button>

                                <Button size="icon" variant="outline" onClick={() => openEditDialog(membro)} className="hover:bg-accent hover:text-accent-foreground" title="Editar">
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Editar</span>
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="outline" className="hover:bg-destructive hover:text-destructive-foreground" title="Excluir">
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Excluir</span>
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                      <AlertDialogDescription>Tem certeza que deseja excluir {membro.nome}? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(membro)} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
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

                  {/* paginação */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Página {page} de {totalPages} • mostrando {membros.length} de {resultCount}
                      {sortField === "matricula" && allFilteredForClientSort && allFilteredForClientSort.length > 5000 && (
                        <span className="ml-2 text-amber-600">(Exibindo os 5000 primeiros para ordenação por matrícula)</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                      <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
                    </div>
                  </div>
                </>
              )}

              {!loading && resultCount === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhum membro encontrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
