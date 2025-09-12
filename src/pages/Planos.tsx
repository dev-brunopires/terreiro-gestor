// src/pages/Planos.tsx
"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/contexts/OrgContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import FeatureGate from "@/components/FeatureGate";
import UpgradeCard from "@/components/UpgradeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, CreditCard, Link2 } from "lucide-react";

/* shadcn/ui Select (usado no vínculo) */
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/* ---------- Tipos ---------- */
interface Plano {
  id: string;
  terreiro_id: string;
  nome: string;
  valor_centavos: number;
  dia_vencimento: number;
  created_at: string;
}

interface Membro {
  id: string;
  terreiro_id: string | null;
  nome: string;
  ativo: boolean;
}

/* ---------- Helpers ---------- */
const formatCurrency = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (centavos ?? 0) / 100
  );

const parseReaisToCentavos = (v: string) => {
  const s = (v ?? "").toString().trim();
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/* ---------- Fetchers ---------- */
async function fetchPlanos(orgId: string, searchTerm: string) {
  let q = supabase
    .from("planos")
    .select("*")
    .eq("terreiro_id", orgId)
    .order("nome", { ascending: true });

  if (searchTerm.trim()) {
    q = q.ilike("nome", `%${searchTerm.trim()}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Plano[];
}

/* ---------- Componente ---------- */
export default function Planos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { orgId, orgName } = useOrg(); // nome/ID do terreiro persistentes

  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [submitting, setSubmitting] = useState(false); // trava multi-submit
  const [applyingToFaturas, setApplyingToFaturas] = useState(false); // feedback do RPC

  // Para vínculo (assinatura)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [selectedPlanoToLink, setSelectedPlanoToLink] = useState<Plano | null>(null);
  const [linkForm, setLinkForm] = useState({
    membro_id: "",
    desconto_reais: "0.00",
    observacao: "",
  });

  // Form de plano
  const [formData, setFormData] = useState({
    nome: "",
    valor_centavos_view: "",
    dia_vencimento: "",
  });

  /** Query principal: planos do terreiro */
  const planosQ = useQuery({
    queryKey: ["planos", orgId, searchTerm],
    enabled: !!orgId,
    queryFn: () => fetchPlanos(orgId!, searchTerm),
    keepPreviousData: true,
    staleTime: 5 * 60_000,          // 5 minutos
    refetchOnWindowFocus: false,    // não refaz ao focar
    refetchOnMount: false,          // mantém cache ao trocar de tab
  });


  const filteredPlanos = useMemo(() => planosQ.data ?? [], [planosQ.data]);

  /* ---------- Mutations ---------- */
  const upsertPlanoMt = useMutation({
    mutationFn: async (payload: {
      id?: string;
      nome: string;
      valor_centavos: number;
      dia_vencimento: number;
      terreiro_id: string;
      applyInOpenFaturas?: boolean;
    }) => {
      if (!payload.terreiro_id) throw new Error("Terreiro inválido");

      if (payload.id) {
        // update
        const { error } = await supabase
          .from("planos")
          .update({
            nome: payload.nome,
            valor_centavos: payload.valor_centavos,
            dia_vencimento: payload.dia_vencimento,
            terreiro_id: payload.terreiro_id,
          })
          .eq("id", payload.id);
        if (error) throw error;

        // RPC opcional
        if (payload.applyInOpenFaturas) {
          setApplyingToFaturas(true);
          try {
            const { data: count, error: rpcErr } = await supabase.rpc(
              "apply_plano_to_open_faturas",
              { p_plano_id: payload.id }
            );
            if (rpcErr) {
              console.warn("apply_plano_to_open_faturas falhou:", rpcErr.message);
              toast({
                title: "Plano atualizado (sem aplicar em faturas)",
                description:
                  "O ajuste automático nas faturas em aberto não foi aplicado.",
              });
            } else {
              const quant = typeof count === "number" ? count : undefined;
              toast({
                title: "Plano atualizado",
                description:
                  quant != null
                    ? `Faturas abertas ajustadas: ${quant}.`
                    : "Faturas abertas ajustadas.",
              });
            }
          } finally {
            setApplyingToFaturas(false);
          }
        }
      } else {
        // insert
        const { error } = await supabase.from("planos").insert({
          nome: payload.nome,
          valor_centavos: payload.valor_centavos,
          dia_vencimento: payload.dia_vencimento,
          terreiro_id: payload.terreiro_id,
        });
        if (error) throw error;
        toast({
          title: "Plano cadastrado",
          description: `${payload.nome} foi criado`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos", orgId] });
    },
    onError: (e: any) => {
      toast({
        title: "Erro ao salvar plano",
        description: e?.message ?? "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    },
    onSettled: () => setSubmitting(false),
  });

  const deletePlanoMt = useMutation({
    mutationFn: async (plano: Plano) => {
      const { error } = await supabase.from("planos").delete().eq("id", plano.id);
      if (error) throw error;
    },
    onSuccess: (_res, plano) => {
      toast({ title: "Plano excluído", description: `${plano.nome} foi excluído` });
      queryClient.invalidateQueries({ queryKey: ["planos", orgId] });
    },
    onError: (e: any) => {
      toast({
        title: "Erro ao excluir plano",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    },
  });

  /* ---------- Ações ---------- */
  const resetForm = () => {
    setFormData({
      nome: "",
      valor_centavos_view: "",
      dia_vencimento: "",
    });
    setEditingPlano(null);
    setSubmitting(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (plano: Plano) => {
    setFormData({
      nome: plano.nome,
      valor_centavos_view: (plano.valor_centavos / 100).toString(),
      dia_vencimento: String(plano.dia_vencimento),
    });
    setEditingPlano(plano);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (!orgId) throw new Error("Terreiro do perfil inválido.");
      const valor = parseReaisToCentavos(formData.valor_centavos_view);
      if (valor <= 0) throw new Error("Informe um valor maior que zero");

      const dia = parseInt(formData.dia_vencimento);
      if (Number.isNaN(dia) || dia < 1 || dia > 28)
        throw new Error("Informe um dia entre 1 e 28");

      if (!formData.nome.trim()) throw new Error("Informe o nome do plano");

      await upsertPlanoMt.mutateAsync({
        id: editingPlano?.id,
        nome: formData.nome.trim(),
        valor_centavos: valor,
        dia_vencimento: dia,
        terreiro_id: orgId,
        applyInOpenFaturas: !!editingPlano, // só aplica em update
      });

      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      setSubmitting(false);
      toast({
        title: "Erro ao salvar plano",
        description: e?.message ?? "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (plano: Plano) => {
    await deletePlanoMt.mutateAsync(plano);
  };

  /* -------- Vincular plano a membro (assinatura) -------- */
  const openLinkDialog = async (plano: Plano) => {
    try {
      setSelectedPlanoToLink(plano);
      // carrega membros ativos do mesmo terreiro
      const { data, error } = await supabase
        .from("membros")
        .select("id, nome, ativo, terreiro_id")
        .eq("terreiro_id", plano.terreiro_id)
        .order("nome", { ascending: true });
      if (error) throw error;
      setMembros((data || []).filter((m) => m.ativo));
      setLinkForm({ membro_id: "", desconto_reais: "0.00", observacao: "" });
      setLinkDialogOpen(true);
    } catch (e: any) {
      toast({
        title: "Erro ao abrir vínculo",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanoToLink) return;

    try {
      const desconto = parseReaisToCentavos(linkForm.desconto_reais);
      const payload = {
        terreiro_id: selectedPlanoToLink.terreiro_id,
        membro_id: linkForm.membro_id,
        plano_id: selectedPlanoToLink.id,
        desconto_centavos: desconto,
        observacao: linkForm.observacao?.trim() || null,
      };

      if (!payload.membro_id) {
        toast({
          title: "Selecione um membro",
          description: "Escolha o membro para vincular",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("assinaturas").insert(payload);
      if (error) throw error;

      toast({
        title: "Plano vinculado",
        description: `Assinatura criada para o membro selecionado`,
      });
      setLinkDialogOpen(false);
      setSelectedPlanoToLink(null);
    } catch (e: any) {
      toast({
        title: "Erro ao vincular",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const loading = planosQ.isLoading || planosQ.isFetching;

  return (
    <DashboardLayout>
      <FeatureGate code="planos" fallback={<UpgradeCard needed="Planos" />}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                <CreditCard className="h-7 w-7 md:h-8 md:w-8 text-primary" />
                Planos
              </h1>
              <p className="text-muted-foreground">
                Gerencie os planos de mensalidade do terreiro
                {orgName ? ` • ${orgName}` : ""}
              </p>
            </div>

            <Dialog
              open={dialogOpen}
              onOpenChange={(o) => {
                setDialogOpen(o);
                if (!o) setSubmitting(false);
              }}
            >
              <Button
                type="button"
                onClick={openCreateDialog}
                className="bg-gradient-sacred hover:opacity-90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>

              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingPlano ? "Editar Plano" : "Novo Plano"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingPlano
                      ? "Atualize os dados do plano"
                      : "Cadastre um novo plano de mensalidade"}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Terreiro apenas informativo */}
                  <div className="space-y-2">
                    <Label>Terreiro</Label>
                    <Input value={orgName || orgId || ""} disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome do plano *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) =>
                        setFormData({ ...formData, nome: e.target.value })
                      }
                      placeholder="Ex: Mensalidade Básica"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$) *</Label>
                    <Input
                      id="valor"
                      inputMode="decimal"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.valor_centavos_view}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          valor_centavos_view: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="venc">Dia do vencimento *</Label>
                    <Input
                      id="venc"
                      type="number"
                      min={1}
                      max={28}
                      value={formData.dia_vencimento}
                      onChange={(e) =>
                        setFormData({ ...formData, dia_vencimento: e.target.value })
                      }
                      placeholder="Ex: 10"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Para evitar meses sem dia (29–31), limitamos a 1–28.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gradient-sacred hover:opacity-90"
                      disabled={submitting || applyingToFaturas || !orgId}
                    >
                      {editingPlano
                        ? applyingToFaturas
                          ? "Aplicando nas faturas…"
                          : "Atualizar"
                        : submitting
                        ? "Cadastrando..."
                        : "Cadastrar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filtro */}
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Input
                      placeholder="Buscar por nome do plano..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60">
                      🔎
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista responsiva */}
          <Card className="bg-card/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>
                {filteredPlanos.length} plano
                {filteredPlanos.length !== 1 ? "s" : ""} cadastrado
                {filteredPlanos.length !== 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Skeleton */}
              {loading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                  ))}
                </div>
              )}

              {/* Mobile: cards */}
              {!loading && filteredPlanos.length > 0 && (
                <div className="space-y-3 md:hidden">
                  {filteredPlanos.map((plano) => (
                    <div
                      key={plano.id}
                      className="rounded-lg border p-4 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{plano.nome}</div>
                          <div className="text-xs text-muted-foreground">
                            Criado em {new Date(plano.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-secondary">
                            {formatCurrency(plano.valor_centavos)}
                          </div>
                          <Badge variant="secondary" className="mt-1">
                            Dia {plano.dia_vencimento}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(plano)}
                          className="hover:bg-accent hover:text-accent-foreground"
                          title="Editar"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>

                        {/* Vincular a membro */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openLinkDialog(plano)}
                          className="hover:bg-accent hover:text-accent-foreground"
                          title="Vincular a membro"
                        >
                          <Link2 className="h-3 w-3" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-destructive hover:text-destructive-foreground"
                              title="Excluir"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o plano "{plano.nome}"? Esta
                                ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(plano)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Desktop: tabela */}
              {!loading && (
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead>Nome</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="w-[200px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPlanos.map((plano) => (
                        <TableRow key={plano.id} className="border-border/50">
                          <TableCell className="font-medium">{plano.nome}</TableCell>
                          <TableCell className="font-semibold text-secondary">
                            {formatCurrency(plano.valor_centavos)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">Dia {plano.dia_vencimento}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(plano.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditDialog(plano)}
                                className="hover:bg-accent hover:text-accent-foreground"
                                title="Editar"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>

                              {/* Vincular a membro */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openLinkDialog(plano)}
                                className="hover:bg-accent hover:text-accent-foreground"
                                title="Vincular a membro"
                              >
                                <Link2 className="h-3 w-3" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="hover:bg-destructive hover:text-destructive-foreground"
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir o plano "{plano.nome}"?
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(plano)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {!loading && filteredPlanos.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>Nenhum plano cadastrado</p>
                    </div>
                  )}
                </div>
              )}

              {!loading && filteredPlanos.length === 0 && (
                <div className="md:hidden text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhum plano cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dialog: Vincular plano a membro */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Vincular plano ao membro</DialogTitle>
              <DialogDescription>
                Cria uma assinatura de mensalidade para o membro selecionado.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateLink} className="space-y-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Input disabled value={selectedPlanoToLink?.nome || ""} />
              </div>

              <div className="space-y-2">
                <Label>Membro *</Label>
                <Select
                  value={linkForm.membro_id}
                  onValueChange={(v) =>
                    setLinkForm((f) => ({ ...f, membro_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        membros.length ? "Selecione um membro" : "Nenhum membro ativo"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {membros.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Desconto (R$)</Label>
                <Input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={linkForm.desconto_reais}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, desconto_reais: e.target.value }))
                  }
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Opcional. Aplicado em centavos na criação da assinatura.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Observação</Label>
                <Input
                  value={linkForm.observacao}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, observacao: e.target.value }))
                  }
                  placeholder="Observações sobre a assinatura..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLinkDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="bg-gradient-sacred hover:opacity-90">
                  Vincular
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </FeatureGate>
    </DashboardLayout>
  );
}
