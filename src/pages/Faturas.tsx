// src/pages/Faturas.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Receipt,
  Search,
  Calendar,
  AlarmPlus,
  Zap,
  UserSearch,
  RefreshCcw,
} from "lucide-react";
import FeatureGate from "@/components/FeatureGate";
import UpgradeCard from "@/components/UpgradeCard";

/** ===================== Tipos ===================== */
type Fatura = {
  id: string;
  refer: string | null;
  dt_vencimento: string; // ISO
  valor_centavos: number;
  vl_desconto_centavos: number;
  status: string; // DB
  uiStatus: "aberta" | "paga" | "atrasada" | "cancelada" | "pausada";
  dt_pagamento?: string | null;
  vl_pago_centavos?: number | null;
  membro: { nome: string | null; matricula?: string | null };
  created_at: string;
  membro_id: string;
};

type PlanoLite = {
  id: string;
  nome: string;
  valor_centavos: number;
  dia_vencimento: number;
};

/** ===================== Utils ===================== */
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : true
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

const formatCurrency = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);

const dbStatusToUi = (db: string): Exclude<Fatura["uiStatus"], "pausada"> => {
  switch (db) {
    case "pendente":
      return "aberta";
    case "vencida":
      return "atrasada";
    case "paga":
      return "paga";
    case "cancelada":
      return "cancelada";
    default:
      return "aberta";
  }
};

const clampDiaDoMes = (ano: number, mes1a12: number, dia: number) => {
  const last = new Date(ano, mes1a12, 0).getDate();
  return Math.min(dia, last);
};

const normalizeMatricula = (raw: string) =>
  (raw || "").toString().trim().toUpperCase().replace(/[^\dA-Z]/g, "");

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const match = (haystack: unknown, needle: string) =>
  s(haystack).toLowerCase().includes((needle ?? "").toLowerCase());

/** 🔒 Helper p/ detectar violação de UNIQUE do Postgres */
const isUniqueViolation = (err: any) => {
  const msg = String(err?.message ?? err?.details ?? "");
  return (
    err?.code === "23505" ||
    msg.includes("duplicate key value") ||
    msg.includes("faturas_unq_assinatura_venc")
  );
};

/** ===================== Componente ===================== */
export default function Faturas() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "aberta" | "paga" | "atrasada" | "cancelada" | "pausada">("all");

  // Paginação (lista de Abertas)
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modo de pesquisa global (ignora paginação)
  const [searchMode, setSearchMode] = useState(false);
  const searchDebounceRef = useRef<number | null>(null);
  const loadSeqRef = useRef(0); // anti-race

  // Por matrícula (geração de uma fatura)
  const [matriculaInput, setMatriculaInput] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [salvandoMatricula, setSalvandoMatricula] = useState(false);

  // Troca de plano
  const [planos, setPlanos] = useState<PlanoLite[]>([]);
  const [planoDlgOpen, setPlanoDlgOpen] = useState(false);
  const [planoTarget, setPlanoTarget] = useState<{ membro_id: string } | null>(null);
  const [planoEscolhido, setPlanoEscolhido] = useState<string>("");
  const [salvandoPlano, setSalvandoPlano] = useState(false);

  // Estado de “Gerar faltantes (geral)”
  const [gerandoFaturas, setGerandoFaturas] = useState(false);

  const isMobile = useIsMobile();
  const mountedRef = useRef(true);
  const lastRefreshRef = useRef<number>(0);
  const { toast } = useToast();

  /** --------- Carregadores auxiliares --------- */
  const loadPlanos = async (orgId: string) => {
    if (planos.length > 0) return planos; // cache simples
    const { data, error } = await supabase
      .from("planos")
      .select("id,nome,valor_centavos,dia_vencimento,org_id,terreiro_id")
      .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`)
      .order("nome", { ascending: true });
    if (error) throw error;
    setPlanos((data ?? []) as unknown as PlanoLite[]);
    return (data ?? []) as unknown as PlanoLite[];
  };

  /** Lista paginada de ABERTAS (pendente/vencida) — usa page/hasMore */
  const fetchOpenPaginated = async (orgId: string) => {
    const from = page * PAGE_SIZE;
    const to = (page + 1) * PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from("faturas")
      .select(
        `
          id, refer, dt_vencimento, valor_centavos, vl_desconto_centavos,
          status, dt_pagamento, vl_pago_centavos, created_at,
          org_id, membro_id, assinatura_id,
          membros:membro_id ( nome, matricula ),
          assinaturas:assinatura_id ( status )
        `,
        { count: "exact" }
      )
      .eq("org_id", orgId)
      .in("status", ["pendente", "vencida"])
      .order("dt_vencimento", { ascending: true })
      .range(from, to);

    if (error) throw error;

    const mapped: Fatura[] = (data ?? []).map((f: any) => {
      const base: Fatura = {
        id: f.id,
        refer: f.refer ?? null,
        dt_vencimento: f.dt_vencimento,
        valor_centavos: f.valor_centavos,
        vl_desconto_centavos: f.vl_desconto_centavos || 0,
        status: f.status,
        uiStatus: dbStatusToUi(f.status),
        dt_pagamento: f.dt_pagamento ?? null,
        vl_pago_centavos: f.vl_pago_centavos ?? null,
        created_at: f.created_at,
        membro: { nome: f.membros?.nome ?? null, matricula: f.membros?.matricula ?? null },
        membro_id: f.membro_id,
      };
      const assinStatus = f?.assinaturas?.status as string | undefined;
      if (assinStatus && assinStatus !== "ativa" && base.uiStatus !== "paga") {
        base.uiStatus = "pausada";
      }
      return base;
    });

    await loadPlanos(orgId);
    if (!mountedRef.current) return;

    setFaturas((prev) => (page === 0 ? mapped : [...prev, ...mapped]));
    setLoading(false);

    const total = typeof count === "number" ? count : from + mapped.length + 1;
    setHasMore((page + 1) * PAGE_SIZE < total);
  };

  /** Pesquisa global (ignora paginação) — por nome/matrícula (membros) ou refer (faturas) */
  const fetchSearchGlobal = async (orgId: string, term: string) => {
    const t = term.trim();
    if (!t) return;

    // 🔧 Mais simples e rápido: restringe ao org e OR apenas no nome/matrícula
    const { data: membs, error: mErr } = await supabase
      .from("membros")
      .select("id")
      .eq("org_id", orgId)
      .or(`nome.ilike.%${t}%,matricula.ilike.%${t}%`);
    if (mErr) throw mErr;

    const memberIds = (membs ?? []).map((m) => m.id);

    let byMember: Fatura[] = [];
    if (memberIds.length > 0) {
      const { data, error } = await supabase
        .from("faturas")
        .select(
          `
            id, refer, dt_vencimento, valor_centavos, vl_desconto_centavos,
            status, dt_pagamento, vl_pago_centavos, created_at,
            org_id, membro_id, assinatura_id,
            membros:membro_id ( nome, matricula ),
            assinaturas:assinatura_id ( status )
          `
        )
        .eq("org_id", orgId)
        .in("membro_id", memberIds)
        .order("dt_vencimento", { ascending: true });
      if (error) throw error;

      byMember = (data ?? []).map((f: any) => {
        const base: Fatura = {
          id: f.id,
          refer: f.refer ?? null,
          dt_vencimento: f.dt_vencimento,
          valor_centavos: f.valor_centavos,
          vl_desconto_centavos: f.vl_desconto_centavos || 0,
          status: f.status,
          uiStatus: dbStatusToUi(f.status),
          dt_pagamento: f.dt_pagamento ?? null,
          vl_pago_centavos: f.vl_pago_centavos ?? null,
          created_at: f.created_at,
          membro: { nome: f.membros?.nome ?? null, matricula: f.membros?.matricula ?? null },
          membro_id: f.membro_id,
        };
        const assinStatus = f?.assinaturas?.status as string | undefined;
        if (assinStatus && assinStatus !== "ativa" && base.uiStatus !== "paga") {
          base.uiStatus = "pausada";
        }
        return base;
      });
    }

    const { data: byRefData, error: rErr } = await supabase
      .from("faturas")
      .select(
        `
          id, refer, dt_vencimento, valor_centavos, vl_desconto_centavos,
          status, dt_pagamento, vl_pago_centavos, created_at,
          org_id, membro_id, assinatura_id,
          membros:membro_id ( nome, matricula ),
          assinaturas:assinatura_id ( status )
        `
      )
      .eq("org_id", orgId)
      .ilike("refer", `%${t}%`)
      .order("dt_vencimento", { ascending: true });
    if (rErr) throw rErr;

    const byRef: Fatura[] = (byRefData ?? []).map((f: any) => {
      const base: Fatura = {
        id: f.id,
        refer: f.refer ?? null,
        dt_vencimento: f.dt_vencimento,
        valor_centavos: f.valor_centavos,
        vl_desconto_centavos: f.vl_desconto_centavos || 0,
        status: f.status,
        uiStatus: dbStatusToUi(f.status),
        dt_pagamento: f.dt_pagamento ?? null,
        vl_pago_centavos: f.vl_pago_centavos ?? null,
        created_at: f.created_at,
        membro: { nome: f.membros?.nome ?? null, matricula: f.membros?.matricula ?? null },
        membro_id: f.membro_id,
      };
      const assinStatus = f?.assinaturas?.status as string | undefined;
      if (assinStatus && assinStatus !== "ativa" && base.uiStatus !== "paga") {
        base.uiStatus = "pausada";
      }
      return base;
    });

    const map = new Map<string, Fatura>();
    [...byMember, ...byRef].forEach((f) => map.set(f.id, f));

    setFaturas([...map.values()]);
    setHasMore(false);
    setLoading(false);
  };

  /** --------- Ciclo de carregamento --------- */
  const baseLoad = async (opts?: { force?: boolean }) => {
    try {
      const mySeq = ++loadSeqRef.current;
      const force = !!opts?.force;

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Usuário não autenticado");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", auth.user.id)
        .single();
      if (profErr) throw profErr;

      const orgId = profile!.org_id;

      if (searchMode) {
        await fetchSearchGlobal(orgId, searchTerm);
      } else {
        if (force) {
          setPage(0);
          setHasMore(true);
          setLoading(true);
          setFaturas([]); // evita “fantasma” no mobile
        }
        await fetchOpenPaginated(orgId);
      }

      if (mySeq !== loadSeqRef.current) return;
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao carregar faturas",
        description: err?.message ?? "Tente recarregar a página",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    baseLoad();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Refresh silencioso quando volta para aba */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        if (now - lastRefreshRef.current > 90 * 1000) {
          lastRefreshRef.current = now;
          baseLoad({ force: false });
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode, searchTerm, page]);

  /** Debounce da busca — >= 2 caracteres aciona modo pesquisa global (com anti-race) */
  useEffect(() => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);

    const t = searchTerm.trim();
    searchDebounceRef.current = window.setTimeout(async () => {
      const mySeq = ++loadSeqRef.current;
      setLoading(true);

      if (t.length >= 2) {
        setSearchMode(true);
        setPage(0);
        setHasMore(false);
        await baseLoad({ force: true });
      } else {
        setSearchMode(false);
        setPage(0);
        setHasMore(true);
        await baseLoad({ force: true });
      }

      if (mySeq !== loadSeqRef.current) return;
    }, 300) as unknown as number;

    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  /** --------- Helpers de UPSERT --------- */
  const upsertFaturaAssinVenc = async (payload: {
    assinatura_id: string;
    membro_id: string;
    plano_id: string;
    org_id: string;
    terreiro_id: string;
    valor_centavos: number;
    refer?: string | null;
    data_vencimento: string; // YYYY-MM-DD
    status?: string;
    vl_desconto_centavos?: number;
    usuario_operacao?: string;
  }) => {
    const row: any = {
      ...payload,
      dt_vencimento: payload.data_vencimento,
    };

    const { error } = await supabase
      .from("faturas")
      .upsert(row, {
        onConflict: "assinatura_id,dt_vencimento",
        ignoreDuplicates: false,
      });

    if (error) throw error;
  };

  /** --------- Ações: gerar/planos/horizonte --------- */
  const gerarFaturas = async () => {
    try {
      setGerandoFaturas(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Usuário não autenticado");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", auth.user.id)
        .single();
      if (profErr) throw profErr;

      const orgId = profile!.org_id;
      const now = new Date();
      const until = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      // 1ª tentativa: função com auditoria de usuário
      let data: any;
      let error: any | null = null;
      const try1 = await supabase.rpc("generate_missing_faturas_for_org_with_user", {
        p_org_id: orgId,
        p_until: until,
        p_usuario: auth.user.email ?? auth.user.id,
      });
      data = try1.data;
      error = try1.error;

      // Fallback seguro (resolve ambiguidade: membro_id is ambiguous)
      if (error) {
        const try2 = await supabase.rpc("generate_missing_faturas_for_org", {
          p_org_id: orgId,
          p_until: until,
        });
        data = try2.data;
        if (try2.error) throw try2.error;
      }

      const total = Array.isArray(data)
        ? data.reduce((acc: number, r: any) => acc + (r.created_count ?? 0), 0)
        : Number(data ?? 0);

      if (!total || Number.isNaN(total) || total === 0) {
        toast({
          title: "Nada para gerar",
          description: "Não há faturas faltantes para aplicar no período.",
        });
      } else {
        toast({
          title: "Faturas geradas (geral)",
          description: `Criadas ${total} fatura(s) faltante(s).`,
        });
      }

      await baseLoad({ force: true });
    } catch (err: any) {
      console.error(err);
      if (isUniqueViolation(err)) {
        // Quando a função tentar inserir algo que já existe
        toast({
          title: "Nada para gerar",
          description: "As faturas deste período já existem. Nenhuma nova foi criada.",
        });
        await baseLoad({ force: true });
      } else {
        toast({
          title: "Erro ao gerar faturas",
          description: err?.message ?? "Tente novamente",
          variant: "destructive",
        });
      }
    } finally {
      setGerandoFaturas(false);
    }
  };

  const gerarFaltantePorMatricula = async () => {
    try {
      setSalvandoMatricula(true);

      const matricula = normalizeMatricula(matriculaInput);
      if (!matricula) {
        toast({
          title: "Informe a matrícula",
          description: "Digite a matrícula do membro.",
          variant: "destructive",
        });
        return;
      }
      const baseDate = selectedDate;
      if (!baseDate || isNaN(baseDate.getTime())) {
        toast({
          title: "Selecione a competência",
          description: "Escolha uma data válida.",
          variant: "destructive",
        });
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Usuário não autenticado");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", auth.user.id)
        .single();
      if (profErr) throw profErr;
      const orgId = profile!.org_id;

      // 1) membro por matrícula (somente deste org => mais rápido/preciso)
      let membro: any | null = null;
      {
        const { data, error } = await supabase
          .from("membros")
          .select("id, nome, matricula, org_id")
          .eq("org_id", orgId)
          .eq("matricula", matricula)
          .limit(1);
        if (error) throw error;
        if (data && data.length) membro = data[0];
      }
      if (!membro) {
        const { data, error } = await supabase
          .from("membros")
          .select("id, nome, matricula, org_id")
          .eq("org_id", orgId)
          .ilike("matricula", `%${matricula}%`)
          .limit(1);
        if (error) throw error;
        if (data && data.length) membro = data[0];
      }
      if (!membro) throw new Error("Matrícula não encontrada neste org.");

      // 2) assinatura ativa ou última
      let assinatura: any | null = null;
      {
        const { data, error } = await supabase
          .from("assinaturas")
          .select("id, plano_id, status, inicio, fim, dt_fim, created_at, org_id")
          .eq("org_id", orgId)
          .eq("membro_id", membro.id)
          .eq("status", "ativa")
          .is("fim", null)
          .is("dt_fim", null)
          .order("inicio", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        if (data && data.length) assinatura = data[0];
      }
      if (!assinatura) {
        const { data, error } = await supabase
          .from("assinaturas")
          .select("id, plano_id, status, inicio, created_at, org_id")
          .eq("org_id", orgId)
          .eq("membro_id", membro.id)
          .order("inicio", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        if (data && data.length) assinatura = data[0];
      }
      if (!assinatura) throw new Error("Nenhuma assinatura encontrada para este membro.");

      // 3) plano atual
      const { data: plano, error: pErr } = await supabase
        .from("planos")
        .select("id, valor_centavos, dia_vencimento")
        .eq("id", assinatura.plano_id)
        .single();
      if (pErr || !plano) throw new Error("Plano atual não encontrado.");

      // 4) referência e vencimento
      const ano = baseDate.getFullYear();
      const mes1a12 = baseDate.getMonth() + 1;
      const refer = `${ano}${String(mes1a12).padStart(2, "0")}`;
      const diaVenc = clampDiaDoMes(ano, mes1a12, Number(plano.dia_vencimento));
      const dtVenc = new Date(ano, mes1a12 - 1, diaVenc);
      const dtVencDate = `${dtVenc.getFullYear()}-${String(dtVenc.getMonth() + 1).padStart(2, "0")}-${String(
        dtVenc.getDate()
      ).padStart(2, "0")}`;
      const valorCent = Number(plano.valor_centavos);

      // 5) UPSERT (assinatura_id + data_vencimento)
      await upsertFaturaAssinVenc({
        assinatura_id: assinatura.id,
        membro_id: membro.id,
        plano_id: plano.id,
        valor_centavos: valorCent,
        vl_desconto_centavos: 0,
        refer,
        data_vencimento: dtVencDate,
        status: "pendente",
        org_id: orgId,
        terreiro_id: orgId,
        usuario_operacao: auth.user.email ?? auth.user.id,
      });

      toast({
        title: "Fatura garantida",
        description: `Fatura de ${membro.matricula} para ${String(mes1a12).padStart(2, "0")}/${ano} criada/atualizada com sucesso.`,
      });

      await baseLoad({ force: true });
    } catch (err: any) {
      console.error(err);
      if (isUniqueViolation(err)) {
        toast({
          title: "Nada para gerar",
          description: "A fatura desta competência já existe para esta matrícula.",
        });
        await baseLoad({ force: true });
      } else {
        toast({
          title: "Erro ao gerar faltante",
          description: err?.message ?? "Verifique os dados e tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setSalvandoMatricula(false);
    }
  };

  // Troca plano/valor só nas faturas abertas do membro
  const aplicarPlanoParaMembro = async (membro_id: string, plano: PlanoLite) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) throw new Error("Usuário não autenticado");

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("user_id", auth.user.id)
      .single();
    if (profErr) throw profErr;
    const orgId = profile!.org_id;

    const { data: abertas, error: qErr } = await supabase
      .from("faturas")
      .select("id")
      .eq("membro_id", membro_id)
      .eq("org_id", orgId)
      .in("status", ["pendente", "vencida"]);
    if (qErr) throw qErr;
    if (!abertas || abertas.length === 0) return;

    const ids = abertas.map((f: any) => f.id);

    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunkIds = ids.slice(i, i + chunkSize);
      const { error: upErr } = await supabase
        .from("faturas")
        .update({
          plano_id: plano.id,
          valor_centavos: plano.valor_centavos,
        })
        .in("id", chunkIds)
        .eq("org_id", orgId)
        .in("status", ["pendente", "vencida"]);
      if (upErr) throw upErr;
    }
  };

  const verificarEEstenderHorizonte = async () => {
    try {
      const mySeq = ++loadSeqRef.current;
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Usuário não autenticado");
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("user_id", auth.user.id)
        .single();
      if (profErr) throw profErr;
      const orgId = profile!.org_id;

      const { data: maxRes, error: maxErr } = await supabase
        .from("faturas")
        .select("dt_vencimento")
        .eq("org_id", orgId)
        .order("dt_vencimento", { ascending: false })
        .limit(1);
      if (maxErr) throw maxErr;

      const nowFirst = new Date();
      const nowIso = `${nowFirst.getFullYear()}-${String(nowFirst.getMonth() + 1).padStart(
        2,
        "0"
      )}-01`;

      const addMonths = (dateIso: string, n: number) => {
        const d = new Date(dateIso);
        d.setMonth(d.getMonth() + n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      };
      const monthsBetween = (aIso: string, bIso: string) => {
        const a = new Date(aIso);
        const b = new Date(bIso);
        return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
      };

      let until: string;

      if (!maxRes || maxRes.length === 0) {
        until = addMonths(nowIso, 24);
      } else {
        const maxVenc = new Date(maxRes[0].dt_vencimento);
        const maxIso = `${maxVenc.getFullYear()}-${String(maxVenc.getMonth() + 1).padStart(
          2,
          "0"
        )}-01`;
        const diff = monthsBetween(nowIso, maxIso);

        if (diff > 6) {
          toast({
            title: "Horizonte suficiente",
            description: `Sua última fatura está a ${diff} meses. Nenhuma ação necessária (limite é 6).`,
          });
          if (mySeq !== loadSeqRef.current) return;
          await baseLoad({ force: true });
          return;
        }
        until = addMonths(maxIso, 24);
      }

      const { data, error } = await supabase.rpc("generate_missing_faturas_for_org", {
        p_org_id: orgId,
        p_until: until,
      });
      if (error) throw error;

      const total = Array.isArray(data)
        ? data.reduce((acc: number, r: any) => acc + (r.created_count ?? 0), 0)
        : Number(data ?? 0);

      if (!total || total === 0) {
        toast({
          title: "Nada para estender",
          description: "O horizonte já está adequado. Nenhuma fatura nova foi criada.",
        });
      } else {
        toast({
          title: "Horizonte estendido",
          description: `Criadas ${total} fatura(s) para estender mais 24 meses.`,
        });
      }

      await baseLoad({ force: true });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao estender horizonte",
        description: err?.message ?? "Tente novamente",
        variant: "destructive",
      });
    }
  };

  /** --------- Filtros UI (cliente) --------- */
  const filteredFaturas = useMemo(() => {
    const term = (searchTerm ?? "").toLowerCase().trim();

    return (faturas ?? []).filter((f) => {
      const matchesSearch =
        term.length === 0 ||
        match(f.membro?.nome, term) ||
        match(f.membro?.matricula, term) ||
        match(f.refer, term);

      const matchesStatus =
        statusFilter === "all" || f.uiStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [faturas, searchTerm, statusFilter]);

  /** --------- Render --------- */
  return (
    <DashboardLayout>
      <FeatureGate feature="faturas" fallback={<UpgradeCard needed="Faturas" />}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <Receipt className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                Faturas
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {searchMode
                  ? "Busca global (ignora paginação)"
                  : "Abertas (paginado). Pesquise para buscar em todo o histórico."}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                onClick={() => baseLoad({ force: true })}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                title="Atualizar agora (sem piscar)"
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>

              <Button
                onClick={verificarEEstenderHorizonte}
                variant="outline"
                className="w-full sm:w-auto hover:opacity-90"
                title="Se a última fatura estiver a ≤ 6 meses, gera +24 meses"
              >
                <AlarmPlus className="h-4 w-4 mr-2" />
                Estender +24 Meses
              </Button>
            </div>
          </div>

          {/* Seção: Gerar Faturas (dois cards) */}
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {/* Card: Geral */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-secondary" />
                  Gerar faltantes (geral)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="ano" className="text-sm">Ano</Label>
                    <Input id="ano" type="number" min="2020" max="2100" inputMode="numeric" value={new Date().getFullYear()} readOnly />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mes" className="text-sm">Mês</Label>
                    <Input value={String(new Date().getMonth() + 1).padStart(2, "0")} readOnly />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={gerarFaturas}
                      disabled={gerandoFaturas}
                      className="w-full bg-gradient-sacred hover:opacity-90"
                      title="Gera faltantes para todos até a competência"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      {gerandoFaturas ? "Gerando..." : "Gerar faltantes"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card: Por matrícula */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <UserSearch className="h-5 w-5 text-secondary" />
                  Gerar faltante (matrícula)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="matricula" className="text-sm">Matrícula</Label>
                    <Input id="matricula" placeholder="Ex.: 2082" value={matriculaInput} onChange={(e) => setMatriculaInput(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm">Competência</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal")} title="Selecione um dia do mês desejado">
                          <Calendar className="mr-2 h-4 w-4" />
                          {selectedDate
                            ? selectedDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                            : "Escolha a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex items-end">
                    <Button
                      onClick={gerarFaltantePorMatricula}
                      disabled={salvandoMatricula}
                      className="w-full bg-gradient-sacred hover:opacity-90"
                      title="Lança uma fatura única para a matrícula, usando o plano atual"
                    >
                      <UserSearch className="h-4 w-4 mr-2" />
                      {salvandoMatricula ? "Lançando..." : "Gerar"}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  O vencimento ajusta para o <b>dia do plano</b> do membro.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Buscar por membro (nome/matrícula) ou referência (YYYYMM)…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="aberta">Abertas</SelectItem>
                      <SelectItem value="paga">Pagas</SelectItem>
                      <SelectItem value="atrasada">Atrasadas</SelectItem>
                      <SelectItem value="cancelada">Canceladas</SelectItem>
                      <SelectItem value="pausada">Pausadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista / Tabela de Faturas */}
          <Card className="bg-card/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">
                {filteredFaturas.length} fatura{filteredFaturas.length !== 1 ? "s" : ""}{" "}
                {searchMode ? "encontrada" : "aberta listada"}
                {filteredFaturas.length !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3 sm:space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                  ))}
                </div>
              ) : isMobile ? (
                // MOBILE: cards
                <div className="space-y-3">
                  {filteredFaturas.map((f) => (
                    <div key={f.id} className="rounded-xl border border-border/50 p-3 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold leading-tight">
                            {String(f.membro.nome ?? "").length ? f.membro.nome : "N/A"}
                          </div>
                          {f.membro.matricula && (
                            <div className="text-xs text-muted-foreground">{f.membro.matricula}</div>
                          )}
                        </div>
                        <div>
                          <Badge
                            variant={
                              f.uiStatus === "paga" ? "default" : f.uiStatus === "atrasada" ? "destructive" : "secondary"
                            }
                          >
                            {f.uiStatus.charAt(0).toUpperCase() + f.uiStatus.slice(1)}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Referência</div>
                          <div className="font-mono">{String(f.refer ?? "—")}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground text-xs">Vencimento</div>
                          <div>{new Date(f.dt_vencimento).toLocaleDateString("pt-BR")}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Valor</div>
                          <div className="font-semibold">{formatCurrency(f.valor_centavos)}</div>
                          {f.vl_desconto_centavos > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Desc: {formatCurrency(f.vl_desconto_centavos)}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-muted-foreground text-xs">Pagamento</div>
                          <div>
                            {f.dt_pagamento ? (
                              <div className="flex flex-col items-end">
                                <span className="font-medium">{formatCurrency(f.vl_pago_centavos || 0)}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(f.dt_pagamento).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPlanoTarget({ membro_id: f.membro_id });
                            setPlanoEscolhido("");
                            setPlanoDlgOpen(true);
                          }}
                          title="Trocar plano do membro e aplicar nas faturas abertas"
                        >
                          Trocar plano
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // DESKTOP: tabela
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Membro</TableHead>
                      <TableHead>Referência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFaturas.map((fatura) => (
                      <TableRow key={fatura.id} className="border-border/50">
                        <TableCell className="font-medium">
                          {String(fatura.membro.nome ?? "").length ? fatura.membro.nome : "N/A"}
                          {fatura.membro.matricula && (
                            <div className="text-xs text-muted-foreground">{fatura.membro.matricula}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{String(fatura.refer ?? "—")}</TableCell>
                        <TableCell>
                          {new Date(fatura.dt_vencimento).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-semibold text-secondary">
                          {formatCurrency(fatura.valor_centavos)}
                          {fatura.vl_desconto_centavos > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Desc: {formatCurrency(fatura.vl_desconto_centavos)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              fatura.uiStatus === "paga" ? "default" : fatura.uiStatus === "atrasada" ? "destructive" : "secondary"
                            }
                          >
                            {fatura.uiStatus.charAt(0).toUpperCase() + fatura.uiStatus.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {fatura.dt_pagamento ? (
                            <div>
                              <div className="font-medium">{formatCurrency(fatura.vl_pago_centavos || 0)}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(fatura.dt_pagamento).toLocaleDateString("pt-BR")}
                              </div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPlanoTarget({ membro_id: fatura.membro_id });
                              setPlanoEscolhido("");
                              setPlanoDlgOpen(true);
                            }}
                            title="Trocar plano do membro e aplicar nas faturas abertas"
                          >
                            Trocar plano
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!loading && filteredFaturas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhuma fatura encontrada</p>
                </div>
              )}

              {/* Botão Carregar mais (apenas quando NÃO está em modo pesquisa) */}
              {!loading && !searchMode && hasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    disabled={loadingMore}
                    onClick={async () => {
                      setLoadingMore(true);
                      try {
                        setPage((p) => p + 1);
                        const { data: auth } = await supabase.auth.getUser();
                        if (auth?.user) {
                          const { data: profile } = await supabase
                            .from("profiles")
                            .select("org_id")
                            .eq("user_id", auth.user.id)
                            .single();
                          if (profile?.org_id) {
                            await fetchOpenPaginated(profile.org_id);
                          }
                        }
                      } finally {
                        setLoadingMore(false);
                      }
                    }}
                  >
                    Carregar mais
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dialog — troca de plano */}
        <Dialog open={planoDlgOpen} onOpenChange={setPlanoDlgOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Trocar plano do membro</DialogTitle>
              <DialogDescription>
                Atualiza (ou cria) a assinatura ativa e aplica o novo valor/vencimento nas faturas abertas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Novo plano</Label>
                <Select value={planoEscolhido} onValueChange={setPlanoEscolhido}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {planos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} — {formatCurrency(p.valor_centavos)} (dia {p.dia_vencimento})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPlanoDlgOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!planoTarget || !planoEscolhido) return;
                    setSalvandoPlano(true);
                    try {
                      const plano = planos.find((x) => x.id === planoEscolhido);
                      if (!plano) throw new Error("Plano não encontrado");

                      await aplicarPlanoParaMembro(planoTarget.membro_id, plano);

                      toast({
                        title: "Plano aplicado",
                        description: "Assinatura e faturas abertas atualizadas.",
                      });
                      setPlanoDlgOpen(false);
                      await baseLoad({ force: true });
                    } catch (e: any) {
                      console.error(e);
                      toast({
                        title: "Erro ao aplicar plano",
                        description: e?.message ?? "Tente novamente",
                        variant: "destructive",
                      });
                    } finally {
                      setSalvandoPlano(false);
                    }
                  }}
                  disabled={!planoEscolhido || !planoTarget || salvandoPlano}
                  className="bg-gradient-sacred hover:opacity-90"
                >
                  {salvandoPlano ? "Aplicando…" : "Aplicar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </FeatureGate>
    </DashboardLayout>
  );
}
