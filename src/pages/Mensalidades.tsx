// src/pages/Mensalidades.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Search,
  Wallet,
  CheckSquare,
  FileText,
  RotateCcw
} from 'lucide-react';
import FeatureGate from "@/components/FeatureGate";
import UpgradeCard from "@/components/UpgradeCard";
// AlertDialog (padrão shadcn) para confirmação de reembolso
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

type UIStatus = 'aberta' | 'atrasada' | 'paga';

interface MensalidadeRow {
  id: string;
  membro_id: string;
  membro_nome: string;
  membro_matricula?: string | null;
  refer: string;                  // 'YYYYMM'
  dt_vencimento: string;          // ISO
  valor_centavos: number;
  vl_desconto_centavos: number;
  total_a_pagar_centavos: number; // valor - desconto
  status_db: 'pendente' | 'vencida' | 'paga';
  ui_status: UIStatus;
  forma_pagamento?: string | null;
  dt_pagamento?: string | null;
}

type PayPreset = 'dinheiro' | 'pix' | 'cartao' | 'transferencia' | 'outro';

export default function Mensalidades() {
  
  const { toast } = useToast();
  const { profile, user } = useAuth();

  // se viewer, restringe a si mesmo
  const isViewer = (profile?.role === 'viewer');
  const myMembroId = (profile as any)?.membro_id ?? null;

  const [rows, setRows] = useState<MensalidadeRow[]>([]);
  const [loading, setLoading] = useState(false);

  // mensagem quando viewer não tem vínculo com membro
  const [noLinkMsg, setNoLinkMsg] = useState<string | null>(null);

  // dados da org para o cupom
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgNome, setOrgNome] = useState<string>('');
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgEndereco, setOrgEndereco] = useState<string>('');
  const [orgContato, setOrgContato] = useState<string>('');
  const [orgCnpj, setOrgCnpj] = useState<string>('');
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  // busca por nome OU matrícula (somente para não-viewer)
  const [consulta, setConsulta] = useState(''); // nome ou matrícula

  // membro atualmente em tela (para ambos os modos)
  const [membroId, setMembroId] = useState<string | null>(null);
  const [membroNome, setMembroNome] = useState<string>('');
  const [membroMatricula, setMembroMatricula] = useState<string>('');

  // filtros locais (status)
  type StatusFilter = 'all' | 'aberta' | 'atrasada' | 'paga' | 'all_with_paid';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // seleção
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // pagamento
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payPreset, setPayPreset] = useState<PayPreset>('dinheiro');
  const [customMethod, setCustomMethod] = useState('');
  const [paying, setPaying] = useState(false);

  // pós-pagamento → cupom fiscal
  const [askReceiptOpen, setAskReceiptOpen] = useState(false);
  const [lastPaidSnapshot, setLastPaidSnapshot] = useState<MensalidadeRow[]>([]);

  // refund
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<MensalidadeRow | null>(null);

  // força PIX quando viewer
  useEffect(() => {
    if (isViewer) setPayPreset('pix');
  }, [isViewer]);

  // bootstrap (pega org e, se viewer, já carrega as próprias faturas)
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setNoLinkMsg(null);

        if (!user) { setLoading(false); return; }

        const { data: profileRow, error: profErr } = await supabase
          .from('profiles')
          .select('org_id, membro_id')
          .eq('user_id', user.id)
          .single();
        if (profErr) throw profErr;

        const oid = (profileRow as any)?.org_id ?? null;
        setOrgId(oid);

        if (oid) {
          const { data: terr, error: terrErr } = await supabase
            .from('terreiros')
            .select('nome, cnpj, logo_url, endereco, bairro, cidade, estado, cep, telefone, whatsapp, email, site')
            .eq('id', oid)
            .maybeSingle();
          if (!terrErr && terr) {
            setOrgNome((terr as any)?.nome ?? '');
            setOrgCnpj((terr as any)?.cnpj ?? '');
            setOrgLogo((terr as any)?.logo_url ?? null);
            const enderecoFmt = [
              (terr as any)?.endereco,
              (terr as any)?.bairro,
              (terr as any)?.cidade && (terr as any)?.estado ? `${(terr as any)?.cidade}/${(terr as any)?.estado}` : ((terr as any)?.cidade || (terr as any)?.estado),
              (terr as any)?.cep
            ].filter(Boolean).join(' • ');
            setOrgEndereco(enderecoFmt);
            const contatoFmt = [(terr as any)?.telefone, (terr as any)?.whatsapp, (terr as any)?.email, (terr as any)?.site].filter(Boolean).join(' • ');
            setOrgContato(contatoFmt);
          } else {
            setOrgNome('');
            setOrgCnpj('');
          }
        }

        // modo viewer: carrega automaticamente o próprio membro
        if (isViewer) {
          const linked = (profileRow as any)?.membro_id || myMembroId;
          if (!linked) {
            setRows([]);
            setMembroId(null);
            setNoLinkMsg('Seu usuário não está vinculado a um cadastro de membro. Peça ao responsável para vincular seu perfil a um membro.');
            return;
          }
          await carregarPorMembroId(linked);
        }
      } catch (e: any) {
        console.error(e);
        toast({
          title: 'Erro ao iniciar',
          description: e?.message ?? 'Tente novamente',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, myMembroId, user?.id]);

  const formatCurrency = (centavos: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, centavos) / 100);

  const uiBadge = (s: UIStatus) => {
    if (s === 'paga') return <Badge className="bg-green-600 text-white hover:bg-green-700">Paga</Badge>;
    return (
      <Badge variant={s === 'aberta' ? 'secondary' : 'destructive'}>
        {s === 'aberta' ? 'Aberta' : 'Atrasada'}
      </Badge>
    );
  };

  // ========= BUSCA E MAPEAMENTO =========
  const mapFaturas = (data: any[]): MensalidadeRow[] => {
    return (data ?? []).map((f: any) => {
      const ui_status: UIStatus =
        f.status === 'paga' ? 'paga' : f.status === 'vencida' ? 'atrasada' : 'aberta';
      const desconto = f.vl_desconto_centavos ?? 0;
      return {
        id: f.id,
        membro_id: f.membros?.id ?? '',
        membro_nome: f.membros?.nome ?? 'N/A',
        membro_matricula: f.membros?.matricula ?? null,
        refer: f.refer,
        dt_vencimento: f.dt_vencimento,
        valor_centavos: f.valor_centavos,
        vl_desconto_centavos: desconto,
        total_a_pagar_centavos: Math.max(0, (f.valor_centavos ?? 0) - desconto),
        status_db: f.status,
        ui_status,
        forma_pagamento: f.forma_pagamento ?? null,
        dt_pagamento: f.dt_pagamento ?? null,
      };
    });
  };

    const carregarPorMembroId = async (idMembro: string) => {
    try {
      setLoading(true);
      setBlockedMsg(null);            // zera qualquer bloqueio anterior
      setRows([]);
      setSelectedIds(new Set());
      setSelectAll(false);

      // 1) dados do membro
      const { data: m, error: em } = await supabase
        .from('membros')
        .select('id, nome, matricula')
        .eq('id', idMembro)
        .maybeSingle();
      if (em) throw em;
      if (!m) {
        toast({ title: 'Membro não encontrado' });
        return;
      }
      setMembroId(m.id);
      setMembroNome(m.nome ?? '');
      setMembroMatricula(m.matricula ?? '');

      // 2) checar status de assinaturas do membro
      const { data: subs, error: subErr } = await supabase
        .from('assinaturas')
        .select('status')
        .eq('membro_id', idMembro)
        .order('created_at', { ascending: false });
      if (subErr) throw subErr;

      const hasActive = (subs ?? []).some(s => s.status === 'ativa');
      const hasPaused = (subs ?? []).some(s => s.status === 'pausada');

      // Regra: se NÃO há ativa e há pausada → bloquear com mensagem
      if (!hasActive && hasPaused) {
        setRows([]);
        setBlockedMsg('Assinatura pausada');
        return; // não busca faturas
      }

      // 3) faturas (somente as que estão "abertas" pela sua regra)
      const { data, error } = await supabase
        .from('faturas')
        .select(`
          id,
          refer,
          dt_vencimento,
          valor_centavos,
          vl_desconto_centavos,
          status,
          forma_pagamento,
          dt_pagamento,
          membros:membro_id ( id, nome, matricula, ativo ),
          assinaturas:assinatura_id ( status )
        `)
        .eq('membro_id', idMembro)
        .eq('status', 'pendente')            // só faturas pendentes
        .eq('assinaturas.status', 'ativa')   // assinatura precisa estar ativa
        .eq('membros.ativo', true)           // membro precisa estar ativo
        .order('dt_vencimento', { ascending: true });
      if (error) throw error;

      setRows(mapFaturas(data ?? []));
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro ao carregar mensalidades',
        description: err?.message ?? 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // buscar por nome OU matrícula (para não-viewer)
  const buscar = async () => {
    try {
      setRows([]);
      setSelectedIds(new Set());
      setSelectAll(false);
      setMembroId(null);
      setMembroNome('');
      setMembroMatricula('');

      if (isViewer) {
        if (!myMembroId) {
          toast({ title: 'Seu usuário não está vinculado a um membro.' });
          return;
        }
        await carregarPorMembroId(myMembroId);
        return;
      }

      const term = consulta.trim();
      if (!term) {
        toast({ title: 'Informe nome ou matrícula', variant: 'destructive' });
        return;
      }
      setLoading(true);

      const pareceMatricula = /[0-9]/.test(term);
      let membro: any = null;

      if (pareceMatricula) {
        const { data: m1, error: e1 } = await supabase
          .from('membros')
          .select('id, nome, matricula, org_id, terreiro_id')
          .eq('matricula', term)
          .or(orgId ? `org_id.eq.${orgId},terreiro_id.eq.${orgId}` : 'org_id.is.null')
          .maybeSingle();
        if (e1) throw e1;
        if (m1) membro = m1;
      }

      if (!membro) {
        const { data: mList, error: e2 } = await supabase
          .from('membros')
          .select('id, nome, matricula, org_id, terreiro_id')
          .ilike('nome', `%${term}%`)
          .or(orgId ? `org_id.eq.${orgId},terreiro_id.eq.${orgId}` : 'org_id.is.null')
          .limit(2);
        if (e2) throw e2;
        if (!mList || mList.length === 0) {
          toast({ title: 'Membro não encontrado', description: `Nenhum resultado para “${term}”.` });
          setLoading(false);
          return;
        }
        if (mList.length > 1) {
          toast({
            title: 'Vários resultados',
            description: 'Refine a busca (digite a matrícula completa ou o nome completo).',
          });
          setLoading(false);
          return;
        }
        membro = mList[0];
      }

      await carregarPorMembroId(membro.id);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro ao buscar mensalidades',
        description: err?.message ?? 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  // filtros locais
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === 'all') return r.ui_status !== 'paga'; // abertas + atrasadas
      if (statusFilter === 'all_with_paid') return true;          // todas
      return r.ui_status === statusFilter;
    });
  }, [rows, statusFilter]);

  // seleção — recalcula APENAS quando selectAll muda
  useEffect(() => {
    if (selectAll) {
      setSelectedIds(new Set(filtered.filter((r) => r.ui_status !== 'paga').map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectAll]);

  const toggleRow = (id: string, checked: boolean, disabled = false) => {
    if (disabled) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const totalSelecionado = useMemo(() => {
    const map = new Map(rows.map((r) => [r.id, r]));
    let soma = 0;
    for (const id of selectedIds) {
      const row = map.get(id);
      if (row) soma += row.total_a_pagar_centavos;
    }
    return soma;
  }, [rows, selectedIds]);

  // abrir diálogo de pagamento
  const confirmarPagamentoSelecionadas = () => {
    if (selectedIds.size === 0) {
      toast({ title: 'Nada selecionado', description: 'Selecione ao menos uma mensalidade.' });
      return;
    }
    setDialogOpen(true);
  };

  const chosenMethod = ((): string => {
    if (isViewer) return 'pix';
    return payPreset === 'outro' ? (customMethod.trim() || 'Outro') : payPreset;
  })();

  const pagarSelecionadas = async () => {
    try {
      setPaying(true);

      const selected = rows.filter((r) => selectedIds.has(r.id));
      if (selected.length === 0) throw new Error('Nenhuma mensalidade selecionada');

      const metodo = chosenMethod;
      const agoraISO = new Date().toISOString();

      // snapshot para o cupom ANTES de atualizar/recaregar
      setLastPaidSnapshot(selected);

      // 1) inserir pagamentos (um por fatura)
      const pagamentos = selected.map((r) => ({
        fatura_id: r.id,
        valor_centavos: r.total_a_pagar_centavos,
        metodo,
      }));

      const { error: insErr } = await supabase.from('pagamentos').insert(pagamentos);
      if (insErr) throw insErr;

      // 2) atualizar faturas para 'paga'
      const { error: updErr } = await supabase
        .from('faturas')
        .update({
          status: 'paga',
          dt_pagamento: agoraISO,
          vl_pago_centavos: 0,
          forma_pagamento: metodo,
        })
        .in('id', selected.map((s) => s.id));
      if (updErr) throw updErr;

      toast({
        title: 'Pagamento registrado',
        description: `${selected.length} mensalidade(s) marcada(s) como paga(s).`,
      });

      setDialogOpen(false);
      setAskReceiptOpen(true); // pergunta estilo modal

      // limpa seleção e recarrega lista do membro atual
      setSelectedIds(new Set());
      setSelectAll(false);
      if (membroId) await carregarPorMembroId(membroId);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Erro ao registrar pagamento',
        description: err?.message ?? 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setPaying(false);
    }
  };

  // ===== Helpers de cupom (80mm) =====
  const abrirJanelaCupom = (html: string) => {
    const w = window.open('', '_blank', 'width=420,height=600');
    if (!w) {
      toast({ title: 'Bloqueado pelo navegador', description: 'Permita pop-ups para imprimir o cupom.' });
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const gerarCupomHTML = (itens: MensalidadeRow[], metodo: string, pagoEm?: string | null) => {
    const dataHoraImpressao = new Date().toLocaleString('pt-BR');

    const linhas = itens.map((r) => {
      const valor = formatCurrency(r.total_a_pagar_centavos);
      const ref = r.refer;
      const venc = new Date(r.dt_vencimento).toLocaleDateString('pt-BR');
      const mat = r.membro_matricula ?? '-';
      return `<tr>
          <td>${ref}</td><td>${venc}</td><td>${mat}</td><td style="text-align:right">${valor}</td>
        </tr>`;
    }).join('');

    const total = formatCurrency(itens.reduce((acc, i) => acc + i.total_a_pagar_centavos, 0));

    const linhaPagoEm = pagoEm
      ? `<div class="muted">Pago em: ${new Date(pagoEm).toLocaleString('pt-BR')}</div>`
      : '';

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Cupom Fiscal</title>
<style>
  @page { size: 80mm auto; margin: 6mm; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  .wrap { width: 80mm; max-width: 80mm; }
  .center { text-align: center; }
  .logo { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; margin-bottom: 4px; }
  .title { font-weight: 700; margin: 6px 0; }
  .muted { color: #444; font-size: 10px; line-height: 1.2; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0; }
  th, td { padding: 4px 0; border-bottom: 1px dashed #999; }
  th { text-align: left; }
  .tot { border-top: 1px dashed #999; padding-top: 6px; margin-top: 4px; font-weight: 700; }
  .foot { border-top: 1px dashed #999; margin-top: 8px; padding-top: 6px; font-size: 10px; text-align: center; }
</style>
</head>
<body onload="window.print(); setTimeout(() => window.close(), 500)">
  <div class="wrap">
    <div class="center">
      ${orgLogo ? `<img src="${orgLogo}" class="logo" />` : ''}
      <div class="title">${orgNome || 'Comprovante'}</div>
      <div class="muted">
        ${orgCnpj ? `CNPJ: ${orgCnpj}<br/>` : ''}
        ${orgEndereco || ''}${orgContato ? `<br/>${orgContato}` : ''}
      </div>
    </div>

    <div class="muted" style="margin-top:6px">Impresso em: ${dataHoraImpressao}</div>
    <div class="muted">Método: ${metodo || '-'}</div>
    <div class="muted">Membro: ${membroNome} • Matrícula: ${membroMatricula || '-'}</div>
    ${linhaPagoEm}

    <table>
      <thead>
        <tr><th>Ref</th><th>Venc</th><th>Mat</th><th style="text-align:right">Valor</th></tr>
      </thead>
      <tbody>
        ${linhas}
      </tbody>
    </table>

    <div class="tot">Total pago: ${total}</div>
    <div class="foot">Obrigado pela contribuição.<br/>Este documento não substitui NF-e.</div>
  </div>
</body>
</html>`;
  };

  // CUPOM após novo pagamento (lote)
  const imprimirCupom = () => {
    try {
      setAskReceiptOpen(false);
      const itens = lastPaidSnapshot;
      if (!itens?.length) {
        toast({ title: 'Nada para imprimir' });
        return;
      }
      const html = gerarCupomHTML(itens, chosenMethod, new Date().toISOString());
      abrirJanelaCupom(html);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao imprimir cupom', description: e?.message ?? 'Tente novamente', variant: 'destructive' });
    }
  };

  // REIMPRIMIR cupom de uma fatura já paga
  const reimprimirCupom = (row: MensalidadeRow) => {
    try {
      const html = gerarCupomHTML([row], row.forma_pagamento || '-', row.dt_pagamento || undefined);
      abrirJanelaCupom(html);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao imprimir cupom', description: e?.message ?? 'Tente novamente', variant: 'destructive' });
    }
  };

  // ===== Reembolso (UI + ação) =====
  const pedirReembolso = (row: MensalidadeRow) => {
    if (isViewer) return; // segurança
    setRefundTarget(row);
    setRefundDialogOpen(true);
  };

  const confirmarReembolso = async () => {
    if (!refundTarget) return;
    const row = refundTarget;

    try {
      setRefundingId(row.id);

      // 1) Apaga pagamentos da fatura
      const { error: delErr } = await supabase
        .from('pagamentos')
        .delete()
        .eq('fatura_id', row.id);
      if (delErr) throw delErr;

      // 2) Reabre a fatura (pendente/vencida de acordo com o vencimento)
      const vencida =
        new Date(row.dt_vencimento).getTime() < new Date().getTime() ? 'vencida' : 'pendente';

      const { error: updErr } = await supabase
        .from('faturas')
        .update({
          status: vencida,
          dt_pagamento: null,
          forma_pagamento: null,
          vl_pago_centavos: null
        })
        .eq('id', row.id);
      if (updErr) throw updErr;

      toast({
        title: 'Reembolso concluído',
        description: `Fatura ${row.refer} reaberta como ${vencida}.`,
      });

      setRefundDialogOpen(false);
      setRefundTarget(null);
      if (membroId) await carregarPorMembroId(membroId);
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erro ao reembolsar',
        description: e?.message ?? 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setRefundingId(null);
    }
  };

  return (
    <DashboardLayout>
      <FeatureGate feature="mensalidades" fallback={<UpgradeCard needed="Mensalidades" />}>
        {/* 6) Garantir que o conteúdo da página fique por trás da navbar fixa */}
        {/* Se sua navbar do DashboardLayout usa z-50, este wrapper com z-0 resolve a sobreposição durante o scroll */}
        <div className="space-y-6 relative z-0">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Wallet className="h-8 w-8 text-primary" />
                Mensalidades
              </h1>
              {isViewer ? (
                <p className="text-muted-foreground">
                  Aqui você vê e quita <strong>apenas as suas</strong> mensalidades (pagamento via <strong>PIX</strong>).
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Informe <strong>nome</strong> ou <strong>matrícula</strong> para visualizar as mensalidades
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => (membroId ? carregarPorMembroId(membroId) : buscar())}
                className="hover:opacity-90"
                title="Recarregar lista"
              >
                Recarregar
              </Button>
              <Button
                onClick={confirmarPagamentoSelecionadas}
                disabled={selectedIds.size === 0}
                className="bg-gradient-sacred hover:opacity-90"
                title="Pagar mensalidades selecionadas"
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Pagar selecionadas
              </Button>
            </div>
          </div>

          {/* Pesquisa (escondida para viewer) */}
          {!isViewer && (
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      {/* Form simples para evitar submit global e parar propagação de teclas */}
                      <form
                        onSubmit={(e) => { e.preventDefault(); buscar(); }}
                      >
                        <Input
                          placeholder="Nome completo ou matrícula (ex.: 2024-001)"
                          value={consulta}
                          onChange={(e) => setConsulta(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              buscar();
                            }
                            e.stopPropagation();
                          }}
                          autoComplete="off"
                          className="pl-10"
                        />
                      </form>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={buscar}>Buscar</Button>
                    <Select
                      value={statusFilter}
                      onValueChange={(v: StatusFilter) => setStatusFilter(v)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="all">Abertas + Atrasadas</SelectItem>
                        <SelectItem value="aberta">Somente Abertas</SelectItem>
                        <SelectItem value="atrasada">Somente Atrasadas</SelectItem>
                        <SelectItem value="paga">Somente Pagas</SelectItem>
                        <SelectItem value="all_with_paid">Todas (inclui Pagas)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {membroId && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    Membro: <span className="font-medium text-foreground">{membroNome}</span> • Matrícula: <span className="font-mono">{membroMatricula || '-'}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Filtro de status (mostrar também para viewer) */}
          {isViewer && (
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <Select
                    value={statusFilter}
                    onValueChange={(v: StatusFilter) => setStatusFilter(v)}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="all">Abertas + Atrasadas</SelectItem>
                      <SelectItem value="aberta">Somente Abertas</SelectItem>
                      <SelectItem value="atrasada">Somente Atrasadas</SelectItem>
                      <SelectItem value="paga">Somente Pagas</SelectItem>
                      <SelectItem value="all_with_paid">Todas (inclui Pagas)</SelectItem>
                    </SelectContent>
                  </Select>
                  {membroId && (
                    <div className="self-center text-sm text-muted-foreground">
                      Membro: <span className="font-medium text-foreground">{membroNome}</span> • Matrícula: <span className="font-mono">{membroMatricula || '-'}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela / Estado inicial */}
          {membroId ? (
            <Card className="bg-card/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>
                  {filtered.length} mensalidade{filtered.length !== 1 ? 's' : ''} encontrada
                  {filtered.length !== 1 ? 's' : ''}
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
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={(c) => setSelectAll(Boolean(c))}
                          id="selectAll"
                        />
                        <label htmlFor="selectAll" className="text-sm text-muted-foreground cursor-pointer">
                          Selecionar todas filtradas (apenas não pagas) ({filtered.filter(f => f.ui_status !== 'paga').length})
                        </label>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total selecionado:{' '}
                        <span className="font-semibold">
                          {formatCurrency(totalSelecionado)}
                        </span>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/50">
                          <TableHead></TableHead>
                          <TableHead>Referência</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[220px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((r) => {
                          const isPaid = r.ui_status === 'paga';
                          return (
                            <TableRow key={r.id} className="border-border/50">
                              <TableCell className="w-10">
                                <Checkbox
                                  checked={selectedIds.has(r.id)}
                                  onCheckedChange={(c) => toggleRow(r.id, Boolean(c), isPaid)}
                                  aria-label="Selecionar mensalidade"
                                  disabled={isPaid}
                                />
                              </TableCell>
                              <TableCell className="font-mono">{r.refer}</TableCell>
                              <TableCell>{new Date(r.dt_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                              <TableCell className="font-semibold">
                                {formatCurrency(r.total_a_pagar_centavos)}
                                {r.vl_desconto_centavos > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    ({formatCurrency(r.valor_centavos)} - desc {formatCurrency(r.vl_desconto_centavos)})
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>{uiBadge(r.ui_status)}</TableCell>
                              <TableCell className="space-x-2">
                                {isPaid ? (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-2 rounded-full h-9 px-3"
                                      onClick={() => reimprimirCupom(r)}
                                      title="Reimprimir cupom"
                                    >
                                      <FileText className="h-4 w-4" />
                                      Reimprimir
                                    </Button>

                                    {!isViewer && (
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="gap-2 rounded-full h-9 px-3 shadow-sm"
                                        onClick={() => pedirReembolso(r)}
                                        disabled={refundingId === r.id}
                                        title="Reembolsar (remover pagamentos e reabrir fatura)"
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                        {refundingId === r.id ? 'Reembolsando...' : 'Reembolsar'}
                                      </Button>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </>
                )}

                {!loading && filtered.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>{blockedMsg ?? 'Nenhuma mensalidade encontrada'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/30 backdrop-blur-sm">
              <CardContent className="py-10 text-center text-muted-foreground">
                {isViewer ? (
                  noLinkMsg
                    ? <span>{noLinkMsg}</span>
                    : (loading ? 'Carregando suas mensalidades…' : 'Sem dados para exibir.')
                ) : (
                  <>Digite <strong>nome</strong> ou <strong>matrícula</strong> e clique em <strong>Buscar</strong> para listar as mensalidades.</>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dialog pagamento em lote */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Confirmar pagamento</DialogTitle>
                <DialogDescription>
                  {selectedIds.size} mensalidade(s) serão marcadas como pagas. O valor será o total de cada mensalidade (valor - desconto).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Forma de pagamento</span>

                  {/* Viewer: método travado em PIX */}
                  {isViewer ? (
                    <div className="p-2 rounded border text-sm">
                      PIX (fixo para seu perfil)
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select
                        value={payPreset}
                        onValueChange={(v: PayPreset) => setPayPreset(v)}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="cartao">Cartão</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                          <SelectItem value="outro">Outro (especificar)</SelectItem>
                        </SelectContent>
                      </Select>

                      {payPreset === 'outro' && (
                        <Input
                          placeholder="Descreva o método (ex.: Cheque, Boleto, VA...)"
                          value={customMethod}
                          onChange={(e) => setCustomMethod(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault();
                            e.stopPropagation();
                          }}
                        />
                      )}
                    </div>
                  )}

                  {!isViewer && payPreset === 'outro' && !customMethod.trim() && (
                    <p className="text-xs text-muted-foreground">Informe o método personalizado.</p>
                  )}
                </div>

                <div className="p-3 rounded bg-muted/30 text-sm flex items-center justify-between">
                  <span>Total a quitar</span>
                  <span className="font-semibold">{formatCurrency(totalSelecionado)}</span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={pagarSelecionadas}
                    disabled={paying || (!isViewer && (payPreset === 'outro' && !customMethod.trim()))}
                    className="bg-gradient-sacred hover:opacity-90"
                  >
                    {paying ? 'Processando...' : 'Confirmar pagamento'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Pergunta: imprimir cupom fiscal? */}
          <Dialog open={askReceiptOpen} onOpenChange={setAskReceiptOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Imprimir cupom fiscal?</DialogTitle>
                <DialogDescription>
                  Deseja gerar o cupom fiscal do(s) pagamento(s) registrado(s)?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAskReceiptOpen(false)}>
                  Não agora
                </Button>
                <Button onClick={imprimirCupom} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Gerar cupom
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Pop-up de confirmação de reembolso */}
          <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar reembolso</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai <strong>remover todos os pagamentos</strong> registrados para esta fatura
                  e reabri-la como <em>pendente</em> (ou <em>vencida</em> se o vencimento já passou).
                  <br />
                  <br />
                  <span className="text-foreground">
                    <span className="font-medium">Referência:</span>{' '}
                    <span className="font-mono">{refundTarget?.refer}</span>
                  </span>
                  <br />
                  <span className="text-foreground">
                    <span className="font-medium">Valor:</span>{' '}
                    {refundTarget ? formatCurrency(refundTarget.total_a_pagar_centavos) : '—'}
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmarReembolso}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-full gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Confirmar reembolso
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </FeatureGate>  
    </DashboardLayout>
  );
}
