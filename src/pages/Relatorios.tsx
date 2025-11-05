import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  FileBarChart,
  Download,
  DollarSign,
  TrendingUp,
  Receipt,
  FileText,
  Filter,
  CreditCard,
  HandCoins,
  Calendar,
} from 'lucide-react';
import FeatureGate from "@/components/FeatureGate";
import UpgradeCard from "@/components/UpgradeCard";
/* ==================== Tipos ==================== */
interface RelatorioFinanceiro {
  periodo: string;
  total_esperado: number;
  total_pago: number;
  total_aberto: number;
  taxa_inadimplencia: number;
  faturas_abertas: number;
  faturas_pagas: number;
  total_faturas: number;
  faturas_pagas_periodo: number;
  pagamentos_periodo: number;
}

interface FaturaDetalhada {
  id: string;
  refer: string;
  dt_vencimento: string | null;
  valor_centavos: number | string | null;
  status: string;
  membro_nome: string;
  membro_matricula?: string;
  plano_nome: string;
  dt_pagamento?: string | null;
  valor_pago_centavos?: number | string | null;
}

interface PagamentoDetalhado {
  id: string;
  pago_em: string;
  valor_centavos: number;
  fatura_id: string;
  refer?: string | null;
  membro_matricula?: string | null;
  membro_nome?: string | null;
  plano_nome?: string | null;
}

interface PagDiversoDetalhado {
  id: string;
  data: string;
  tipo: string | null;
  descricao: string | null;
  metodo: string | null;
  valor_centavos: number;
  matricula: string | null;
  membro_nome?: string | null;
}

/* ==================== Utils ==================== */
function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function toInt(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// helpers de data para range diário
function addDaysISO(dateYYYYMMDD: string, days: number) {
  const d = new Date(dateYYYYMMDD + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return isoDate(d); // YYYY-MM-DD
}
function startOfDayISO(dateYYYYMMDD: string) {
  const d = new Date(dateYYYYMMDD + 'T00:00:00');
  d.setHours(0, 0, 0, 0);
  return d.toISOString(); // timestamptz ISO
}

/* ==================== pdfmake init ==================== */
let _pdfMakeReady: Promise<any> | null = null;
async function ensurePdfMake() {
  if (typeof window === 'undefined') throw new Error('Exportação em PDF disponível apenas no browser.');
  if (_pdfMakeReady) return _pdfMakeReady;

  _pdfMakeReady = (async () => {
    const pdfMakeMod: any = await import('pdfmake/build/pdfmake');
    const pdfMake: any = pdfMakeMod.default ?? pdfMakeMod;
    const fontsMod: any = await import('pdfmake/build/vfs_fonts');

    const candidates = [
      fontsMod?.pdfMake?.vfs,
      fontsMod?.default?.pdfMake?.vfs,
      fontsMod?.vfs,
      fontsMod?.default?.vfs,
      (fontsMod?.default && typeof fontsMod.default === 'object' ? fontsMod.default : undefined),
      (fontsMod && typeof fontsMod === 'object' ? fontsMod : undefined),
    ].filter(Boolean);

    let vfs: any;
    for (const c of candidates) {
      if (!c) continue;
      if ((c as any).pdfMake?.vfs) { vfs = (c as any).pdfMake.vfs; break; }
      if (typeof c === 'object') {
        const keys = Object.keys(c);
        if (keys.length > 10 || keys.some(k => /Roboto/i.test(k))) { vfs = c; break; }
      }
    }
    if (!vfs) throw new Error('Não foi possível localizar o VFS do pdfmake (vfs_fonts).');
    pdfMake.vfs = vfs;
    return pdfMake;
  })();

  return _pdfMakeReady;
}

/* ==================== Componente ==================== */
export default function Relatorios() {
  const [relatorioFinanceiro, setRelatorioFinanceiro] = useState<RelatorioFinanceiro | null>(null);
  const [faturas, setFaturas] = useState<FaturaDetalhada[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoDetalhado[]>([]);
  const [pagamentosDiversos, setPagamentosDiversos] = useState<PagDiversoDetalhado[]>([]);
  const [loading, setLoading] = useState(false);

  // Agora datas completas (YYYY-MM-DD)
  const hojeISO = new Date().toISOString().slice(0, 10);
  const [periodoInicio, setPeriodoInicio] = useState(hojeISO);
  const [periodoFim, setPeriodoFim] = useState(hojeISO);

  const [filtroStatus, setFiltroStatus] = useState<'all' | 'aberta' | 'paga' | 'vencida'>('all');
  const [matriculaFiltro, setMatriculaFiltro] = useState('');
  const [modoLista, setModoLista] = useState<'faturas' | 'pagamentos' | 'diversos'>('faturas');

  // opções de autocomplete de matrícula
  const [matOptions, setMatOptions] = useState<{ matricula: string; nome: string | null }[]>([]);

  const { toast } = useToast();

  // carrega opções de matrícula para o datalist
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('membros')
        .select('matricula, nome')
        .order('nome', { ascending: true })
        .limit(1000);
      if (!error && data) {
        setMatOptions(
          (data as any[]).filter(r => r.matricula).map(r => ({ matricula: r.matricula, nome: r.nome ?? null }))
        );
      }
    })();
  }, []);

  useEffect(() => {
    gerarRelatorio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoInicio, periodoFim, matriculaFiltro]);

  const normalizaStatus = (st: string) => (st === 'pendente' ? 'aberta' : st);

  const gerarRelatorio = async () => {
    try {
      setLoading(true);

      // RANGE por dia:
      // - Para colunas TIMESTAMPTZ (ex.: pagamentos.pago_em): [>= startTS, < endTSExclusive]
      // - Para colunas DATE (ex.: faturas.dt_vencimento, pagamentos_diversos.data): [>= startISO, < endExclusive]
      const startISO = periodoInicio;               // YYYY-MM-DD
      const endExclusive = addDaysISO(periodoFim, 1); // YYYY-MM-DD do dia seguinte
      const startTS = startOfDayISO(periodoInicio);    // 00:00 do início
      const endTSExclusive = startOfDayISO(endExclusive); // 00:00 do dia seguinte

      // === Pagamentos (faturas) — pago_em é TIMESTAMPTZ
      let pagamentosQuery = supabase
        .from('pagamentos')
        .select(`
          id,
          valor_centavos,
          pago_em,
          faturas!inner(
            id,
            refer,
            dt_vencimento,
            valor_centavos,
            status,
            planos:plano_id(nome),
            membros!inner(matricula, nome)
          )
        `)
        .gte('pago_em', startTS)
        .lt('pago_em', endTSExclusive);

      if (matriculaFiltro.trim()) {
        pagamentosQuery = pagamentosQuery.eq('faturas.membros.matricula', matriculaFiltro.trim());
      }

      // === Esperado por vencimento — dt_vencimento é DATE
      let esperadoQuery = supabase
        .from('faturas')
        .select(`
          id,
          status,
          valor_centavos,
          dt_vencimento,
          membros!inner(matricula)
        `)
        .gte('dt_vencimento', startISO)
        .lt('dt_vencimento', endExclusive);

      if (matriculaFiltro.trim()) {
        esperadoQuery = esperadoQuery.eq('membros.matricula', matriculaFiltro.trim());
      }

      // === Não pagas (para lista faturas) — DATE
      let naoPagasQuery = supabase
        .from('faturas')
        .select(`
          id,
          refer,
          dt_vencimento,
          valor_centavos,
          status,
          planos:plano_id(nome),
          membros!inner(matricula, nome)
        `)
        .neq('status', 'paga')
        .gte('dt_vencimento', startISO)
        .lt('dt_vencimento', endExclusive)
        .order('dt_vencimento', { ascending: false });

      if (matriculaFiltro.trim()) {
        naoPagasQuery = naoPagasQuery.eq('membros.matricula', matriculaFiltro.trim());
      }

      // === Diversos — data é DATE
      let diversosQuery = supabase
        .from('pagamentos_diversos')
        .select('id, data, tipo, descricao, valor_centavos, matricula, formas_pagamento:forma_pagamento_id(nome)')
        .gte('data', startISO)
        .lt('data', endExclusive)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false });

      if (matriculaFiltro.trim()) {
        diversosQuery = diversosQuery.eq('matricula', matriculaFiltro.trim());
      }

      const [
        { data: pagamentosData, error: pgErr },
        { data: esperadoData, error: espErr },
        { data: naoPagasData, error: npErr },
        { data: diversosData, error: divErr },
      ] = await Promise.all([pagamentosQuery, esperadoQuery, naoPagasQuery, diversosQuery]);

      if (pgErr) throw pgErr;
      if (espErr) throw espErr;
      if (npErr) throw npErr;
      if (divErr) throw divErr;

      // ===== KPIs
      const totalPago = (pagamentosData ?? []).reduce(
        (sum: number, p: any) => sum + toInt(p.valor_centavos),
        0
      );
      const pagamentosPeriodo = (pagamentosData ?? []).length;

      const faturasPagasPeriodoSet = new Set<string>();
      (pagamentosData ?? []).forEach((p: any) => {
        const fid = p?.faturas?.id;
        if (fid) faturasPagasPeriodoSet.add(fid);
      });
      const faturasPagasPeriodo = faturasPagasPeriodoSet.size;

      const esperadoArr = (esperadoData ?? []).map((f: any) => ({
        status: normalizaStatus(f.status),
        valor: toInt(f.valor_centavos),
      }));
      const totalEsperado = esperadoArr.reduce((s, f) => s + f.valor, 0);
      const totalFaturas = esperadoArr.length;
      const faturasPagasEsperado = esperadoArr.filter(f => f.status === 'paga').length;
      const faturasAbertasEsperado = esperadoArr.filter(f => f.status !== 'paga').length;
      const taxaInadimplencia = totalFaturas ? (faturasAbertasEsperado / totalFaturas) * 100 : 0;
      const totalAberto = esperadoArr.filter(f => f.status !== 'paga').reduce((s, f) => s + f.valor, 0);

      // ===== LISTA: faturas
      const pagosMap = new Map<string, { pago_em: string; total_pago_centavos: number; base: any }>();
      (pagamentosData ?? []).forEach((p: any) => {
        const f = p.faturas;
        if (!f?.id) return;
        const prev = pagosMap.get(f.id);
        const pago_em = p.pago_em;
        const novo_total = (prev?.total_pago_centavos ?? 0) + toInt(p.valor_centavos);
        const lastDate = !prev || new Date(pago_em) > new Date(prev.pago_em) ? pago_em : prev.pago_em;
        pagosMap.set(f.id, { pago_em: lastDate, total_pago_centavos: novo_total, base: p });
      });

      const listaPagas: FaturaDetalhada[] = Array.from(pagosMap.values()).map(({ pago_em, total_pago_centavos, base }) => {
        const f = base.faturas;
        return {
          id: f.id,
          refer: f.refer,
          dt_vencimento: f.dt_vencimento,
          valor_centavos: f.valor_centavos,
          status: 'paga',
          membro_nome: f.membros?.nome || 'N/A',
          membro_matricula: f.membros?.matricula || undefined,
          plano_nome: f.planos?.nome || 'N/A',
          dt_pagamento: pago_em,
          valor_pago_centavos: total_pago_centavos
        };
      });

      const listaNaoPagas: FaturaDetalhada[] = (naoPagasData as any[] ?? []).map((f) => ({
        id: f.id,
        refer: f.refer,
        dt_vencimento: f.dt_vencimento,
        valor_centavos: f.valor_centavos,
        status: normalizaStatus(f.status),
        membro_nome: f.membros?.nome || 'N/A',
        membro_matricula: f.membros?.matricula || undefined,
        plano_nome: f.planos?.nome || 'N/A',
        dt_pagamento: null,
        valor_pago_centavos: null
      }));

      const faturasUnidas = [...listaPagas, ...listaNaoPagas].sort((a, b) => {
        const da = a.dt_pagamento ?? a.dt_vencimento ?? '';
        const db = b.dt_pagamento ?? b.dt_vencimento ?? '';
        return (db || '').localeCompare(da || '');
      });
      setFaturas(faturasUnidas);

      // ===== LISTA: pagamentos (faturas)
      const pagamentosLista: PagamentoDetalhado[] = (pagamentosData ?? []).map((p: any) => ({
        id: p.id,
        pago_em: p.pago_em,
        valor_centavos: toInt(p.valor_centavos),
        fatura_id: p.faturas?.id,
        refer: p.faturas?.refer ?? null,
        membro_matricula: p.faturas?.membros?.matricula ?? null,
        membro_nome: p.faturas?.membros?.nome ?? null,
        plano_nome: p.faturas?.planos?.nome ?? null
      })).sort((a, b) => (b.pago_em || '').localeCompare(a.pago_em || ''));
      setPagamentos(pagamentosLista);

      // ===== LISTA: pagamentos diversos (anexa nome por matrícula)
      const diversosBase: PagDiversoDetalhado[] = (diversosData ?? []).map((d: any) => ({
        id: d.id,
        data: d.data,
        tipo: d.tipo,
        descricao: d.descricao,
        metodo: d.formas_pagamento?.nome ?? null,
        valor_centavos: toInt(d.valor_centavos),
        matricula: d.matricula,
      }));
      const mats = Array.from(new Set(diversosBase.map(d => d.matricula).filter(Boolean))) as string[];
      let matToNome = new Map<string, string | null>();
      if (mats.length) {
        const { data: membrosRows, error: membErr } = await supabase
          .from('membros')
          .select('matricula, nome')
          .in('matricula', mats);
        if (membErr) throw membErr;
        (membrosRows ?? []).forEach((m: any) => {
          if (m?.matricula) matToNome.set(m.matricula, m.nome ?? null);
        });
      }
      const diversosLista: PagDiversoDetalhado[] = diversosBase.map(d => ({
        ...d,
        membro_nome: d.matricula ? (matToNome.get(d.matricula) ?? null) : null,
      }));
      setPagamentosDiversos(diversosLista);

      setRelatorioFinanceiro({
        periodo: `${periodoInicio} a ${periodoFim}`,
        total_esperado: totalEsperado,
        total_pago: totalPago,
        total_aberto: totalAberto,
        taxa_inadimplencia: taxaInadimplencia,
        faturas_abertas: faturasAbertasEsperado,
        faturas_pagas: faturasPagasEsperado,
        total_faturas: totalFaturas,
        faturas_pagas_periodo: faturasPagasPeriodo,
        pagamentos_periodo: pagamentosPeriodo,
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro ao gerar relatório",
        description: error?.message ?? "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (centavos: number | string | null) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toInt(centavos) / 100);

  const getStatusBadge = (status: string) => {
    const st = normalizaStatus(status);
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      'paga': 'default',
      'aberta': 'destructive',
      'vencida': 'destructive'
    };
    return <Badge variant={variants[st] || 'secondary'}>{st.charAt(0).toUpperCase() + st.slice(1)}</Badge>;
  };

  const faturasFiltradas = useMemo(
    () => faturas.filter(f => filtroStatus === 'all' || normalizaStatus(f.status) === filtroStatus),
    [faturas, filtroStatus]
  );

  /* ==================== Export XLSX ==================== */
  const exportarXLSX = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(
        modoLista === 'faturas' ? 'Faturas' :
        modoLista === 'pagamentos' ? 'Pagamentos' : 'PagamentosDiversos'
      );

      const titulo = `Relatório de ${
        modoLista === 'faturas' ? 'Faturas' :
        modoLista === 'pagamentos' ? 'Pagamentos' : 'Pagamentos diversos'
      } — ${periodoInicio} a ${periodoFim}${matriculaFiltro ? ` — Matrícula ${matriculaFiltro}` : ''}`;

      ws.mergeCells('A1:H1');
      ws.getCell('A1').value = titulo;
      ws.getCell('A1').font = { bold: true, size: 14 };
      ws.getCell('A1').alignment = { horizontal: 'center' };

      if (modoLista === 'faturas') {
        const header = ['Referência', 'Matrícula', 'Membro', 'Plano', 'Vencimento', 'Valor', 'Status', 'Pago em'];
        ws.addRow(header);
        const headerRow = ws.getRow(2);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 22;

        const lista = faturasFiltradas;
        lista.forEach((f, idx) => {
          ws.addRow([
            f.refer,
            f.membro_matricula || '',
            f.membro_nome,
            f.plano_nome,
            f.dt_vencimento ? new Date(f.dt_vencimento) : '',
            toInt(f.valor_centavos) / 100,
            normalizaStatus(f.status),
            f.dt_pagamento ? new Date(f.dt_pagamento) : ''
          ]);
          const row = ws.getRow(ws.lastRow!.number);
          if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F6FF' } };
        });

        ws.columns = [
          { width: 14 }, { width: 14 }, { width: 28 }, { width: 26 },
          { width: 14 }, { width: 14 }, { width: 12 }, { width: 14 }
        ];
        ws.getColumn(5).numFmt = 'dd/mm/yyyy';
        ws.getColumn(6).numFmt = 'R$ #,##0.00';
        ws.getColumn(8).numFmt = 'dd/mm/yyyy';

        const totalPagoSel = lista
          .filter(f => normalizaStatus(f.status) === 'paga')
          .reduce((s, f) => s + toInt(f.valor_pago_centavos ?? f.valor_centavos), 0);
        const totalAbertoSel = lista
          .filter(f => normalizaStatus(f.status) !== 'paga')
          .reduce((s, f) => s + toInt(f.valor_centavos), 0);

        ws.addRow([]);
        const addTotalRow = (label: string, valorCent: number) => {
          const row = ws.addRow(['', '', '', '', '', label, valorCent / 100]);
          row.font = { bold: true };
          ws.getCell(`G${row.number}`).numFmt = 'R$ #,##0.00';
        };
        addTotalRow('Total pago', totalPagoSel);
        addTotalRow('Total em aberto', totalAbertoSel);
      } else if (modoLista === 'pagamentos') {
        const header = ['Pago em', 'Valor', 'Método', 'Ref', 'Matrícula', 'Membro', 'Plano'];
        ws.addRow(header);
        const headerRow = ws.getRow(2);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 22;

        pagamentos.forEach((p, idx) => {
          ws.addRow([
            new Date(p.pago_em),
            toInt(p.valor_centavos) / 100,
            p.refer || '',
            p.membro_matricula || '',
            p.membro_nome || '',
            p.plano_nome || ''
          ]);
          const row = ws.getRow(ws.lastRow!.number);
          if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F6FF' } };
        });

        ws.columns = [{ width: 18 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 28 }, { width: 24 }];
        ws.getColumn(1).numFmt = 'dd/mm/yyyy';
        ws.getColumn(2).numFmt = 'R$ #,##0.00';

        ws.addRow([]);
        const somaPagamentos = pagamentos.reduce((s, p) => s + toInt(p.valor_centavos), 0);
        const row = ws.addRow(['', somaPagamentos / 100, '', '', '', 'Total de pagamentos no período']);
        row.font = { bold: true };
        ws.getCell(`B${row.number}`).numFmt = 'R$ #,##0.00';
      } else {
        // DIVERSOS (com Membro)
        const header = ['Data', 'Tipo', 'Descrição', 'Matrícula', 'Membro', 'Método', 'Valor'];
        ws.addRow(header);
        const headerRow = ws.getRow(2);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 22;

        pagamentosDiversos.forEach((d, idx) => {
          ws.addRow([
            new Date(d.data),
            d.tipo || '',
            d.descricao || '',
            d.matricula || '',
            d.membro_nome || '',
            d.metodo || '',
            toInt(d.valor_centavos) / 100
          ]);
          const row = ws.getRow(ws.lastRow!.number);
          if (idx % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F6FF' } };
        });

        ws.columns = [{ width: 14 }, { width: 12 }, { width: 36 }, { width: 14 }, { width: 28 }, { width: 16 }, { width: 14 }];
        ws.getColumn(1).numFmt = 'dd/mm/yyyy';
        ws.getColumn(7).numFmt = 'R$ #,##0.00';

        ws.addRow([]);
        const somaDiversos = pagamentosDiversos.reduce((s, d) => s + toInt(d.valor_centavos), 0);
        const row = ws.addRow(['', '', '', '', '', 'Total no período', somaDiversos / 100]);
        row.font = { bold: true };
        ws.getCell(`G${row.number}`).numFmt = 'R$ #,##0.00';
      }

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const name = `relatorio_${modoLista}_${periodoInicio}_${periodoFim}${matriculaFiltro ? `_mat_${matriculaFiltro}` : ''}.xlsx`;
      saveAs(blob, name);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Falha ao exportar XLSX',
        description: err?.message ?? 'Verifique as dependências (exceljs e file-saver).',
        variant: 'destructive',
      });
    }
  };

  /* ==================== Export PDF ==================== */
  const exportarPDF = async () => {
    try {
      const pdfMake = await ensurePdfMake();
      const title = `Relatório de ${
        modoLista === 'faturas' ? 'Faturas' : modoLista === 'pagamentos' ? 'Pagamentos' : 'Pagamentos diversos'
      } • ${periodoInicio} a ${periodoFim}${matriculaFiltro ? ` • Matrícula ${matriculaFiltro}` : ''}`;
      const hoje = new Date().toLocaleDateString('pt-BR');

      let body: any[][] = [];
      if (modoLista === 'faturas') {
        const lista = faturasFiltradas;
        body = [
          [{ text: 'Ref', style: 'th' }, { text: 'Matrícula', style: 'th' }, { text: 'Membro', style: 'th' },
           { text: 'Plano', style: 'th' }, { text: 'Vencimento', style: 'th' }, { text: 'Valor', style: 'th', alignment: 'right' },
           { text: 'Status', style: 'th' }, { text: 'Pago em', style: 'th' }],
          ...lista.map((f, idx) => ([
            { text: f.refer, style: idx % 2 ? 'tdAlt' : 'td' },
            { text: f.membro_matricula || '', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: f.membro_nome, style: idx % 2 ? 'tdAlt' : 'td' },
            { text: f.plano_nome, style: idx % 2 ? 'tdAlt' : 'td' },
            { text: f.dt_vencimento ? new Date(f.dt_vencimento).toLocaleDateString('pt-BR') : '-', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: formatCurrency(f.valor_centavos), alignment: 'right', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: (f.status.charAt(0).toUpperCase() + f.status.slice(1)), style: idx % 2 ? 'tdAlt' : 'td' },
            { text: f.dt_pagamento ? new Date(f.dt_pagamento).toLocaleDateString('pt-BR') : '-', style: idx % 2 ? 'tdAlt' : 'td' },
          ]))
        ];
        const totalPagoSel = lista.filter(f => (f.status === 'paga'))
          .reduce((s, f) => s + toInt(f.valor_pago_centavos ?? f.valor_centavos), 0);
        const totalAbertoSel = lista.filter(f => (f.status !== 'paga'))
          .reduce((s, f) => s + toInt(f.valor_centavos), 0);

        const doc = {
          pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [40, 60, 40, 60],
          header: () => ({ margin: [40, 20, 40, 0], columns: [{ text: 'Sistema XM', style: 'brand' }, { text: `Emitido em ${hoje}`, alignment: 'right', style: 'meta' }] }),
          footer: (currentPage: number, pageCount: number) => ({ margin: [40, 0, 40, 20], columns: [{ text: 'www.seusistema.com', style: 'meta' }, { text: `Página ${currentPage} / ${pageCount}`, alignment: 'right', style: 'meta' }] }),
          content: [
            { text: title, style: 'title', margin: [0, 0, 0, 12] },
            { table: { headerRows: 1, widths: [50, 60, 150, 120, 80, 70, 60, 80], body },
              layout: { fillColor: (i: number) => (i === 0 ? '#4F46E5' : null), hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB',
                        paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 6, paddingBottom: () => 6 } },
            { margin: [0, 16, 0, 0], columns: [
              { text: `Total pago: ${formatCurrency(totalPagoSel)}`, style: 'total' },
              { text: `Total em aberto: ${formatCurrency(totalAbertoSel)}`, style: 'total', alignment: 'right' },
            ]},
            { text: 'Observação: valores em BRL.', style: 'note', margin: [0, 8, 0, 0] }
          ],
          styles: { brand: { fontSize: 10, bold: true, color: '#111827' }, meta: { fontSize: 9, color: '#6B7280' },
                    title: { fontSize: 16, bold: true, color: '#111827' }, th: { color: '#FFFFFF', bold: true, fontSize: 10 },
                    td: { fontSize: 9, color: '#111827' }, tdAlt: { fontSize: 9, color: '#111827', fillColor: '#F9FAFB' },
                    total: { bold: true, fontSize: 11, color: '#111827' }, note: { fontSize: 9, color: '#6B7280' } },
          defaultStyle: { fontSize: 9 }
        } as any;
        (pdfMake as any).createPdf(doc).download(`relatorio_${modoLista}_${periodoInicio}_${periodoFim}${matriculaFiltro ? `_mat_${matriculaFiltro}` : ''}.pdf`);
      } else if (modoLista === 'pagamentos') {
        const lista = pagamentos;
        body = [
          [{ text: 'Pago em', style: 'th' }, { text: 'Valor', style: 'th', alignment: 'right' },
           { text: 'Ref', style: 'th' }, { text: 'Matrícula', style: 'th' }, { text: 'Membro', style: 'th' }, { text: 'Plano', style: 'th' }],
          ...lista.map((p, idx) => ([
            { text: new Date(p.pago_em).toLocaleDateString('pt-BR'), style: idx % 2 ? 'tdAlt' : 'td' },
            { text: formatCurrency(p.valor_centavos), alignment: 'right', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: p.refer || '-', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: p.membro_matricula || '-', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: p.membro_nome || '-', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: p.plano_nome || '-', style: idx % 2 ? 'tdAlt' : 'td' },
          ]))
        ];
        const soma = lista.reduce((s, p) => s + toInt(p.valor_centavos), 0);

        const doc = {
          pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [40, 60, 40, 60],
          header: () => ({ margin: [40, 20, 40, 0], columns: [{ text: 'Sistema XM', style: 'brand' }, { text: `Emitido em ${hoje}`, alignment: 'right', style: 'meta' }] }),
          footer: (currentPage: number, pageCount: number) => ({ margin: [40, 0, 40, 20], columns: [{ text: 'www.seusistema.com', style: 'meta' }, { text: `Página ${currentPage} / ${pageCount}`, alignment: 'right', style: 'meta' }] }),
          content: [
            { text: title, style: 'title', margin: [0, 0, 0, 12] },
            { table: { headerRows: 1, widths: [80, 70, 70, 60, 70, 160, 120], body },
              layout: { fillColor: (i: number) => (i === 0 ? '#4F46E5' : null), hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB',
                        paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 6, paddingBottom: () => 6 } },
            { text: `Total de pagamentos: ${formatCurrency(soma)}`, style: 'total', margin: [0, 16, 0, 0] },
            { text: 'Observação: valores em BRL.', style: 'note', margin: [0, 8, 0, 0] }
          ],
          styles: { brand: { fontSize: 10, bold: true, color: '#111827' }, meta: { fontSize: 9, color: '#6B7280' },
                    title: { fontSize: 16, bold: true, color: '#111827' }, th: { color: '#FFFFFF', bold: true, fontSize: 10 },
                    td: { fontSize: 9, color: '#111827' }, tdAlt: { fontSize: 9, color: '#111827', fillColor: '#F9FAFB' },
                    total: { bold: true, fontSize: 11, color: '#111827' }, note: { fontSize: 9, color: '#6B7280' } },
          defaultStyle: { fontSize: 9 }
        } as any;
        (pdfMake as any).createPdf(doc).download(`relatorio_${modoLista}_${periodoInicio}_${periodoFim}${matriculaFiltro ? `_mat_${matriculaFiltro}` : ''}.pdf`);
      } else {
        // Diversos (com Membro)
        const lista = pagamentosDiversos;
        body = [
          [{ text: 'Data', style: 'th' }, { text: 'Tipo', style: 'th' }, { text: 'Descrição', style: 'th' },
           { text: 'Matrícula', style: 'th' }, { text: 'Membro', style: 'th' }, { text: 'Método', style: 'th' }, { text: 'Valor', style: 'th', alignment: 'right' }],
          ...lista.map((d, idx) => ([
            { text: new Date(d.data).toLocaleDateString('pt-BR'), style: idx % 2 ? 'tdAlt' : 'td' },
            { text: d.tipo || '-', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: d.descricao || '-', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: d.matricula || '-', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: d.membro_nome || '-', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: d.metodo || '-', style: idx % 2 ? 'tdAlt' : 'td' },
            { text: formatCurrency(d.valor_centavos), alignment: 'right', style: idx % 2 ? 'tdAlt' : 'td' },
          ]))
        ];
        const soma = lista.reduce((s, d) => s + toInt(d.valor_centavos), 0);

        const doc = {
          pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [40, 60, 40, 60],
          header: () => ({ margin: [40, 20, 40, 0], columns: [{ text: 'Sistema XM', style: 'brand' }, { text: `Emitido em ${hoje}`, alignment: 'right', style: 'meta' }] }),
          footer: (currentPage: number, pageCount: number) => ({ margin: [40, 0, 40, 20], columns: [{ text: 'www.seusistema.com', style: 'meta' }, { text: `Página ${currentPage} / ${pageCount}`, alignment: 'right', style: 'meta' }] }),
          content: [
            { text: title, style: 'title', margin: [0, 0, 0, 12] },
            { table: { headerRows: 1, widths: [70, 60, 150, 70, 120, 70, 70], body },
              layout: { fillColor: (i: number) => (i === 0 ? '#4F46E5' : null), hLineColor: () => '#E5E7EB', vLineColor: () => '#E5E7EB',
                        paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 6, paddingBottom: () => 6 } },
            { text: `Total de pagamentos diversos: ${formatCurrency(soma)}`, style: 'total', margin: [0, 16, 0, 0] },
            { text: 'Observação: valores em BRL.', style: 'note', margin: [0, 8, 0, 0] }
          ],
          styles: { brand: { fontSize: 10, bold: true, color: '#111827' }, meta: { fontSize: 9, color: '#6B7280' },
                    title: { fontSize: 16, bold: true, color: '#111827' }, th: { color: '#FFFFFF', bold: true, fontSize: 10 },
                    td: { fontSize: 9, color: '#111827' }, tdAlt: { fontSize: 9, color: '#111827', fillColor: '#F9FAFB' },
                    total: { bold: true, fontSize: 11, color: '#111827' }, note: { fontSize: 9, color: '#6B7280' } },
          defaultStyle: { fontSize: 9 }
        } as any;
        (pdfMake as any).createPdf(doc).download(`relatorio_${modoLista}_${periodoInicio}_${periodoFim}${matriculaFiltro ? `_mat_${matriculaFiltro}` : ''}.pdf`);
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Falha ao exportar PDF',
        description: err?.message ?? 'Verifique a dependência pdfmake.',
        variant: 'destructive',
      });
    }
  };

  /* ==================== UI ==================== */
  return (
    <DashboardLayout>
      <FeatureGate feature="relatorios" fallback={<UpgradeCard needed="Relatórios" />}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <FileBarChart className="h-8 w-8 text-primary" strokeWidth={1.75} />
                Relatórios
              </h1>
              <p className="text-muted-foreground">Análises financeiras e gestão de faturas/pagamentos</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={exportarXLSX}>
                <Download className="h-4 w-4 mr-2" strokeWidth={1.75} />
                Exportar XLSX
              </Button>
              <Button className="bg-gradient-sacred hover:opacity-90" onClick={exportarPDF}>
                <FileText className="h-4 w-4 mr-2" strokeWidth={1.75} />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-8 gap-3 md:gap-4 items-end">
                {/* Período de */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="periodo_inicio">Período de</Label>
                  <div className="relative">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80 pointer-events-none"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <Input
                      id="periodo_inicio"
                      type="date"
                      value={periodoInicio}
                      onChange={(e) => setPeriodoInicio(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* até */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="periodo_fim">até</Label>
                  <div className="relative">
                    <Calendar
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/80 pointer-events-none"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <Input
                      id="periodo_fim"
                      type="date"
                      value={periodoFim}
                      onChange={(e) => setPeriodoFim(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Matrícula (com autocomplete) */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="matricula_filtro">Matrícula (exata)</Label>
                  <Input
                    id="matricula_filtro"
                    list="matriculas_opts"
                    placeholder="Ex.: 2024-001"
                    value={matriculaFiltro}
                    onChange={(e) => setMatriculaFiltro(e.target.value)}
                  />
                  <datalist id="matriculas_opts">
                    {matOptions.map((m) => (
                      <option key={m.matricula} value={m.matricula}>
                        {m.nome ?? ''}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Relatório de */}
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="modo_lista">Relatório de</Label>
                  <Select value={modoLista} onValueChange={(v: any) => setModoLista(v)}>
                    <SelectTrigger id="modo_lista" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="faturas">Faturas</SelectItem>
                      <SelectItem value="pagamentos">Pagamentos (faturas)</SelectItem>
                      <SelectItem value="diversos">Pagamentos diversos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status (só faturas) */}
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="filtro_status">Status (faturas)</Label>
                  <Select value={filtroStatus} onValueChange={(v: any) => setFiltroStatus(v)} disabled={modoLista !== 'faturas'}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="aberta">Em aberto</SelectItem>
                      <SelectItem value="paga">Pagas</SelectItem>
                      <SelectItem value="vencida">Vencidas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ação */}
                <div className="space-y-2 md:col-span-1">
                  <Label>&nbsp;</Label>
                  <Button onClick={gerarRelatorio} disabled={loading} className="w-full">
                    <Filter className="h-4 w-4 mr-2" strokeWidth={1.75} />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo Financeiro */}
          {relatorioFinanceiro && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="bg-card/30 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" strokeWidth={1.75} />
                    Total Esperado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-secondary">
                    {formatCurrency(relatorioFinanceiro.total_esperado)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/30 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
                    Total Recebido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(relatorioFinanceiro.total_pago)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/30 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Receipt className="h-4 w-4" strokeWidth={1.75} />
                    Total em Aberto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {formatCurrency(relatorioFinanceiro.total_aberto)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/30 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Receipt className="h-4 w-4" strokeWidth={1.75} />
                    Taxa Inadimplência
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {relatorioFinanceiro.taxa_inadimplencia.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/30 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" strokeWidth={1.75} />
                    Faturas pagas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {relatorioFinanceiro.faturas_pagas}/{relatorioFinanceiro.total_faturas}
                  </div>
                  <p className="text-xs text-muted-foreground">No período (vencimento)</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabela principal */}
          <Card className="bg-card/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>
                {modoLista === 'diversos'
                  ? `${pagamentosDiversos.length} lançamento${pagamentosDiversos.length !== 1 ? 's' : ''} (pagamentos diversos)`
                  : modoLista === 'pagamentos'
                    ? `${pagamentos.length} pagamento${pagamentos.length !== 1 ? 's' : ''} encontrados`
                    : `${faturasFiltradas.length} fatura${faturasFiltradas.length !== 1 ? 's' : ''} encontrada${faturasFiltradas.length !== 1 ? 's' : ''}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                  ))}
                </div>
              ) : modoLista === 'pagamentos' ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Pago em</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Membro</TableHead>
                      <TableHead>Plano</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentos.map((p) => (
                      <TableRow key={p.id} className="border-border/50">
                        <TableCell>{new Date(p.pago_em).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="font-semibold text-secondary">{formatCurrency(p.valor_centavos)}</TableCell>
                        <TableCell className="font-mono">{p.refer || '-'}</TableCell>
                        <TableCell className="font-mono">{p.membro_matricula || '-'}</TableCell>
                        <TableCell className="font-medium">{p.membro_nome || '-'}</TableCell>
                        <TableCell>{p.plano_nome || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : modoLista === 'diversos' ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Membro</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentosDiversos.map((d) => (
                      <TableRow key={d.id} className="border-border/50">
                        <TableCell>{new Date(d.data).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="capitalize">{d.tipo || '-'}</TableCell>
                        <TableCell className="max-w-[280px] truncate" title={d.descricao || ''}>{d.descricao || '-'}</TableCell>
                        <TableCell className="font-mono">{d.matricula || '-'}</TableCell>
                        <TableCell className="font-medium">{d.membro_nome || '-'}</TableCell>
                        <TableCell className="capitalize">{d.metodo || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(d.valor_centavos)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Ref</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Membro</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pago em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faturasFiltradas.map((fatura) => (
                      <TableRow key={fatura.id} className="border-border/50">
                        <TableCell className="font-mono">{fatura.refer}</TableCell>
                        <TableCell className="font-mono">{fatura.membro_matricula || '-'}</TableCell>
                        <TableCell className="font-medium">{fatura.membro_nome}</TableCell>
                        <TableCell>{fatura.plano_nome}</TableCell>
                        <TableCell>{fatura.dt_vencimento ? new Date(fatura.dt_vencimento).toLocaleDateString('pt-BR') : '-'}</TableCell>
                        <TableCell className="font-semibold text-secondary">{formatCurrency(fatura.valor_centavos)}</TableCell>
                        <TableCell>{getStatusBadge(fatura.status)}</TableCell>
                        <TableCell>{fatura.dt_pagamento ? new Date(fatura.dt_pagamento).toLocaleDateString('pt-BR') : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!loading && modoLista === 'faturas' && faturasFiltradas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileBarChart className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhuma fatura encontrada para o filtro</p>
                </div>
              )}

              {!loading && modoLista === 'pagamentos' && pagamentos.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhum pagamento encontrado para o filtro</p>
                </div>
              )}

              {!loading && modoLista === 'diversos' && pagamentosDiversos.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <HandCoins className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhum pagamento diverso encontrado para o filtro</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
