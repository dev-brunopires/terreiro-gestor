import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Receipt, Search, Calendar, AlarmPlus, Zap, UserSearch } from 'lucide-react';

interface Fatura {
  id: string;
  refer: string;                // 'YYYYMM'
  dt_vencimento: string;        // ISO
  valor_centavos: number;
  vl_desconto_centavos: number;
  status: string;               // DB
  uiStatus: 'aberta' | 'paga' | 'atrasada' | 'cancelada';
  dt_pagamento?: string;
  vl_pago_centavos?: number;
  forma_pagamento?: string;
  membro: { nome: string; matricula?: string };
  created_at: string;
  // NOVO: guardamos o membro_id para ações
  membro_id: string;
}

type PlanoLite = {
  id: string;
  nome: string;
  valor_centavos: number;
  dia_vencimento: number;
};

export default function Faturas() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<'all' | 'aberta' | 'paga' | 'atrasada' | 'cancelada'>('all');

  const [estendendoHorizonte, setEstendendoHorizonte] = useState(false);
  const [gerandoFaturas, setGerandoFaturas] = useState(false);

  // Competência (geral)
  const [gerarFaturasData, setGerarFaturasData] = useState({
    ano: new Date().getFullYear().toString(),
    mes: String(new Date().getMonth() + 1).padStart(2, '0'),
  });

  // Por matrícula
  const [matriculaInput, setMatriculaInput] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [salvandoMatricula, setSalvandoMatricula] = useState(false);

  // NOVO — troca de plano
  const [planos, setPlanos] = useState<PlanoLite[]>([]);
  const [planoDlgOpen, setPlanoDlgOpen] = useState(false);
  const [planoTarget, setPlanoTarget] = useState<{ membro_id: string } | null>(null);
  const [planoEscolhido, setPlanoEscolhido] = useState<string>('');
  const [salvandoPlano, setSalvandoPlano] = useState(false);

  const { toast } = useToast();

  // ---------- helpers ----------
  const formatCurrency = (centavos: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

  const dbStatusToUi = (db: string): Fatura['uiStatus'] => {
    switch (db) {
      case 'pendente': return 'aberta';
      case 'vencida':  return 'atrasada';
      case 'paga':     return 'paga';
      case 'cancelada':return 'cancelada';
      default:         return 'aberta';
    }
  };

  const getStatusBadge = (uiStatus: Fatura['uiStatus']) => {
    const variants: Record<Fatura['uiStatus'], 'default' | 'secondary' | 'destructive'> = {
      aberta: 'secondary',
      paga: 'default',
      atrasada: 'destructive',
      cancelada: 'secondary',
    };
    return <Badge variant={variants[uiStatus]}>{uiStatus.charAt(0).toUpperCase() + uiStatus.slice(1)}</Badge>;
  };

  const clampDiaDoMes = (ano: number, mes1a12: number, dia: number) => {
    const last = new Date(ano, mes1a12, 0).getDate();
    return Math.min(dia, last);
  };

  const normalizeMatricula = (raw: string) =>
    (raw || '').toString().trim().toUpperCase().replace(/[^\dA-Z]/g, '');

  const makeDateFromReferAndDay = (refer: string, dia: number) => {
    const ano = Number(refer.slice(0, 4));
    const mes = Number(refer.slice(4, 6)); // 1..12
    const d = clampDiaDoMes(ano, mes, dia);
    const js = new Date(ano, mes - 1, d);
    const iso =
      `${js.getFullYear()}-${String(js.getMonth() + 1).padStart(2, '0')}-${String(js.getDate()).padStart(2, '0')}`;
    return iso;
  };

  const monthRefNow = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}${m}`;
  };

  const loadPlanos = async (orgId: string) => {
    const { data, error } = await supabase
      .from('planos')
      .select('id,nome,valor_centavos,dia_vencimento,org_id,terreiro_id')
      .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`)
      .order('nome', { ascending: true });
    if (error) throw error;
    setPlanos((data ?? []) as unknown as PlanoLite[]);
  };

  // ---------- load ----------
  const loadFaturas = async () => {
    try {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('Usuário não autenticado');

      const { data: profile, error: profErr } = await supabase
        .from('profiles').select('org_id').eq('user_id', auth.user.id).single();
      if (profErr) throw profErr;

      const orgId = profile!.org_id;

      // mês atual (YYYYMM)
      const ref = monthRefNow();

      const { data, error } = await supabase
        .from('faturas')
        .select(`
          id, refer, dt_vencimento, valor_centavos, vl_desconto_centavos,
          status, dt_pagamento, vl_pago_centavos, forma_pagamento, created_at,
          org_id, membro_id,
          membros:membro_id ( nome, matricula )
        `)
        .eq('org_id', orgId)
        .eq('refer', ref)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;

      setFaturas(
        (data ?? []).map((f: any) => ({
          id: f.id,
          refer: f.refer,
          dt_vencimento: f.dt_vencimento,
          valor_centavos: f.valor_centavos,
          vl_desconto_centavos: f.vl_desconto_centavos || 0,
          status: f.status,
          uiStatus: dbStatusToUi(f.status),
          dt_pagamento: f.dt_pagamento,
          vl_pago_centavos: f.vl_pago_centavos,
          forma_pagamento: f.forma_pagamento,
          created_at: f.created_at,
          membro: { nome: f.membros?.nome ?? 'N/A', matricula: f.membros?.matricula },
          membro_id: f.membro_id,
        }))
      );

      // deixa o seletor de planos pronto
      await loadPlanos(orgId);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro ao carregar faturas', description: err?.message ?? 'Tente recarregar a página', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFaturas(); }, []);

  // ---------- geral: gerar faltantes até competência ----------
  const gerarFaturas = async () => {
    try {
      setGerandoFaturas(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('Usuário não autenticado');

      const { data: profile, error: profErr } = await supabase
        .from('profiles').select('org_id').eq('user_id', auth.user.id).single();
      if (profErr) throw profErr;

      const orgId = profile!.org_id;
      const until = `${gerarFaturasData.ano}-${gerarFaturasData.mes}-01`;

      const { data, error } = await supabase.rpc('generate_missing_faturas_for_org', {
        p_org_id: orgId,
        p_until: until,
      });
      if (error) throw error;

      const total = Array.isArray(data) ? data.reduce((acc: number, r: any) => acc + (r.created_count ?? 0), 0) : Number(data ?? 0);

      toast({
        title: 'Faturas geradas (geral)',
        description: `Criadas ${total} fatura(s) faltante(s) até ${gerarFaturasData.mes}/${gerarFaturasData.ano}.`,
      });

      await loadFaturas();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro ao gerar faturas', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
    } finally {
      setGerandoFaturas(false);
    }
  };

  // ---------- por matrícula: gerar 1 fatura usando plano atual ----------
  const gerarFaltantePorMatricula = async () => {
    try {
      const matricula = normalizeMatricula(matriculaInput);
      if (!matricula) {
        toast({ title: 'Informe a matrícula', description: 'Digite a matrícula do membro.', variant: 'destructive' });
        return;
      }
      const baseDate = selectedDate;
      if (!baseDate || isNaN(baseDate.getTime())) {
        toast({ title: 'Selecione a competência', description: 'Escolha uma data válida.', variant: 'destructive' });
        return;
      }

      setSalvandoMatricula(true);

      // auth / org
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('Usuário não autenticado');

      const { data: profile, error: profErr } = await supabase
        .from('profiles').select('org_id').eq('user_id', auth.user.id).single();
      if (profErr) throw profErr;
      const orgId = profile!.org_id;

      // 1) membro por matrícula — prioridade orgId, fallback org null/ilike
      let membro: any | null = null;
      {
        const { data, error } = await supabase
          .from('membros')
          .select('id, nome, matricula, org_id')
          .eq('org_id', orgId)
          .eq('matricula', matricula)
          .limit(1);
        if (error) throw error;
        if (data && data.length) membro = data[0];
      }
      if (!membro) {
        const { data, error } = await supabase
          .from('membros')
          .select('id, nome, matricula, org_id')
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .ilike('matricula', `%${matricula}%`)
          .order('org_id', { ascending: false })
          .limit(5);
        if (error) throw error;
        if (data && data.length) {
          membro = data.find((d: any) => d.org_id === orgId) ?? data[0];
        }
      }
      if (!membro) throw new Error('Matrícula não encontrada neste org.');

      // 2) assinatura: ativa OU fallback para última assinatura do membro
      let assinatura: any | null = null;
      {
        const { data, error } = await supabase
          .from('assinaturas')
          .select('id, plano_id, ativo, status, inicio, fim, dt_fim, created_at, org_id')
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .eq('membro_id', membro.id)
          .or('ativo.eq.true,status.eq.ativa')
          .is('fim', null)
          .is('dt_fim', null)
          .order('inicio', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        if (data && data.length) assinatura = data[0];
      }
      if (!assinatura) {
        const { data, error } = await supabase
          .from('assinaturas')
          .select('id, plano_id, ativo, status, inicio, created_at, org_id')
          .or(`org_id.eq.${orgId},org_id.is.null`)
          .eq('membro_id', membro.id)
          .order('inicio', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        if (data && data.length) assinatura = data[0];
      }
      if (!assinatura) throw new Error('Nenhuma assinatura encontrada para este membro.');

      // 3) plano atual da assinatura
      const { data: plano, error: pErr } = await supabase
        .from('planos')
        .select('id, valor_centavos, dia_vencimento')
        .eq('id', assinatura.plano_id)
        .single();
      if (pErr || !plano) throw new Error('Plano atual não encontrado.');

      // 4) referência e vencimento
      const ano = baseDate.getFullYear();
      const mes1a12 = baseDate.getMonth() + 1;
      const refer = `${ano}${String(mes1a12).padStart(2, '0')}`;
      const diaVenc = clampDiaDoMes(ano, mes1a12, Number(plano.dia_vencimento));
      const dtVenc = new Date(ano, mes1a12 - 1, diaVenc);

      // valores normalizados
      const dtVencDate = `${dtVenc.getFullYear()}-${String(dtVenc.getMonth()+1).padStart(2,'0')}-${String(dtVenc.getDate()).padStart(2,'0')}`;
      const valorCent = Number(plano.valor_centavos);
      const valorDecimal = Number((valorCent / 100).toFixed(2));

      // 5) checar duplicidade
      const { data: jaExiste, error: exErr } = await supabase
        .from('faturas')
        .select('id')
        .eq('membro_id', membro.id)
        .eq('refer', refer)
        .limit(1);
      if (exErr) throw exErr;
      if (jaExiste && jaExiste.length > 0) {
        toast({
          title: 'Fatura já existe',
          description: `Já há fatura para ${refer} (${membro.matricula}).`,
          variant: 'destructive',
        });
        setSalvandoMatricula(false);
        return;
      }

      // 6) inserir fatura (preenche data_vencimento e dt_vencimento)
      const { error: insErr } = await supabase
        .from('faturas')
        .insert([{
          assinatura_id: assinatura.id,
          membro_id: membro.id,
          plano_id: plano.id,
          valor: valorDecimal,                 // numeric NOT NULL
          valor_centavos: valorCent,
          vl_desconto_centavos: 0,
          refer,
          data_vencimento: dtVencDate,         // <- NOT NULL (DATE)
          dt_vencimento: dtVencDate,           // manter espelhado
          status: 'pendente',
          org_id: orgId,
          terreiro_id: auth.user.id,           // faturas.terreiro_id -> auth.users(id)
          usuario_operacao: auth.user.email ?? auth.user.id,
        } as any]);

      if (insErr) throw insErr;

      toast({
        title: 'Fatura criada',
        description: `Fatura de ${membro.matricula} para ${String(mes1a12).padStart(2, '0')}/${ano} criada com sucesso.`,
      });

      await loadFaturas();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro ao gerar faltante',
        description: err?.message ?? 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSalvandoMatricula(false);
    }
  };

  // ---------- aplicar novo plano: assinatura + faturas abertas ----------
  const aplicarPlanoParaMembro = async (membro_id: string, plano: PlanoLite) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) throw new Error('Usuário não autenticado');

    const { data: profile, error: profErr } = await supabase
      .from('profiles').select('org_id').eq('user_id', auth.user.id).single();
    if (profErr) throw profErr;
    const orgId = profile!.org_id;

    // 1) assinatura ativa (atualiza) ou cria uma nova
    const { data: assinAtual } = await supabase
      .from('assinaturas')
      .select('id, plano_id, ativo, status, inicio, fim, dt_fim')
      .eq('membro_id', membro_id)
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .or('ativo.eq.true,status.eq.ativa')
      .is('fim', null)
      .is('dt_fim', null)
      .maybeSingle();

    if (assinAtual?.id) {
      const { error: upErr } = await supabase
        .from('assinaturas')
        .update({ plano_id: plano.id, updated_at: new Date().toISOString() })
        .eq('id', assinAtual.id);
      if (upErr) throw upErr;
    } else {
      const { error: insAssErr } = await supabase
        .from('assinaturas')
        .insert({
          membro_id,
          plano_id: plano.id,
          inicio: new Date().toISOString().slice(0, 10),
          status: 'ativa',
          ativo: true,
          org_id: orgId,
          terreiro_id: auth.user.id, // conforme seu schema
        } as any);
      if (insAssErr) throw insAssErr;
    }

    // 2) tenta RPC (se existir)
    try {
      await supabase.rpc('apply_plano_to_open_faturas', { p_plano_id: plano.id, p_membro_id: membro_id });
      return;
    } catch {
      // segue para fallback
    }

    // 3) FALLBACK no cliente: atualiza TODAS as faturas abertas do membro
    const { data: abertas, error: qErr } = await supabase
      .from('faturas')
      .select('id, refer')
      .eq('membro_id', membro_id)
      .or(`org_id.eq.${orgId},org_id.is.null`) // <-- aceita org_id NULL também
      .in('status', ['pendente', 'vencida']);

    if (qErr) throw qErr;

    // monta updates calculando vencimento pelo dia do plano para cada referência
    const updates = (abertas ?? []).map((f: any) => {
      const venc = makeDateFromReferAndDay(f.refer, plano.dia_vencimento);
      return {
        id: f.id,
        valor_centavos: plano.valor_centavos,
        valor: Number((plano.valor_centavos / 100).toFixed(2)), // mantém numeric em sincronia
        dt_vencimento: venc,
        data_vencimento: venc, // espelhado (DATE)
      };
    });

    // upsert em lotes (evita payload grande)
    const chunkSize = 100;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      const { error: upErr } = await supabase.from('faturas').upsert(chunk, { onConflict: 'id' });
      if (upErr) throw upErr;
    }
  };

  // ---------- horizonte (+24m se faltar ≤6m) ----------
  const verificarEEstenderHorizonte = async () => {
    try {
      setEstendendoHorizonte(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('Usuário não autenticado');
      const { data: profile, error: profErr } = await supabase
        .from('profiles').select('org_id').eq('user_id', auth.user.id).single();
      if (profErr) throw profErr;
      const orgId = profile!.org_id;

      const { data: maxRes, error: maxErr } = await supabase
        .from('faturas')
        .select('dt_vencimento')
        .eq('org_id', orgId)
        .order('dt_vencimento', { ascending: false })
        .limit(1);
      if (maxErr) throw maxErr;

      const nowFirst = new Date();
      const nowIso = `${nowFirst.getFullYear()}-${String(nowFirst.getMonth() + 1).padStart(2, '0')}-01`;

      const addMonths = (dateIso: string, n: number) => {
        const d = new Date(dateIso);
        d.setMonth(d.getMonth() + n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      };
      const monthsBetween = (aIso: string, bIso: string) => {
        const a = new Date(aIso); const b = new Date(bIso);
        return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
      };

      let until: string;

      if (!maxRes || maxRes.length === 0) {
        until = addMonths(nowIso, 24);
      } else {
        const maxVenc = new Date(maxRes[0].dt_vencimento);
        const maxIso = `${maxVenc.getFullYear()}-${String(maxVenc.getMonth() + 1).padStart(2, '0')}-01`;
        const diff = monthsBetween(nowIso, maxIso);

        if (diff > 6) {
          toast({
            title: 'Horizonte suficiente',
            description: `Sua última fatura está a ${diff} meses. Nenhuma ação necessária (limite é 6).`,
          });
          setEstendendoHorizonte(false);
          return;
        }
        until = addMonths(maxIso, 24);
      }

      const { data, error } = await supabase.rpc('generate_missing_faturas_for_org', {
        p_org_id: orgId,
        p_until: until,
      });
      if (error) throw error;

      const total = Array.isArray(data) ? data.reduce((acc: number, r: any) => acc + (r.created_count ?? 0), 0) : Number(data ?? 0);

      toast({
        title: 'Horizonte estendido',
        description: `Criadas ${total} fatura(s) para estender mais 24 meses.`,
      });

      await loadFaturas();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro ao estender horizonte', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
    } finally {
      setEstendendoHorizonte(false);
    }
  };

  // ---------- filtros ----------
  const filteredFaturas = faturas.filter((fatura) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      fatura.membro.nome.toLowerCase().includes(term) ||
      (fatura.membro.matricula && fatura.membro.matricula.toLowerCase().includes(term)) ||
      fatura.refer.includes(term);
    const matchesStatus = statusFilter === 'all' || fatura.uiStatus === statusFilter;
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
              <Receipt className="h-8 w-8 text-primary" />
              Faturas
            </h1>
            <p className="text-muted-foreground">Somente as 25 últimas do mês de referência atual</p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={verificarEEstenderHorizonte}
              disabled={estendendoHorizonte}
              variant="outline"
              className="hover:opacity-90"
              title="Se a última fatura estiver a ≤ 6 meses, gera +24 meses"
            >
              <AlarmPlus className="h-4 w-4 mr-2" />
              {estendendoHorizonte ? 'Verificando...' : 'Estender +24m se precisar'}
            </Button>
          </div>
        </div>

        {/* Seção: Gerar Faturas (dois cards com o mesmo layout) */}
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Card: Geral */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-secondary" />
                Gerar faltantes (geral)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="ano" className="text-sm">Ano</Label>
                  <Input
                    id="ano"
                    type="number"
                    min="2020"
                    max="2100"
                    value={gerarFaturasData.ano}
                    onChange={(e) => setGerarFaturasData({ ...gerarFaturasData, ano: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mes" className="text-sm">Mês</Label>
                  <Select value={gerarFaturasData.mes} onValueChange={(value) => setGerarFaturasData({ ...gerarFaturasData, mes: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Mês" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {new Date(2000, i).toLocaleDateString('pt-BR', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={gerarFaturas}
                    disabled={gerandoFaturas}
                    className="w-full bg-gradient-sacred hover:opacity-90"
                    title="Gera faltantes para todos até a competência"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {gerandoFaturas ? 'Gerando...' : 'Gerar faltantes'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Por matrícula (mesmo layout) */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <UserSearch className="h-5 w-5 text-secondary" />
                Gerar faltante (matrícula)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="matricula" className="text-sm">Matrícula</Label>
                  <Input
                    id="matricula"
                    placeholder="Ex.: 2082"
                    value={matriculaInput}
                    onChange={(e) => setMatriculaInput(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-sm">Competência</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn('w-full justify-start text-left font-normal')}
                        title="Selecione um dia do mês desejado"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {selectedDate
                          ? selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'Escolha a data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-end md:col-span-1">
                  <Button
                    onClick={gerarFaltantePorMatricula}
                    disabled={salvandoMatricula}
                    className="w-full bg-gradient-sacred hover:opacity-90"
                    title="Lança uma fatura única para a matrícula, usando o plano atual"
                  >
                    <UserSearch className="h-4 w-4 mr-2" />
                    {salvandoMatricula ? 'Lançando...' : 'Gerar'}
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
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar por membro, matrícula ou referência..."
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Faturas (com ação de trocar plano) */}
        <Card className="bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>
              {filteredFaturas.length} fatura{filteredFaturas.length !== 1 ? 's' : ''} encontrada{filteredFaturas.length !== 1 ? 's' : ''} (mês atual)
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
                        {fatura.membro.nome}
                        {fatura.membro.matricula && (
                          <div className="text-xs text-muted-foreground">{fatura.membro.matricula}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono">{fatura.refer}</TableCell>
                      <TableCell>{new Date(fatura.dt_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="font-semibold text-secondary">
                        {formatCurrency(fatura.valor_centavos)}
                        {fatura.vl_desconto_centavos > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Desc: {formatCurrency(fatura.vl_desconto_centavos)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(fatura.uiStatus)}</TableCell>
                      <TableCell>
                        {fatura.dt_pagamento ? (
                          <div>
                            <div className="font-medium">{formatCurrency(fatura.vl_pago_centavos || 0)}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(fatura.dt_pagamento).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="text-xs text-muted-foreground">{fatura.forma_pagamento}</div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPlanoTarget({ membro_id: fatura.membro_id });
                            setPlanoEscolhido('');
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
                <SelectContent>
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
                    if (!plano) throw new Error('Plano não encontrado');

                    await aplicarPlanoParaMembro(planoTarget.membro_id, plano);

                    toast({ title: 'Plano aplicado', description: 'Assinatura e faturas abertas atualizadas.' });
                    setPlanoDlgOpen(false);
                    await loadFaturas();
                  } catch (e: any) {
                    console.error(e);
                    toast({ title: 'Erro ao aplicar plano', description: e?.message ?? 'Tente novamente', variant: 'destructive' });
                  } finally {
                    setSalvandoPlano(false);
                  }
                }}
                disabled={!planoEscolhido || !planoTarget || salvandoPlano}
                className="bg-gradient-sacred hover:opacity-90"
              >
                {salvandoPlano ? 'Aplicando…' : 'Aplicar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}