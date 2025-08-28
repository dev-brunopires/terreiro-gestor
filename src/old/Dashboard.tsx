// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
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

type Role = 'owner' | 'admin' | 'viewer' | 'financeiro' | 'operador';

type UltimoPagamento = {
  id: string;
  tipo: 'mensalidade' | 'diverso';
  data: string; // ISO date or timestamp
  valor_centavos: number;
  metodo?: string | null;
  descricao?: string | null;     // para diversos
  refer?: string | null;         // para mensalidades
  membro_nome?: string | null;
  matricula?: string | null;
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

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    membrosAtivos: 0,
    faturasAbertasMes: 0,
    receitaMesMensalidades: 0,
    receitaMesDiversos: 0,
    receitaHojeMensalidades: 0,
    receitaHojeDiversos: 0,
    atrasadas: 0,
  });
  const [ultimosPagamentos, setUltimosPagamentos] = useState<UltimoPagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [isViewer, setIsViewer] = useState<boolean>(false);
  const [viewerHint, setViewerHint] = useState<string | null>(null); // quando viewer sem membro
  const [viewerMatricula, setViewerMatricula] = useState<string | null>(null); // p/ filtrar diversos se necessário
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

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

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // 0) auth + profile
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('Usuário não autenticado');

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('org_id, role, membro_id')
        .eq('user_id', auth.user.id)
        .single();

      if (profErr) throw profErr;

      const role = (profile?.role ?? 'operador') as Role;
      const isViewerRole = role === 'viewer';
      setIsViewer(isViewerRole);

      const orgId = profile!.org_id;
      const membroIdViewer: string | null = isViewerRole ? (profile as any)?.membro_id ?? null : null;

      // se viewer e sem vínculo a membro, exibe dica e evita quebrar
      if (isViewerRole && !membroIdViewer) {
        setViewerHint('Seu usuário é do tipo "viewer", mas ainda não está vinculado a um membro. Peça ao administrador para vincular seu acesso a um membro (Configurações → Usuários).');
      }

      // Se precisarmos da matrícula do viewer para filtrar "diversos"
      let matriculaViewer: string | null = null;
      if (isViewerRole && membroIdViewer) {
        const { data: memb } = await supabase
          .from('membros')
          .select('matricula')
          .eq('id', membroIdViewer)
          .maybeSingle();
        matriculaViewer = (memb as any)?.matricula ?? null;
        setViewerMatricula(matriculaViewer);
      }

      const { startISO, endISO } = monthBounds();
      const refMes = currentRef();
      const hoje = todayISO();

      // ====== QUERIES BASE, COM BRANCH POR VIEWER OU NÃO ======

      // 1) membros ativos
      const membrosQ = supabase
        .from('membros')
        .select('id', { count: 'exact', head: true })
        .eq('ativo', true)
        .or(`org_id.eq.${orgId},terreiro_id.eq.${orgId}`);

      // 2) faturas em aberto do mês
      let faturasAbertasMesQ = supabase
        .from('faturas')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('refer', refMes)
        .in('status', ['pendente', 'vencida']);

      // 7) faturas atrasadas (status = vencida)
      let atrasadasQ = supabase
        .from('faturas')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'vencida');

      // 8a) últimos pagamentos de mensalidades
      let ultMensalidadesQ = supabase
        .from('pagamentos')
        .select(`
          id,
          pago_em,
          valor_centavos,
          metodo,
          faturas!inner(
            id,
            refer,
            membro_id,
            membros:membro_id(nome, matricula)
          )
        `)
        .order('pago_em', { ascending: false })
        .limit(15);

      // 8b) últimos pagamentos diversos
      let ultDiversosQ = supabase
        .from('pagamentos_diversos')
        .select('id, data, valor_centavos, metodo, tipo, descricao, matricula, membro_id')
        .eq('terreiro_id', orgId)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(15);

      // Receitas (somente não-viewer)
      const receitaMesMensalidadesQ = supabase
        .from('pagamentos')
        .select('valor_centavos')
        .gte('pago_em', startISO)
        .lt('pago_em', endISO);

      const receitaMesDiversosQ = supabase
        .from('pagamentos_diversos')
        .select('valor_centavos')
        .eq('terreiro_id', orgId)
        .gte('data', startISO.slice(0, 10))
        .lt('data', endISO.slice(0, 10));

      const receitaHojeMensalidadesQ = supabase
        .from('pagamentos')
        .select('valor_centavos')
        .gte('pago_em', `${hoje}T00:00:00.000Z`)
        .lt('pago_em', `${hoje}T23:59:59.999Z`);

      const receitaHojeDiversosQ = supabase
        .from('pagamentos_diversos')
        .select('valor_centavos')
        .eq('terreiro_id', orgId)
        .eq('data', hoje);

      // ====== RESTRIÇÕES PARA VIEWER ======
      if (isViewerRole && membroIdViewer) {
        // faturas abertas do mês → apenas do membro
        faturasAbertasMesQ = faturasAbertasMesQ.eq('membro_id', membroIdViewer);

        // atrasadas → apenas do membro
        atrasadasQ = atrasadasQ.eq('membro_id', membroIdViewer);

        // últimos pagamentos (mensalidades) → filtradas pelo membro via join em faturas
        ultMensalidadesQ = ultMensalidadesQ.filter('faturas.membro_id', 'eq', membroIdViewer);

        // últimos diversos: filtra por membro_id OU, se não houver, pela matrícula resolvida
        if (matriculaViewer) {
          ultDiversosQ = ultDiversosQ.or(`membro_id.eq.${membroIdViewer},matricula.eq.${matriculaViewer}`);
        } else {
          ultDiversosQ = ultDiversosQ.eq('membro_id', membroIdViewer);
        }
      }

      // ====== DISPARA AS QUERIES ======
      const promises: any[] = [
        membrosQ,
        faturasAbertasMesQ,
        receitaMesMensalidadesQ,
        receitaMesDiversosQ,
        receitaHojeMensalidadesQ,
        receitaHojeDiversosQ,
        atrasadasQ,
        ultMensalidadesQ,
        ultDiversosQ,
      ];

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
      ] = await Promise.all(promises);

      const sum = (arr?: any[]) => (arr ?? []).reduce((s, r) => s + toInt(r?.valor_centavos), 0);

      const receitaMesMensalidades = sum(mesMensalidadesRes.data);
      const receitaMesDiversos = sum(mesDiversosRes.data);
      const receitaHojeMensalidades = sum(hojeMensalidadesRes.data);
      const receitaHojeDiversos = sum(hojeDiversosRes.data);

      // Monta “últimos pagamentos” unificando
      const ultMensalidades: UltimoPagamento[] = (ultMensalidadesRes.data ?? []).map((p: any) => ({
        id: p.id,
        tipo: 'mensalidade',
        data: p.pago_em,
        valor_centavos: toInt(p.valor_centavos),
        metodo: p.metodo ?? null,
        descricao: `Ref ${p?.faturas?.refer ?? ''}`,
        refer: p?.faturas?.refer ?? null,
        membro_nome: p?.faturas?.membros?.nome ?? null,
        matricula: p?.faturas?.membros?.matricula ?? null,
      }));

      const baseDiversos: UltimoPagamento[] = (ultDiversosRes.data ?? []).map((d: any) => ({
        id: d.id,
        tipo: 'diverso',
        data: d.data, // yyyy-mm-dd
        valor_centavos: toInt(d.valor_centavos),
        metodo: d.metodo ?? null,
        descricao: d.descricao ?? d.tipo ?? 'Diverso',
        refer: null,
        membro_nome: null, // vamos preencher por matrícula (se existir)
        matricula: d.matricula ?? null,
      }));

      // Resolve nomes por matrícula (para diversos)
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

      const unificados = [...ultMensalidades, ...baseDiversos]
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
        .slice(0, 15);

      setStats({
        membrosAtivos: membrosRes.count ?? 0,
        faturasAbertasMes: abertasMesRes.count ?? 0,
        receitaMesMensalidades,
        receitaMesDiversos,
        receitaHojeMensalidades,
        receitaHojeDiversos,
        atrasadas: atrasadasRes.count ?? 0,
      });

      setUltimosPagamentos(unificados);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Erro ao carregar dados',
        description: error?.message ?? 'Tente recarregar a página',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (centavos: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      (centavos ?? 0) / 100
    );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted/20 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-muted/20 rounded-lg animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  const receitaMesTotal = stats.receitaMesMensalidades + stats.receitaMesDiversos;
  const receitaHojeTotal = stats.receitaHojeMensalidades + stats.receitaHojeDiversos;

  // ====== UI Condicional: VIEWER ======
  if (isViewer) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
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

          {/* Apenas 2 cards: Em aberto (mês) e Atrasadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          {/* Últimos Pagamentos (só do próprio membro) */}
          <Card className="bg-card/30 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Seus últimos pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Método</TableHead>
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
                      <TableCell>
                        {new Date(p.data).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>{p.matricula ?? viewerMatricula ?? '-'}</TableCell>
                      <TableCell>
                        {p.tipo === 'mensalidade'
                          ? (p.membro_nome || 'N/A') + (p.refer ? ` • Ref ${p.refer}` : '')
                          : (p.descricao || 'Diverso')}
                      </TableCell>
                      <TableCell>{p.metodo ?? '-'}</TableCell>
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
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ====== UI padrão (não-viewer) ======
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu terreiro</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Membro/Descrição</TableHead>
                  <TableHead>Método</TableHead>
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
                    <TableCell>
                      {new Date(p.data).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>{p.matricula ?? '-'}</TableCell>
                    <TableCell>
                      {p.tipo === 'mensalidade'
                        ? (p.membro_nome || 'N/A') + (p.refer ? ` • Ref ${p.refer}` : '')
                        : (p.descricao || 'Diverso') + (p.membro_nome ? ` • ${p.membro_nome}` : '')
                      }
                    </TableCell>
                    <TableCell>{p.metodo ?? '-'}</TableCell>
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
