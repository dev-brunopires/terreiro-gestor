// src/pages/Assinaturas.tsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, FileText, Search } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface Assinatura {
  id: string;
  inicio: string;
  fim?: string | null;
  status: 'ativa' | 'pausada' | 'cancelada';
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

type StatusAss = 'ativa' | 'pausada' | 'cancelada';

export default function Assinaturas() {
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssinatura, setEditingAssinatura] = useState<Assinatura | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StatusAss>('all');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    membro_id: '',
    plano_id: '',
    inicio: new Date().toISOString().split('T')[0],
    tem_fim: false,
    fim: '',
    status: 'ativa' as StatusAss,
    gerar_faturas_24m: true, // por padrão ligado
  });

  // guarda o plano original quando abre o dialog de edição
  const originalPlanoIdRef = useRef<string | null>(null);

  // ---------- helpers ----------
  const ymd = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

  const formatCurrency = (centavos: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

  const getStatusBadge = (status: StatusAss) => {
    const variants: Record<StatusAss, 'default' | 'secondary' | 'destructive'> = {
      ativa: 'default',
      pausada: 'secondary',
      cancelada: 'destructive',
    };
    return <Badge variant={variants[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  const clampDiaDoMes = (ano: number, mes1a12: number, dia: number) => {
    const last = new Date(ano, mes1a12, 0).getDate();
    return Math.min(dia, last);
  };

  const addMonths = (dateIso: string, months: number) => {
    const d = new Date(dateIso);
    const ano = d.getFullYear();
    const mes0a11 = d.getMonth();
    const dia = d.getDate();
    const target = new Date(ano, mes0a11 + months, 1);
    const ultimoDiaTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(dia, ultimoDiaTarget));
    return target.toISOString().slice(0, 10);
  };

  // ---------- data load ----------
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dialogOpen) {
      setEditingAssinatura(null);
      originalPlanoIdRef.current = null;
      setFormData((f) => ({
        membro_id: '',
        plano_id: '',
        inicio: new Date().toISOString().split('T')[0],
        tem_fim: false,
        fim: '',
        status: 'ativa',
        gerar_faturas_24m: true,
      }));
    }
  }, [dialogOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('Usuário não autenticado');

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', auth.user.id)
        .single();

      if (profErr) throw profErr;
      if (!profile?.org_id) throw new Error('org_id não encontrado no profile');

      const orgId = profile.org_id;

      const [membrosResult, planosResult] = await Promise.all([
        supabase
          .from('membros')
          .select('id, nome, matricula')
          .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`)
          .order('nome'),
        supabase
          .from('planos')
          .select('id, nome, valor_centavos, dia_vencimento')
          .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`)
          .order('nome'),
      ]);

      if (!membrosResult.error && membrosResult.data) setMembros(membrosResult.data);
      if (!planosResult.error && planosResult.data) setPlanos(planosResult.data);

      const assinaturasResult = await supabase
        .from('assinaturas')
        .select(`
          id,
          inicio,
          fim,
          dt_fim,
          status,
          created_at,
          membros:membro_id ( id, nome, matricula ),
          planos:plano_id ( id, nome, valor_centavos, dia_vencimento )
        `)
        .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`)
        .order('created_at', { ascending: false });

      if (!assinaturasResult.error && assinaturasResult.data) {
        setAssinaturas(
          assinaturasResult.data.map((a: any) => {
            const fimNorm = a.dt_fim ?? a.fim ?? null;
            return {
              id: a.id,
              inicio: ymd(a.inicio),
              fim: fimNorm ? ymd(fimNorm) : null,
              status: a.status,
              created_at: a.created_at,
              membro: {
                id: a.membros?.id || '',
                nome: a.membros?.nome || 'N/A',
                matricula: a.membros?.matricula ?? null,
              },
              plano: {
                id: a.planos?.id || '',
                nome: a.planos?.nome || 'N/A',
                valor_centavos: a.planos?.valor_centavos || 0,
                dia_vencimento: a.planos?.dia_vencimento ?? null,
              },
            } as Assinatura;
          })
        );
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro ao carregar dados',
        description: err?.message ?? 'Tente recarregar a página',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------- form actions ----------
  const openNewDialog = () => {
    setEditingAssinatura(null);
    originalPlanoIdRef.current = null;
    setFormData({
      membro_id: '',
      plano_id: '',
      inicio: new Date().toISOString().split('T')[0],
      tem_fim: false,
      fim: '',
      status: 'ativa',
      gerar_faturas_24m: true,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (assinatura: Assinatura) => {
    const inicio = ymd(assinatura.inicio);
    const fim = assinatura.fim ? ymd(assinatura.fim) : '';
    setFormData({
      membro_id: assinatura.membro.id,
      plano_id: assinatura.plano.id,
      inicio,
      tem_fim: Boolean(fim),
      fim,
      status: assinatura.status,
      gerar_faturas_24m: false, // em edição deixo desligado por padrão
    });
    originalPlanoIdRef.current = assinatura.plano.id;
    setEditingAssinatura(assinatura);
    setDialogOpen(true);
  };

  // tenta com terreiro_id = orgId; se FK falhar, tenta com auth.user.id
  const buildPayload = (orgId: string, terreiroId: string) => {
    const fimValue = formData.tem_fim && formData.fim ? formData.fim : null;
    return {
      membro_id: formData.membro_id,
      plano_id: formData.plano_id,
      inicio: formData.inicio,
      fim: fimValue,
      dt_fim: fimValue,
      status: formData.status,
      org_id: orgId,
      terreiro_id: terreiroId,
    };
  };

  /** Aplica novo plano às faturas em aberto dessa assinatura.
   *  1) tenta RPC apply_plano_to_open_faturas (p_assinatura_id ou p_plano_id);
   *  2) fallback: atualiza no cliente (valor + dia de vencimento) atualizando dt_vencimento e data_vencimento. */
  const applyPlanoToOpenFaturas = async (assinaturaId: string, newPlanoId: string, orgId: string) => {
    try {
      // tentar versão p_assinatura_id
      let rpcErr: any | null = null;
      const try1 = await supabase
        .rpc('apply_plano_to_open_faturas', { p_assinatura_id: assinaturaId })
        .catch((e) => ({ error: e }));
      if ((try1 as any)?.error) {
        rpcErr = (try1 as any).error;
        // tentar versão p_plano_id (compat)
        const try2 = await supabase
          .rpc('apply_plano_to_open_faturas', { p_plano_id: newPlanoId })
          .catch((e) => ({ error: e }));
        if ((try2 as any)?.error) rpcErr = (try2 as any).error;
        else rpcErr = null;
      }
      if (!rpcErr) {
        toast({ title: 'Mensalidades atualizadas', description: 'Faturas em aberto foram ajustadas via RPC.' });
        return;
      }
      // fallback
      console.warn('RPC apply_plano_to_open_faturas indisponível. Aplicando fallback no cliente.');

      // carregar dados do plano (valor + dia)
      const { data: p, error: pErr } = await supabase
        .from('planos')
        .select('valor_centavos, dia_vencimento')
        .eq('id', newPlanoId)
        .single();
      if (pErr || !p) throw new Error(pErr?.message ?? 'Plano não encontrado');

      // buscar faturas em aberto dessa assinatura
      const { data: fat, error: fErr } = await supabase
        .from('faturas')
        .select('id, dt_vencimento, data_vencimento')
        .eq('org_id', orgId)
        .eq('assinatura_id', assinaturaId)
        .in('status', ['pendente', 'vencida']);
      if (fErr) throw fErr;

      // atualizar em lote (ajusta ambas colunas)
      const updates = (fat ?? []).map(async (row: any) => {
        const base = new Date(row.dt_vencimento ?? row.data_vencimento);
        const novoDia = clampDiaDoMes(base.getFullYear(), base.getMonth() + 1, Number(p.dia_vencimento ?? 1));
        const novoVencIso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(
          novoDia
        ).padStart(2, '0')}`;
        const valorCent = Number(p.valor_centavos || 0);
        const valorDecimal = Number((valorCent / 100).toFixed(2));

        return supabase
          .from('faturas')
          .update({
            plano_id: formData.plano_id,
            valor_centavos: valorCent,
            valor: valorDecimal,
            dt_vencimento: novoVencIso,
            data_vencimento: novoVencIso,
          } as any)
          .eq('id', row.id);
      });

      await Promise.all(updates);

      toast({ title: 'Mensalidades atualizadas', description: 'Faturas em aberto ajustadas (fallback).' });
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Falha ao aplicar novo plano',
        description: e?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  /** Gera faturas mensais (24 meses) a partir do início, preenchendo dt_vencimento e data_vencimento. */
  const gerarFaturas24Meses = async (
    assinaturaId: string,
    membroId: string,
    planoId: string,
    orgId: string,
    terreiroId: string,
    inicioIso: string
  ) => {
    try {
      // pega infos do plano
      const { data: plano, error: pErr } = await supabase
        .from('planos')
        .select('valor_centavos, dia_vencimento')
        .eq('id', planoId)
        .single();
      if (pErr || !plano) throw new Error(pErr?.message ?? 'Plano não encontrado para gerar faturas');

      const dia = Number(plano.dia_vencimento ?? 1);
      // base: mês do início
      const base = new Date(inicioIso);
      const baseY = base.getFullYear();
      const baseM = base.getMonth() + 1;

      // lista todas as datas alvo (24 meses)
      const datas: string[] = [];
      for (let i = 0; i < 24; i++) {
        const y = baseY + Math.floor((baseM - 1 + i) / 12);
        const m = ((baseM - 1 + i) % 12) + 1;
        const d = clampDiaDoMes(y, m, dia);
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        datas.push(iso);
      }

      // evita duplicar: consulta quais já existem (considera as duas colunas)
      const { data: existentes, error: exErr } = await supabase
        .from('faturas')
        .select('id, dt_vencimento, data_vencimento')
        .eq('assinatura_id', assinaturaId)
        .in('status', ['pendente', 'vencida', 'paga', 'cancelada']); // qualquer status conta como existente
      if (exErr) throw exErr;

      const setExistentes = new Set((existentes ?? []).map((f) => ymd(f.dt_vencimento ?? f.data_vencimento)));
      const valorCent = Number(plano.valor_centavos || 0);
      const valorDecimal = Number((valorCent / 100).toFixed(2));

      const novas = datas
        .filter((iso) => !setExistentes.has(iso))
        .map((iso) => ({
          assinatura_id: assinaturaId,
          membro_id: membroId,
          plano_id: planoId,
          org_id: orgId,
          terreiro_id: terreiroId,
          valor_centavos: valorCent,
          valor: valorDecimal,
          dt_vencimento: iso,
          data_vencimento: iso, // <- evita NOT NULL
          status: 'pendente' as const,
        }));

      if (!novas.length) return;

      const { error: insErr } = await supabase.from('faturas').insert(novas);
      if (insErr) throw insErr;
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Falha ao gerar faturas',
        description: e?.message ?? 'Não foi possível gerar as faturas (24 meses).',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('Usuário não autenticado');

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('user_id', auth.user.id)
        .single();

      if (profErr) throw profErr;
      if (!profile?.org_id) throw new Error('org_id/terreiro não encontrado no profile');

      const orgId = profile.org_id;
      const userId = auth.user.id;

      // 1ª tentativa com terreiro_id = orgId
      let payload = buildPayload(orgId, orgId);

      if (editingAssinatura) {
        let { error } = await supabase.from('assinaturas').update(payload).eq('id', editingAssinatura.id);
        if (error && `${error.message}`.toLowerCase().includes('foreign key') && `${error.message}`.includes('terreiro_id')) {
          payload = buildPayload(orgId, userId);
          ({ error } = await supabase.from('assinaturas').update(payload).eq('id', editingAssinatura.id));
        }
        if (error) throw error;

        // se o plano mudou, aplicar nas faturas em aberto desta assinatura
        const originalPlanoId = originalPlanoIdRef.current;
        if (originalPlanoId && originalPlanoId !== formData.plano_id) {
          await applyPlanoToOpenFaturas(editingAssinatura.id, formData.plano_id, orgId);
        }

        // opcional: ao editar, se marcar para gerar 24m, gera a partir do novo início
        if (formData.gerar_faturas_24m) {
          await gerarFaturas24Meses(
            editingAssinatura.id,
            formData.membro_id,
            formData.plano_id,
            orgId,
            payload.terreiro_id,
            formData.inicio
          );
        }

        toast({ title: 'Assinatura atualizada', description: 'A assinatura foi atualizada com sucesso' });
      } else {
        let { data, error } = await supabase.from('assinaturas').insert(payload).select('id').single();
        if (error && `${error.message}`.toLowerCase().includes('foreign key') && `${error.message}`.includes('terreiro_id')) {
          payload = buildPayload(orgId, userId);
          ({ data, error } = await supabase.from('assinaturas').insert(payload).select('id').single());
        }
        if (error) throw error;

        // gera faturas (24 meses) se marcado
        if (data?.id && formData.gerar_faturas_24m) {
          await gerarFaturas24Meses(data.id, formData.membro_id, formData.plano_id, orgId, payload.terreiro_id, formData.inicio);
        }

        toast({ title: 'Assinatura criada', description: 'A assinatura foi criada com sucesso' });
      }

      setDialogOpen(false);
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Erro ao salvar assinatura',
        description: error?.message ?? 'Verifique os dados e tente novamente',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (assinatura: Assinatura) => {
    try {
      const { error } = await supabase.from('assinaturas').delete().eq('id', assinatura.id);
      if (error) throw error;

      toast({ title: 'Assinatura excluída', description: 'A assinatura foi excluída do sistema' });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir assinatura',
        description: error?.message ?? 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  // ---------- filters ----------
  const filteredAssinaturas = assinaturas.filter((a) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      a.membro.nome.toLowerCase().includes(s) ||
      (a.membro.matricula && a.membro.matricula.toLowerCase().includes(s)) ||
      a.plano.nome.toLowerCase().includes(s);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ---------- render ----------
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Assinaturas
            </h1>
            <p className="text-muted-foreground">Gerencie as assinaturas de planos</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-sacred hover:opacity-90" onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Assinatura
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingAssinatura ? 'Editar Assinatura' : 'Nova Assinatura'}</DialogTitle>
                <DialogDescription>
                  {editingAssinatura ? 'Atualize os dados da assinatura' : 'Vincule um membro a um plano'}
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
                      onCheckedChange={(checked) =>
                        setFormData((f) => ({ ...f, tem_fim: checked, fim: checked ? f.fim : '' }))
                      }
                    />
                  </div>
                  {formData.tem_fim && (
                    <>
                      <Label htmlFor="fim" className="sr-only">
                        Data de fim
                      </Label>
                      <Input
                        id="fim"
                        type="date"
                        value={formData.fim}
                        onChange={(e) => setFormData({ ...formData, fim: e.target.value })}
                      />
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
                    <Switch
                      id="gerar_faturas_24m"
                      checked={formData.gerar_faturas_24m}
                      onCheckedChange={(checked) => setFormData((f) => ({ ...f, gerar_faturas_24m: checked }))}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gera/Completa faturas mensais a partir da <strong>data de início</strong> usando o dia de vencimento do plano.
                  </p>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-sacred hover:opacity-90">
                    {editingAssinatura ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por membro ou plano..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Select value={statusFilter} onValueChange={(v: 'all' | StatusAss) => setStatusFilter(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="ativa">Ativas</SelectItem>
                    <SelectItem value="pausada">Pausadas</SelectItem>
                    <SelectItem value="cancelada">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions Table */}
        <Card className="bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>
              {filteredAssinaturas.length} assinatura{filteredAssinaturas.length !== 1 ? 's' : ''} encontrada
              {filteredAssinaturas.length !== 1 ? 's' : ''}
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
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Membro</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssinaturas.map((assinatura) => (
                    <TableRow key={assinatura.id} className="border-border/50">
                      <TableCell className="font-medium">
                        {assinatura.membro.nome}
                        {assinatura.membro.matricula && (
                          <div className="text-xs text-muted-foreground">{assinatura.membro.matricula}</div>
                        )}
                      </TableCell>
                      <TableCell>{assinatura.plano.nome}</TableCell>
                      <TableCell className="font-semibold text-secondary">
                        {formatCurrency(assinatura.plano.valor_centavos)}
                      </TableCell>
                      <TableCell>{new Date(assinatura.inicio).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{assinatura.fim ? new Date(assinatura.fim).toLocaleDateString('pt-BR') : '—'}</TableCell>
                      <TableCell>{getStatusBadge(assinatura.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(assinatura)}
                            className="hover:bg-accent hover:text-accent-foreground"
                            title="Editar"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
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
                                  Tem certeza que deseja excluir esta assinatura? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(assinatura)}
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
            )}

            {!loading && filteredAssinaturas.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhuma assinatura encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
