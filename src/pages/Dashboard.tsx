// src/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Receipt, DollarSign, TrendingUp, CalendarClock, AlertTriangle, Info } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrg } from '@/contexts/OrgContext';

type Role = 'owner' | 'admin' | 'viewer' | 'financeiro' | 'operador';

type UltimoPagamento = {
  id: string;
  tipo: 'mensalidade' | 'diverso';
  data: string;
  valor_centavos: number;
  metodo?: string | null;
  descricao?: string | null;
  refer?: string | null;
  membro_nome?: string | null;
  matricula?: string | null;
  status?: 'pago' | 'reembolsado' | 'cancelado';
};

interface DashboardStats {
  membrosAtivos: number;
  faturasAbertasMes: number;     // faturas do mês (refer YYYYMM) com status pendente/vencida
  receitaMesMensalidades: number;
  receitaMesDiversos: number;
  receitaHojeMensalidades: number;
  receitaHojeDiversos: number;
  atrasadas: number;             // qtd de faturas vencidas
}

type ProfileExtra = {
  role: Role;
  membro_id: string | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const monthBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0); // exclusivo
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};
const currentRef = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}${m}`; // 'YYYYMM'
};
const toInt = (v: any) => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const formatCurrency = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (centavos ?? 0) / 100
  );

/** ===== Helpers de STATUS ===== */
const statusFromRow = (row: any, tipo: 'mensalidade' | 'diverso'): UltimoPagamento['status'] => {
  if (row?.estornado === true) return 'reembolsado';
  // Se for mensalidade e a fatura estiver cancelada, exibir "cancelado"
  if (tipo === 'mensalidade' && (row?.faturas?.cancelada_em || row?.faturas?.status === 'cancelada')) {
    return 'cancelado';
  }
  return 'pago';
};

const badgeVariantByStatus = (s?: UltimoPagamento['status']) =>
  s === 'reembolsado' ? 'destructive'
  : s === 'cancelado' ? 'secondary'
  : 'default';

export default function Dashboard() {
  const { toast } = useToast();
  const { orgId, loading: orgLoading } = useOrg();

  // Carrega role/membro_id direto do banco (para não depender de shape do useOrg)
  const profileQ = useQuery<ProfileExtra>({
    queryKey: ['profile-extra'],
    enabled: !orgLoading,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return { role: 'viewer', membro_id: null } as ProfileExtra;

      const { data, error } = await supabase
        .from('profiles')
        .select('role, membro_id')
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (error) throw error;
      return {
        role: (data?.role ?? 'operador') as Role,
        membro_id: (data as any)?.membro_id ?? null,
      };
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const isViewer = (profileQ.data?.role ?? 'operador') === 'viewer';
  const membroIdViewer = isViewer ? (profileQ.data?.membro_id ?? null) : null;

  // Query principal do dashboard
  const dashQ = useQuery<{
    stats: DashboardStats;
    ultimos: UltimoPagamento[];
    viewerHint: string | null;
    viewerMatricula: string | null;
  }>({
    queryKey: ['dashboard', orgId, orgLoading, !!profileQ.data, profileQ.data?.role, profileQ.data?.membro_id],
    enabled: !!orgId && !orgLoading && (!!(profileQ.data?.membro_id) || ((profileQ.data?.role ?? 'operador') !== 'viewer')),
    queryFn: async () => {
      if (!orgId) throw new Error('Terreiro inválido');

      const isViewer = (profileQ.data?.role ?? 'operador') === 'viewer';
      const membroIdViewer = isViewer ? (profileQ.data?.membro_id ?? null) : null;

      const { startISO, endISO } = monthBounds();
      const refMes = currentRef();
      const hoje = todayISO();

      let viewerMatricula: string | null = null;
      let viewerHint: string | null = null;

      if (isViewer) {
        if (!membroIdViewer) {
          viewerHint =
            'Seu usuário é do tipo "viewer", mas ainda não está vinculado a um membro. Peça ao administrador para vincular seu acesso a um membro (Configurações → Usuários).';
        } else {
          const { data: memb } = await supabase
            .from('membros')
            .select('matricula')
            .eq('id', membroIdViewer)
            .maybeSingle();
          viewerMatricula = (memb as any)?.matricula ?? null;
        }
      }

      // == Membros ativos (escopo por org_id OU terreiro_id)
      const membrosQ = supabase
        .from('membros')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true)
        .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`);

      // == Faturas abertas do mês (pendente/vencida e NÃO canceladas)
      let faturasAbertasMesQ = supabase
        .from('faturas')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('refer', refMes)
        .in('status', ['pendente', 'vencida'])
        .is('cancelada_em', null);

      // == Faturas atrasadas (NÃO canceladas)
      let atrasadasQ = supabase
        .from('faturas')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'vencida')
        .is('cancelada_em', null);

      // == Últimas mensalidades (pagamentos de fatura) – sem estorno e do seu org
      let ultMensalidadesQ = supabase
        .from('pagamentos')
        .select(`
          id,
          pago_em,
          valor_centavos,
          metodo,
          estornado,
          faturas!inner(
            id,
            refer,
            org_id,
            membro_id,
            status,
            cancelada_em,
            membros:membro_id(nome, matricula)
          )
        `)
        .eq('faturas.org_id', orgId)
        .or('estornado.is.false,estornado.is.null')
        .order('pago_em', { ascending: false })
        .limit(15);

      // == Últimos diversos – sem estorno e do seu org
      let ultDiversosQ = supabase
        .from('pagamentos_diversos')
        .select('id, data, valor_centavos, metodo, tipo, descricao, matricula, membro_id, estornado')
        .eq('terreiro_id', orgId)
        .or('estornado.is.false,estornado.is.null')
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(15);

      // == Receita do mês (mensalidades) – range + estorno + org
      const receitaMesMensalidadesQ = supabase
        .from('pagamentos')
        .select(`
          valor_centavos,
          estornado,
          faturas!inner(org_id)
        `)
        .gte('pago_em', startISO)
        .lt('pago_em', endISO)
        .eq('faturas.org_id', orgId)
        .or('estornado.is.false,estornado.is.null');

      // == Receita do mês (diversos) – range + estorno + org
      const receitaMesDiversosQ = supabase
        .from('pagamentos_diversos')
        .select('valor_centavos, estornado')
        .eq('terreiro_id', orgId)
        .gte('data', startISO.slice(0, 10))
        .lt('data', endISO.slice(0, 10))
        .or('estornado.is.false,estornado.is.null');

      // == Receita hoje (mensalidades) – dia + estorno + org
      const receitaHojeMensalidadesQ = supabase
        .from('pagamentos')
        .select(`
          valor_centavos,
          estornado,
          faturas!inner(org_id)
        `)
        .gte('pago_em', `${hoje}T00:00:00.000Z`)
        .lt('pago_em', `${hoje}T23:59:59.999Z`)
        .eq('faturas.org_id', orgId)
        .or('estornado.is.false,estornado.is.null');

      // == Receita hoje (diversos) – dia + estorno + org
      const receitaHojeDiversosQ = supabase
        .from('pagamentos_diversos')
        .select('valor_centavos, estornado')
        .eq('terreiro_id', orgId)
        .eq('data', hoje)
        .or('estornado.is.false,estornado.is.null');

      // == Escopo VIEWER (membro)
      if (isViewer && membroIdViewer) {
        faturasAbertasMesQ = faturasAbertasMesQ.eq('membro_id', membroIdViewer);
        atrasadasQ = atrasadasQ.eq('membro_id', membroIdViewer);
        ultMensalidadesQ = ultMensalidadesQ.filter('faturas.membro_id', 'eq', membroIdViewer);
        if (viewerMatricula) {
          ultDiversosQ = ultDiversosQ.or(`membro_id.eq.${membroIdViewer},matricula.eq.${viewerMatricula}`);
        } else {
          ultDiversosQ = ultDiversosQ.eq('membro_id', membroIdViewer);
        }
      }

      const [
        membrosRes,
        abertasMesRes,
        mesMensalidadesRes,
        mesDiversosRes,
        hojeMensalidadesRes,
        hojeDiversosRes,
        atrasadasRes,
        ultMensalidadesRes,
        ultDiversosRes,
      ] = await Promise.all([
        membrosQ,
        faturasAbertasMesQ,
        receitaMesMensalidadesQ,
        receitaMesDiversosQ,
        receitaHojeMensalidadesQ,
        receitaHojeDiversosQ,
        atrasadasQ,
        ultMensalidadesQ,
        ultDiversosQ,
      ]);

      const sum = (arr?: any[]) =>
        (arr ?? [])
          .filter(r => r?.estornado !== true) // defesa extra
          .reduce((s, r) => s + toInt(r?.valor_centavos), 0);

      const receitaMesMensalidades = sum(mesMensalidadesRes.data);
      const receitaMesDiversos = sum(mesDiversosRes.data);
      const receitaHojeMensalidades = sum(hojeMensalidadesRes.data);
      const receitaHojeDiversos = sum(hojeDiversosRes.data);

      const ultMensalidades: UltimoPagamento[] = (ultMensalidadesRes.data ?? [])
        .filter((p: any) => p?.estornado !== true)
        .map((p: any) => {
          const st = statusFromRow(p, 'mensalidade');
          return {
            id: p.id,
            tipo: 'mensalidade',
            data: p.pago_em,
            valor_centavos: toInt(p.valor_centavos),
            metodo: p.metodo ?? null,
            descricao: `Ref ${p?.faturas?.refer ?? ''}`,
            refer: p?.faturas?.refer ?? null,
            membro_nome: p?.faturas?.membros?.nome ?? null,
            matricula: p?.faturas?.membros?.matricula ?? null,
            status: st,
          };
        });

      const baseDiversos: UltimoPagamento[] = (ultDiversosRes.data ?? [])
        .filter((d: any) => d?.estornado !== true)
        .map((d: any) => {
          const st = statusFromRow(d, 'diverso');
          return {
            id: d.id,
            tipo: 'diverso',
            data: d.data,
            valor_centavos: toInt(d.valor_centavos),
            metodo: d.metodo ?? null,
            descricao: d.descricao ?? d.tipo ?? 'Diverso',
            refer: null,
            membro_nome: null,
            matricula: d.matricula ?? null,
            status: st,
          };
        });

      // resolve nomes por matrícula (se houver)
      const mats = Array.from(new Set(baseDiversos.map(x => x.matricula).filter(Boolean))) as string[];
      if (mats.length) {
        const { data: membRows } = await supabase
          .from('membros')
          .select('matricula, nome')
          .in('matricula', mats);
        const map = new Map<string, string>();
        (membRows ?? []).forEach((m: any) => {
          if (m?.matricula) map.set(m.matricula, m.nome ?? '');
        });
        baseDiversos.forEach((d) => {
          if (d.matricula) d.membro_nome = map.get(d.matricula) ?? null;
        });
      }

      const ultimos = [...ultMensalidades, ...baseDiversos]
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
        .slice(0, 15);

      const stats: DashboardStats = {
        membrosAtivos: membrosRes.count ?? 0,
        faturasAbertasMes: abertasMesRes.count ?? 0,
        receitaMesMensalidades,
        receitaMesDiversos,
        receitaHojeMensalidades,
        receitaHojeDiversos,
        atrasadas: atrasadasRes.count ?? 0,
      };

      return { stats, ultimos, viewerHint, viewerMatricula };
    },

    // cache forte pra não refazer ao voltar de outra rota/aba:
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30, // 30 min (novo nome no v5)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Skeletons de carregamento
  if (orgLoading || (dashQ.isLoading && !dashQ.data)) {
    return (
      <DashboardLayout>
        <div className="space-y-6 p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 md:h-32 bg-muted/20 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-56 md:h-64 bg-muted/20 rounded-lg animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  const stats = dashQ.data?.stats ?? {
    membrosAtivos: 0,
    faturasAbertasMes: 0,
    receitaMesMensalidades: 0,
    receitaMesDiversos: 0,
    receitaHojeMensalidades: 0,
    receitaHojeDiversos: 0,
    atrasadas: 0,
  };
  const ultimosPagamentos = dashQ.data?.ultimos ?? [];
  const viewerHint = dashQ.data?.viewerHint ?? null;
  const viewerMatricula = dashQ.data?.viewerMatricula ?? null;

  const receitaMesTotal = stats.receitaMesMensalidades + stats.receitaMesDiversos;
  const receitaHojeTotal = stats.receitaHojeMensalidades + stats.receitaHojeDiversos;

  // ====== UI Condicional: VIEWER ======
  if (isViewer) {
    return (
      <DashboardLayout>
        <div className="space-y-8 p-4 md:p-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              Sua visão pessoal (apenas suas mensalidades e pagamentos)
            </p>
          </div>

          {viewerHint && (
            <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Ação necessária do administrador
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {viewerHint}
              </CardContent>
            </Card>
          )}

          {/* Cards principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <Card className="bg-card/50 backdrop-blur-sm border-accent/20 shadow-warm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Em Aberto (Mês)</CardTitle>
                <Receipt className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-accent">{stats.faturasAbertasMes}</div>
                <p className="text-xs text-muted-foreground">
                  Suas faturas do mês ({currentRef()}) em pendência/atraso
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm border-destructive/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Matrículas Atrasadas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {stats.atrasadas}
                </div>
                <p className="text-xs text-muted-foreground">Suas faturas com status vencida</p>
              </CardContent>
            </Card>
          </div>

          {/* Últimos Pagamentos — MOBILE: cards; DESKTOP: tabela */}
          <Card className="bg-card/30 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Seus últimos pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* mobile list */}
              <div className="md:hidden space-y-3">
                {ultimosPagamentos.map((p) => (
                  <div key={`${p.tipo}-${p.id}`} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={p.tipo === 'mensalidade' ? 'default' : 'secondary'}>
                        {p.tipo === 'mensalidade' ? 'Mensalidade' : 'Diverso'}
                      </Badge>
                      <Badge variant={badgeVariantByStatus(p.status)}>
                        {p.status === 'reembolsado' ? 'Reembolsado' : p.status === 'cancelado' ? 'Cancelado' : 'Pago'}
                      </Badge>
                      <span className="text-sm">{formatCurrency(p.valor_centavos)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(p.data).toLocaleDateString('pt-BR')} • {p.metodo ?? '-'}
                    </div>
                    <div className="mt-1 text-sm">
                      {p.tipo === 'mensalidade'
                        ? (p.membro_nome || 'N/A') + (p.refer ? ` • Ref ${p.refer}` : '')
                        : (p.descricao || 'Diverso') + (p.membro_nome ? ` • ${p.membro_nome}` : '')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Matrícula: {p.matricula ?? viewerMatricula ?? '-'}
                    </div>
                  </div>
                ))}
                {ultimosPagamentos.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>Nenhum pagamento encontrado</p>
                  </div>
                )}
              </div>

              {/* desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Membro/Descrição</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ultimosPagamentos.map((p) => (
                      <TableRow key={`${p.tipo}-${p.id}`} className="border-border/50">
                        <TableCell className="font-medium">
                          <Badge variant={p.tipo === 'mensalidade' ? 'default' : 'secondary'}>
                            {p.tipo === 'mensalidade' ? 'Mensalidade' : 'Diverso'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(p.data).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{p.matricula ?? viewerMatricula ?? '-'}</TableCell>
                        <TableCell>
                          {p.tipo === 'mensalidade'
                            ? (p.membro_nome || 'N/A') + (p.refer ? ` • Ref ${p.refer}` : '')
                            : (p.descricao || 'Diverso') + (p.membro_nome ? ` • ${p.membro_nome}` : '')}
                        </TableCell>
                        <TableCell>{p.metodo ?? '-'}</TableCell>
                        <TableCell>
                          <Badge variant={badgeVariantByStatus(p.status)}>
                            {p.status === 'reembolsado' ? 'Reembolsado' : p.status === 'cancelado' ? 'Cancelado' : 'Pago'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-right">
                          {formatCurrency(p.valor_centavos)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {ultimosPagamentos.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Nenhum pagamento encontrado</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ====== UI padrão (não-viewer) ======
  return (
    <DashboardLayout>
      <div className="space-y-8 p-4 md:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu terreiro</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/20 shadow-sacred">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Membros Ativos</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.membrosAtivos}</div>
              <p className="text-xs text-muted-foreground">Total de membros cadastrados</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-accent/20 shadow-warm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Aberto (Mês)</CardTitle>
              <Receipt className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.faturasAbertasMes}</div>
              <p className="text-xs text-muted-foreground">
                Faturas do mês ({currentRef()}) em pendência/atraso
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-secondary/20 shadow-ethereal">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita do Mês (Total)</CardTitle>
              <DollarSign className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-secondary">
                {formatCurrency(receitaMesTotal)}
              </div>
              <p className="text-xs text-muted-foreground">
                Mensalidades: {formatCurrency(stats.receitaMesMensalidades)} • Diversos: {formatCurrency(stats.receitaMesDiversos)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-destructive/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matrículas Atrasadas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {stats.atrasadas}
              </div>
              <p className="text-xs text-muted-foreground">Faturas com status vencida</p>
            </CardContent>
          </Card>
        </div>

        {/* Receita de Hoje */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita de Hoje (Total)</CardTitle>
              <CalendarClock className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(receitaHojeTotal)}</div>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString('pt-BR')}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hoje • Mensalidades</CardTitle>
              <DollarSign className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.receitaHojeMensalidades)}
              </div>
              <p className="text-xs text-muted-foreground">Pagamentos de faturas efetuados hoje</p>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hoje • Diversos</CardTitle>
              <DollarSign className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats.receitaHojeDiversos)}
              </div>
              <p className="text-xs text-muted-foreground">Pagamentos diversos com data de hoje</p>
            </CardContent>
          </Card>
        </div>

        {/* Últimos Pagamentos (mensalidades + diversos) */}
        <Card className="bg-card/30 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Últimos Pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* mobile list */}
            <div className="md:hidden space-y-3">
              {ultimosPagamentos.map((p) => (
                <div key={`${p.tipo}-${p.id}`} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={p.tipo === 'mensalidade' ? 'default' : 'secondary'}>
                      {p.tipo === 'mensalidade' ? 'Mensalidade' : 'Diverso'}
                    </Badge>
                    <Badge variant={badgeVariantByStatus(p.status)}>
                      {p.status === 'reembolsado' ? 'Reembolsado' : p.status === 'cancelado' ? 'Cancelado' : 'Pago'}
                    </Badge>
                    <span className="text-sm">{formatCurrency(p.valor_centavos)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(p.data).toLocaleDateString('pt-BR')} • {p.metodo ?? '-'}
                  </div>
                  <div className="mt-1 text-sm">
                    {p.tipo === 'mensalidade'
                      ? (p.membro_nome || 'N/A') + (p.refer ? ` • Ref ${p.refer}` : '')
                      : (p.descricao || 'Diverso') + (p.membro_nome ? ` • ${p.membro_nome}` : '')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Matrícula: {p.matricula ?? '-'}
                  </div>
                </div>
              ))}
              {ultimosPagamentos.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p>Nenhum pagamento encontrado</p>
                </div>
              )}
            </div>

            {/* desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Membro/Descrição</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimosPagamentos.map((p) => (
                    <TableRow key={`${p.tipo}-${p.id}`} className="border-border/50">
                      <TableCell className="font-medium">
                        <Badge variant={p.tipo === 'mensalidade' ? 'default' : 'secondary'}>
                          {p.tipo === 'mensalidade' ? 'Mensalidade' : 'Diverso'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(p.data).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{p.matricula ?? '-'}</TableCell>
                      <TableCell>
                        {p.tipo === 'mensalidade'
                          ? (p.membro_nome || 'N/A') + (p.refer ? ` • Ref ${p.refer}` : '')
                          : (p.descricao || 'Diverso') + (p.membro_nome ? ` • ${p.membro_nome}` : '')}
                      </TableCell>
                      <TableCell>{p.metodo ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant={badgeVariantByStatus(p.status)}>
                          {p.status === 'reembolsado' ? 'Reembolsado' : p.status === 'cancelado' ? 'Cancelado' : 'Pago'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-right">
                        {formatCurrency(p.valor_centavos)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {ultimosPagamentos.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhum pagamento encontrado</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
