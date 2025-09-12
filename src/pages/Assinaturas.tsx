// src/pages/Assinaturas.tsx
"use client";

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
import { Plus, Edit, Trash2, FileText, Search, ArrowUpDown, Wand2 } from "lucide-react"; // ⬅️ Sparkles → Wand2
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
}

interface Plano {
  id: string;
  nome: string;
  valor_centavos: number;
  dia_vencimento?: number | null;
}

type StatusAss = "ativa" | "pausada" | "cancelada";
type SortKey = "nome" | "matricula" | "plano" | "valor" | "inicio";

export default function Assinaturas() {
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssinatura, setEditingAssinatura] = useState<Assinatura | null>(null);

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

  const [formData, setFormData] = useState({
    membro_id: "",
    plano_id: "",
    inicio: new Date().toISOString().split("T")[0],
    tem_fim: false,
    fim: "",
    status: "ativa" as StatusAss,
    gerar_faturas_24m: true,
  });

  const originalPlanoIdRef = useRef<string | null>(null);

  const ymd = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const formatCurrency = (c: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c / 100);
  const getStatusBadge = (status: StatusAss) => {
    const variants: Record<StatusAss, "default" | "secondary" | "destructive"> = {
      ativa: "default",
      pausada: "secondary",
      cancelada: "destructive",
    };
    return <Badge variant={variants[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };
  const clampDiaDoMes = (ano: number, mes1a12: number, dia: number) => Math.min(new Date(ano, mes1a12, 0).getDate(), dia);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dialogOpen) {
      setEditingAssinatura(null);
      originalPlanoIdRef.current = null;
      setFormData((f) => ({
        membro_id: "",
        plano_id: "",
        inicio: new Date().toISOString().split("T")[0],
        tem_fim: false,
        fim: "",
        status: "ativa",
        gerar_faturas_24m: true,
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

      const [membrosResult, planosResult] = await Promise.all([
        supabase.from("membros").select("id, nome, matricula").or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`).order("nome"),
        supabase.from("planos").select("id, nome, valor_centavos, dia_vencimento").or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`).order("nome"),
      ]);

      if (!membrosResult.error && membrosResult.data) setMembros(membrosResult.data);
      if (!planosResult.error && planosResult.data) setPlanos(planosResult.data);

      const assinaturasResult = await supabase
        .from("assinaturas")
        .select(`
          id,
          inicio,
          fim,
          status,
          created_at,
          membros:membro_id ( id, nome, matricula ),
          planos:plano_id ( id, nome, valor_centavos, dia_vencimento )
        `)
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
            membro: { id: a.membros?.id || "", nome: a.membros?.nome || "N/A", matricula: a.membros?.matricula ?? null },
            plano: { id: a.planos?.id || "", nome: a.planos?.nome || "N/A", valor_centavos: a.planos?.valor_centavos || 0, dia_vencimento: a.planos?.dia_vencimento ?? null },
          }))
        );
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao carregar dados", description: err?.message ?? "Tente recarregar a página", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openNewDialog = () => {
    setEditingAssinatura(null);
    originalPlanoIdRef.current = null;
    setFormData({
      membro_id: "",
      plano_id: "",
      inicio: new Date().toISOString().split("T")[0],
      tem_fim: false,
      fim: "",
      status: "ativa",
      gerar_faturas_24m: true,
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
    });
    originalPlanoIdRef.current = assinatura.plano.id;
    setEditingAssinatura(assinatura);
    setDialogOpen(true);
  };

  const buildPayload = (orgId: string) => {
    const fimValue = formData.tem_fim && formData.fim ? formData.fim : null;
    return { membro_id: formData.membro_id, plano_id: formData.plano_id, inicio: formData.inicio, fim: fimValue, status: formData.status, org_id: orgId, terreiro_id: orgId };
  };

  const applyPlanoToOpenFaturas = async (assinaturaId: string, newPlanoId: string, orgId: string) => {
    try {
      let rpcErr: any | null = null;
      const try1 = await supabase.rpc("apply_plano_to_open_faturas", { p_assinatura_id: assinaturaId }).catch((e) => ({ error: e }));
      if ((try1 as any)?.error) {
        rpcErr = (try1 as any).error;
        const try2 = await supabase.rpc("apply_plano_to_open_faturas", { p_plano_id: newPlanoId }).catch((e) => ({ error: e }));
        if ((try2 as any)?.error) rpcErr = (try2 as any).error;
        else rpcErr = null;
      }
      if (!rpcErr) {
        toast({ title: "Mensalidades atualizadas", description: "Faturas em aberto foram ajustadas via RPC." });
        return;
      }

      const { data: p, error: pErr } = await supabase.from("planos").select("valor_centavos, dia_vencimento").eq("id", newPlanoId).single();
      if (pErr || !p) throw new Error(pErr?.message ?? "Plano não encontrado");

      const { data: fat, error: fErr } = await supabase
        .from("faturas")
        .select("id, dt_vencimento, data_vencimento")
        .eq("org_id", orgId)
        .eq("assinatura_id", assinaturaId)
        .in("status", ["pendente", "vencida"]);
      if (fErr) throw fErr;

      const updates = (fat ?? []).map(async (row: any) => {
        const base = new Date(row.dt_vencimento ?? row.data_vencimento);
        const novoDia = clampDiaDoMes(base.getFullYear(), base.getMonth() + 1, Number(p.dia_vencimento ?? 1));
        const novoVencIso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(novoDia).padStart(2, "0")}`;
        const valorCent = Number(p.valor_centavos || 0);

        return supabase.from("faturas").update({ plano_id: newPlanoId, valor_centavos: valorCent, dt_vencimento: novoVencIso, data_vencimento: novoVencIso } as any).eq("id", row.id);
      });

      await Promise.all(updates);
      toast({ title: "Mensalidades atualizadas", description: "Faturas em aberto ajustadas (fallback)." });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Falha ao aplicar novo plano", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

  const gerarFaturas24Meses = async (assinaturaId: string, membroId: string, planoId: string, orgId: string, inicioIso: string) => {
    try {
      const { data: plano, error: pErr } = await supabase.from("planos").select("valor_centavos, dia_vencimento").eq("id", planoId).single();
      if (pErr || !plano) throw new Error(pErr?.message ?? "Plano não encontrado para gerar faturas");

      const dia = Number(plano.dia_vencimento ?? 1);
      const base = new Date(inicioIso);
      const baseY = base.getFullYear();
      const baseM = base.getMonth() + 1;

      const datas: string[] = [];
      for (let i = 0; i < 24; i++) {
        const y = baseY + Math.floor((baseM - 1 + i) / 12);
        const m = ((baseM - 1 + i) % 12) + 1;
        const d = clampDiaDoMes(y, m, dia);
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        datas.push(iso);
      }

      const { data: existentes, error: exErr } = await supabase
        .from("faturas")
        .select("id, dt_vencimento, data_vencimento")
        .eq("assinatura_id", assinaturaId)
        .in("status", ["pendente", "vencida", "paga", "cancelada"]);
      if (exErr) throw exErr;

      const setExistentes = new Set((existentes ?? []).map((f) => ymd(f.dt_vencimento ?? f.data_vencimento)));
      const valorCent = Number(plano.valor_centavos || 0);

      const novas = datas
        .filter((iso) => !setExistentes.has(iso))
        .map((iso) => ({
          assinatura_id: assinaturaId,
          membro_id: membroId,
          plano_id: planoId,
          org_id: orgId,
          terreiro_id: orgId,
          valor_centavos: valorCent,
          dt_vencimento: iso,
          data_vencimento: iso,
          status: "pendente" as const,
        }));

      if (!novas.length) return;

      const { error: insErr } = await supabase.from("faturas").insert(novas);
      if (insErr) throw insErr;
    } catch (e: any) {
      console.error(e);
      toast({ title: "Falha ao gerar faturas", description: e?.message ?? "Não foi possível gerar as faturas (24 meses).", variant: "destructive" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Usuário não autenticado");

      const { data: profile, error: profErr } = await supabase.from("profiles").select("org_id").eq("user_id", auth.user.id).single();

      if (profErr) throw profErr;
      if (!profile?.org_id) throw new Error("org_id não encontrado no profile");

      const orgId = profile.org_id;
      const payload = buildPayload(orgId);

      if (editingAssinatura) {
        const { error } = await supabase.from("assinaturas").update(payload).eq("id", editingAssinatura.id);
        if (error) throw error;

        const originalPlanoId = originalPlanoIdRef.current;
        if (originalPlanoId && originalPlanoId !== formData.plano_id) {
          await applyPlanoToOpenFaturas(editingAssinatura.id, formData.plano_id, orgId);
        }
        if (formData.gerar_faturas_24m) {
          await gerarFaturas24Meses(editingAssinatura.id, formData.membro_id, formData.plano_id, orgId, formData.inicio);
        }
        toast({ title: "Assinatura atualizada", description: "A assinatura foi atualizada com sucesso" });
      } else {
        const { data, error } = await supabase.from("assinaturas").insert(payload).select("id").single();
        if (error) throw error;

        if (data?.id && formData.gerar_faturas_24m) {
          await gerarFaturas24Meses(data.id, formData.membro_id, formData.plano_id, orgId, formData.inicio);
        }
        toast({ title: "Assinatura criada", description: "A assinatura foi criada com sucesso" });
      }

      setDialogOpen(false);
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast({ title: "Erro ao salvar assinatura", description: error?.message ?? "Verifique os dados e tente novamente", variant: "destructive" });
    }
  };

  const handleDelete = async (assinatura: Assinatura) => {
    try {
      const { error } = await supabase.from("assinaturas").delete().eq("id", assinatura.id);
      if (error) throw error;
      toast({ title: "Assinatura excluída", description: "A assinatura foi excluída do sistema" });
      await loadData();
    } catch (error: any) {
      toast({ title: "Erro ao excluir assinatura", description: error?.message ?? "Tente novamente", variant: "destructive" });
    }
  };

  // filtros e ordenação
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

  const sortBy = (key: SortKey) => (sortKey === key ? setSortDir((d) => (d === "asc" ? "desc" : "asc")) : (setSortKey(key), setSortDir("asc")));

  const sortedAssinaturas = useMemo(() => {
    const arr = [...filteredAssinaturas];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      switch (sortKey) {
        case "nome":
          return a.membro.nome.localeCompare(b.membro.nome, "pt-BR") * dir;
        case "matricula": {
          const na = Number(a.membro.matricula ?? NaN);
          const nb = Number(b.membro.matricula ?? NaN);
          if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
          return (a.membro.matricula ?? "").localeCompare(b.membro.matricula ?? "", "pt-BR") * dir;
        }
        case "plano":
          return a.plano.nome.localeCompare(b.plano.nome, "pt-BR") * dir;
        case "valor":
          return (a.plano.valor_centavos - b.plano.valor_centavos) * dir;
        case "inicio": {
          const ta = new Date(a.inicio || "1970-01-01").getTime();
          const tb = new Date(b.inicio || "1970-01-01").getTime();
          return (ta - tb) * dir;
        }
        default:
          return 0;
      }
    });

    return arr;
  }, [filteredAssinaturas, sortKey, sortDir]);

  const HeaderSortBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
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

  const openBulkDialog = async () => {
    if (!orgIdState) {
      toast({ title: "Sem organização", description: "Não foi possível encontrar o org atual.", variant: "destructive" });
      return;
    }
    setBulkLoading(true);
    setBulkSelectedPlanoId("");
    setBulkMissingMembers([]);
    setBulkGerarFaturas(true);

    try {
      const { data: membrosData, error: mErr } = await supabase
        .from("membros")
        .select("id, nome, matricula")
        .or(`org_id.eq.${orgIdState},terreiro_id.eq.${orgIdState}`);
      if (mErr) throw mErr;

      const { data: assinAtivas, error: aErr } = await supabase
        .from("assinaturas")
        .select("membro_id, status")
        .or(`org_id.eq.${orgIdState},terreiro_id.eq.${orgIdState}`)
        .eq("status", "ativa");
      if (aErr) throw aErr;

      const withActive = new Set((assinAtivas ?? []).map((r: any) => r.membro_id));
      const missing = (membrosData ?? []).filter((m) => !withActive.has(m.id));

      setBulkMissingMembers(missing);
      setBulkDialogOpen(true);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao verificar faltantes", description: e?.message ?? "Não foi possível calcular os membros sem plano.", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!orgIdState) {
      toast({ title: "Sem organização", description: "Org não encontrado.", variant: "destructive" });
      return;
    }
    if (!bulkSelectedPlanoId) {
      toast({ title: "Selecione um plano", description: "Escolha o plano para gerar as assinaturas." });
      return;
    }
    if (!bulkMissingMembers.length) {
      toast({ title: "Nada a gerar", description: "Todos já possuem assinatura ativa." });
      setBulkDialogOpen(false);
      return;
    }

    setBulkLoading(true);
    const hoje = new Date().toISOString().slice(0, 10);

    try {
      const payloads = bulkMissingMembers.map((m) => ({
        membro_id: m.id,
        plano_id: bulkSelectedPlanoId,
        inicio: hoje,
        fim: null,
        status: "ativa",
        org_id: orgIdState!,
        terreiro_id: orgIdState!,
      }));

      const { data: inserted, error: insErr } = await supabase.from("assinaturas").insert(payloads).select("id, membro_id");
      if (insErr) throw insErr;

      if (bulkGerarFaturas) {
        await Promise.all((inserted ?? []).map((row) => gerarFaturas24Meses(row.id, row.membro_id, bulkSelectedPlanoId, orgIdState!, hoje)));
      }

      toast({ title: "Assinaturas geradas", description: `${inserted?.length ?? 0} assinatura(s) criada(s) para membros sem plano.` });
      setBulkDialogOpen(false);
      await loadData();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Falha ao gerar assinaturas", description: e?.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <FeatureGate code="assinaturas" fallback={<UpgradeCard needed="Assinaturas" />}>
        {/* conteúdo por trás da navbar fixa */}
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
                      Cria uma assinatura <strong>ativa</strong> para cada membro que ainda não possui assinatura ativa.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
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
                          <div className="font-medium">Membros sem assinatura ativa: {bulkMissingMembers.length}</div>
                          {bulkMissingMembers.length > 0 && (
                            <ul className="mt-2 max-h-40 overflow-auto space-y-1">
                              {bulkMissingMembers.slice(0, 20).map((m) => (
                                <li key={m.id} className="text-muted-foreground">
                                  {m.nome} {m.matricula ? `(${m.matricula})` : ""}
                                </li>
                              ))}
                              {bulkMissingMembers.length > 20 && (
                                <li className="text-muted-foreground">… e mais {bulkMissingMembers.length - 20}</li>
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

              {/* Nova Assinatura */}
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
                      {editingAssinatura ? "Atualize os dados da assinatura" : "Vincule um membro a um plano"}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="membro_id">Membro *</Label>
                      <Select value={formData.membro_id} onValueChange={(value) => setFormData({ ...formData, membro_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um membro" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {membros.map((membro) => (
                            <SelectItem key={membro.id} value={membro.id}>
                              {membro.nome} {membro.matricula && `(${membro.matricula})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Input id="inicio" type="date" value={formData.inicio} onChange={(e) => setFormData({ ...formData, inicio: e.target.value })} required />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="tem_fim">Tem data fim?</Label>
                        <Switch id="tem_fim" checked={formData.tem_fim} onCheckedChange={(checked) => setFormData((f) => ({ ...f, tem_fim: checked, fim: checked ? f.fim : "" }))} />
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="ativa">Ativa</SelectItem>
                          <SelectItem value="pausada">Pausada</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="gerar_faturas_24m">Gerar faturas (24 meses)</Label>
                        <Switch id="gerar_faturas_24m" checked={formData.gerar_faturas_24m} onCheckedChange={(checked) => setFormData((f) => ({ ...f, gerar_faturas_24m: checked }))} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Gera/Completa faturas mensais a partir da <strong>data de início</strong> usando o dia de vencimento do plano.
                      </p>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                      <Button type="submit" className="bg-gradient-sacred hover:opacity-90">{editingAssinatura ? "Atualizar" : "Criar"}</Button>
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
                    <Input placeholder="Buscar por membro, matrícula ou plano..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
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
                  {/* TS-safe: cast para SortKey */}
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

                <Button variant="outline" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="w-full sm:w-auto" title={`Direção: ${sortDir === "asc" ? "Crescente" : "Decrescente"}`}>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {sortDir === "asc" ? "Crescente" : "Decrescente"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card className="bg-card/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>
                {sortedAssinaturas.length} assinatura{sortedAssinaturas.length !== 1 ? "s" : ""} encontrada
                {sortedAssinaturas.length !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead><HeaderSortBtn label="Membro" active={sortKey === "nome"} onClick={() => sortBy("nome")} /></TableHead>
                      <TableHead><HeaderSortBtn label="Plano" active={sortKey === "plano"} onClick={() => sortBy("plano")} /></TableHead>
                      <TableHead className="whitespace-nowrap"><HeaderSortBtn label="Valor" active={sortKey === "valor"} onClick={() => sortBy("valor")} /></TableHead>
                      <TableHead className="whitespace-nowrap"><HeaderSortBtn label="Início" active={sortKey === "inicio"} onClick={() => sortBy("inicio")} /></TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[120px]"><HeaderSortBtn label="Matrícula" active={sortKey === "matricula"} onClick={() => sortBy("matricula")} /></TableHead>
                      <TableHead className="w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAssinaturas.map((assinatura) => (
                      <TableRow key={assinatura.id} className="border-border/50">
                        <TableCell className="font-medium">
                          {assinatura.membro.nome}
                          {assinatura.membro.matricula && <div className="text-xs text-muted-foreground">{assinatura.membro.matricula}</div>}
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
              )}

              {!loading && sortedAssinaturas.length === 0 && (
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
