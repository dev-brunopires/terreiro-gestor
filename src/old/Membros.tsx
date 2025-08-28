import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Edit, Trash2, Users, FileBadge2, Flower2, UserPlus2 } from 'lucide-react';

/* shadcn/ui Select */
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

/* Tabs */
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';

/* Dropdown (para promover a usuário com escolha de papel) */
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ----------------------- Tipos -----------------------

type TipoPessoa = 'PF' | 'PJ';

type Role = 'viewer' | 'operador' | 'financeiro' | 'admin' | 'owner';

interface Membro {
  id: string;
  // org atual (substitui terreiro_id no schema novo)
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
  observacoes?: any | null; // jsonb no novo schema
  created_at: string;
  updated_at?: string | null;

  // novos campos alinhados ao schema
  cidade?: string | null;
  uf?: string | null;
  numero?: string | null;
  complemento?: string | null;
  profissao?: string | null;

  // jsonb
  espiritual_umbanda?: any | null;
  espiritual_candomble?: any | null;
  docs?: any | null;
  tipo_pessoa?: TipoPessoa | null;
}

interface Terreiro {
  id: string;
  nome: string;
}

interface Plano {
  id: string;
  nome: string;
  valor_centavos: number;
  dia_vencimento: number;
  ativo: boolean;
  terreiro_id: string;
  org_id?: string | null;
}

/** ---------- FIX: componente estável fora do componente principal ---------- */
function TextGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}
/** ------------------------------------------------------------------------ */

export default function Membros() {
  const { toast } = useToast();

  // SEMPRE id da tabela public.terreiros (org)
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgNome, setOrgNome] = useState<string>('');

  const [terreiros, setTerreiros] = useState<Terreiro[]>([]);
  const [selectedTerreiroId, setSelectedTerreiroId] = useState<string>(''); // usado no form (= org_id)

  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMembro, setEditingMembro] = useState<Membro | null>(null);

  const [tab, setTab] = useState('principal');

  const [formData, setFormData] = useState({
    nome: '',
    matricula: '',
    dt_nascimento: '',
    telefone: '',
    email: '',
    endereco: '',
    bairro: '',
    cep: '',
    cidade: '',
    uf: '',
    numero: '',
    complemento: '',
    profissao: '',
    data_admissao_terreiro: '',
    ativo: true,
    observacoes: '', // string no form; salvo como jsonb no payload
    tipo_pessoa: 'PF' as TipoPessoa,
    // documentação
    docs_pf: {
      cpf: '',
      rg: '',
      orgao_emissor: '',
      dt_emissao: '',
    },
    docs_pj: {
      razao_social: '',
      cnpj: '',
      ie: '',
      im: '',
    },
    // espiritual (Umbanda)
    umbanda: {
      orixas: ['', '', '', ''],
      pretoVelho: ['', ''],
      exu: ['', ''],
      pombaGira: ['', ''],
      caboclo: ['', ''],
      ere: ['', ''],
      outros: '',
    },
    // espiritual (Candomblé)
    candomble: {
      orixas: [
        { nome: '', qualidade: '' },
        { nome: '', qualidade: '' },
        { nome: '', qualidade: '' },
        { nome: '', qualidade: '' },
      ],
      obrigacoes: [
        { nome: '', data: '' },
        { nome: '', data: '' },
        { nome: '', data: '' },
        { nome: '', data: '' },
      ],
    },
  });

  // Planos
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [selectedPlanoId, setSelectedPlanoId] = useState<string>(''); // plano escolhido no form

  // (NOVO) opções para criar login imediatamente
  const [criarLoginAgora, setCriarLoginAgora] = useState(false);
  const [roleNovoUsuario, setRoleNovoUsuario] = useState<Role>('viewer');

  // -------- helpers ----------
  const normalize = (v: string) => (v?.trim() ? v.trim() : null);
  const normalizeDate = (v: string) => (v ? v : null);

  const buildPayload = (finalOrgId: string) => ({
    org_id: finalOrgId, // <-- novo: membros.org_id
    nome: formData.nome.trim(),
    matricula: normalize(formData.matricula),
    dt_nascimento: normalizeDate(formData.dt_nascimento),
    telefone: normalize(formData.telefone),
    email: normalize(formData.email),
    endereco: normalize(formData.endereco),
    bairro: normalize(formData.bairro),
    cep: normalize(formData.cep),
    cidade: normalize(formData.cidade || ''),
    uf: normalize(formData.uf || ''),
    numero: normalize(formData.numero || ''),
    complemento: normalize(formData.complemento || ''),
    profissao: normalize(formData.profissao || ''),
    data_admissao_terreiro: normalizeDate(formData.data_admissao_terreiro),
    ativo: formData.ativo,
    // observacoes virou jsonb
    observacoes: formData.observacoes?.trim()
      ? { texto: formData.observacoes.trim() }
      : null,
    tipo_pessoa: formData.tipo_pessoa,
    docs:
      formData.tipo_pessoa === 'PF'
        ? { tipo: 'PF', ...formData.docs_pf }
        : { tipo: 'PJ', ...formData.docs_pj },
    espiritual_umbanda: {
      orixas: (formData.umbanda.orixas || []).filter(Boolean),
      pretoVelho: (formData.umbanda.pretoVelho || []).filter(Boolean),
      exu: (formData.umbanda.exu || []).filter(Boolean),
      pombaGira: (formData.umbanda.pombaGira || []).filter(Boolean),
      caboclo: (formData.umbanda.caboclo || []).filter(Boolean),
      ere: (formData.umbanda.ere || []).filter(Boolean),
      outros: normalize(formData.umbanda.outros || ''),
    },
    espiritual_candomble: {
      orixas: (formData.candomble.orixas || [])
        .map((o) => (o?.nome ? { nome: o.nome, qualidade: o.qualidade || null } : null))
        .filter(Boolean),
      obrigacoes: (formData.candomble.obrigacoes || [])
        .map((o) => (o?.nome ? { nome: o.nome, data: o.data || null } : null))
        .filter(Boolean),
    },
  });

  // garante que teremos um terreiro existente (pega do profile; senão, RPC cria/reutiliza)
  const ensureValidOrgId = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    let org = (profile as any)?.org_id ?? null;

    const exists = async (id: string | null) => {
      if (!id) return false;
      const { data } = await supabase.from('terreiros').select('id,nome').eq('id', id).maybeSingle();
      if (data?.nome) setOrgNome(data.nome);
      return !!data;
    };

    if (!(await exists(org))) {
      const { data: ensured, error: rpcErr } = await supabase.rpc('ensure_default_org', {
        p_nome: 'Xango Menino',
      });
      if (rpcErr || !ensured) {
        throw new Error(rpcErr?.message ?? 'Falha ao garantir terreiro padrão');
      }
      org = ensured as string;

      const { data: terrNome } = await supabase
        .from('terreiros')
        .select('nome')
        .eq('id', org)
        .maybeSingle();
      setOrgNome((terrNome as any)?.nome ?? '');
    }

    setOrgId(org);
    return org!;
  };

  // carrega membros
  const loadMembros = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('membros')
        .select('*')
        .order('nome', { ascending: true });

      // isola por org atual (UX e segurança) — agora é org_id
      if (orgId) query = query.eq('org_id', orgId);

      if (searchTerm.trim()) {
        const q = `%${searchTerm.trim()}%`;
        query = query.or(`nome.ilike.${q},matricula.ilike.${q}`);
      }
      if (showActiveOnly) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMembros(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar membros',
        description: error?.message ?? 'Tente recarregar a página',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // carregar planos (apenas ativos) por org/terreiro
  const loadPlanosByTerreiro = async (terreiroId: string) => {
    if (!terreiroId) { setPlanos([]); return; }

    const { data, error } = await supabase
      .from('planos')
      .select('id, nome, valor_centavos, dia_vencimento, ativo, terreiro_id, org_id')
      .or(`terreiro_id.eq.${terreiroId},org_id.eq.${terreiroId}`)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) {
      console.error(error);
      toast({
        title: 'Erro ao carregar planos',
        description: error.message,
        variant: 'destructive',
      });
      setPlanos([]);
      return;
    }

    setPlanos(data || []);
    if (!data?.some(p => p.id === selectedPlanoId)) {
      setSelectedPlanoId('');
    }
  };

  // ---------- utils de cobrança ----------
  const endOfMonthDay = (y: number, mZeroBased: number) => {
    // mZeroBased: 0..11
    return new Date(y, mZeroBased + 1, 0).getDate();
  };

  const clampDay = (y: number, mZeroBased: number, d: number) => {
    const last = endOfMonthDay(y, mZeroBased);
    return Math.min(d, last);
  };

  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const compute24DueDates = (startISO: string, diaVenc: number): string[] => {
    const start = new Date(startISO + 'T00:00:00');
    const y0 = start.getFullYear();
    const m0 = start.getMonth();
    const day = start.getDate();

    // decide primeira competência
    let firstYear = y0;
    let firstMonth = m0;
    if (day > diaVenc) {
      // passa para mês seguinte
      firstMonth += 1;
      if (firstMonth > 11) {
        firstMonth = 0;
        firstYear += 1;
      }
    }
    const dates: string[] = [];
    let y = firstYear;
    let m = firstMonth;
    for (let i = 0; i < 24; i++) {
      const d = clampDay(y, m, diaVenc);
      dates.push(iso(new Date(y, m, d)));
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return dates;
  };

  const createViewerInviteIfEmail = async (org: string, email?: string | null) => {
    if (!email?.trim()) return;
    const clean = email.trim().toLowerCase();
    const { data: { user } } = await supabase.auth.getUser();

    // evita convites duplicados simples (mesmo org+email pendente)
    const { data: existing } = await supabase
      .from('org_invites')
      .select('id, status')
      .eq('org_id', org)
      .eq('email', clean)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing?.length && existing[0].status === 'pending') return;

    await supabase.from('org_invites').insert({
      org_id: org,
      email: clean,
      role: 'viewer',
      invited_by: user?.id ?? null,
    });
  };

  const generate24Invoices = async (params: {
    assinatura_id: string;
    membro_id: string;
    plano_id: string;
    org: string;
    inicioISO: string;
  }) => {
    const { assinatura_id, membro_id, plano_id, org, inicioISO } = params;

    // tenta achar o plano em memória; se não achar, busca
    let plano = planos.find(p => p.id === plano_id) as Plano | undefined;
    if (!plano) {
      const { data } = await supabase
        .from('planos')
        .select('id, nome, valor_centavos, dia_vencimento, terreiro_id, org_id')
        .eq('id', plano_id)
        .maybeSingle();
      plano = data as any;
    }
    if (!plano) throw new Error('Plano não encontrado para gerar faturas');

    const dueDates = compute24DueDates(inicioISO, Number(plano.dia_vencimento));
    const valorCent = Number(plano.valor_centavos || 0);
    const valorNum = Math.round(valorCent) / 100;

    // monta o payload em lote
    const rows = dueDates.map((dt) => ({
      assinatura_id,
      membro_id,
      plano_id,
      valor: valorNum,
      valor_centavos: valorCent,
      data_vencimento: dt,
      dt_vencimento: dt,
      status: 'pendente',
      terreiro_id: org, // compat
      org_id: org,      // novo
    }));

    const { error } = await supabase.from('faturas').insert(rows);
    if (error) throw error;
  };

  // ---------- PROMOVER MEMBRO A USUÁRIO (Edge Function) ----------
  const promoteToUser = async (
    membro: Membro,
    role: 'viewer' | 'operador' | 'financeiro' | 'admin' | 'owner' = 'viewer'
  ) => {
    try {
      const org = orgId ?? (await ensureValidOrgId());
      if (!membro?.id) throw new Error('Membro inválido');
      if (!membro?.email) {
        toast({ title: 'Sem e-mail', description: 'Este membro não possui e-mail cadastrado.', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-user', {
      body: { membro_id: membro.id, org_id: org, role },
      });
      if (error) throw error;

      toast({
        title: 'Usuário criado/vinculado',
        description: `E-mail: ${data?.email ?? membro.email} | Papel: ${data?.role ?? role}`,
      });
    } catch (e: any) {
      let desc = e?.message ?? 'Tente novamente';
      try {
        const body = e?.context?.body;
        if (body && typeof body.getReader === "function") {
          const txt = await new Response(body).text();
          desc = (() => { try { const j = JSON.parse(txt); return j.error || j.message || txt; } catch { return txt; } })();
        }
      } catch {}
      toast({ title: 'Falha ao promover a usuário', description: desc, variant: 'destructive' });
    }
  };


  // ---------- bootstrap ----------
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const validOrg = await ensureValidOrgId();

        // carrega terreiros para o Select
        const { data: ts, error: tErr } = await supabase
          .from('terreiros')
          .select('id, nome')
          .order('nome', { ascending: true });

        if (tErr) throw tErr;
        setTerreiros(ts || []);

        // default do select = org atual
        setSelectedTerreiroId(validOrg);
      } catch (e: any) {
        console.error(e);
        toast({
          title: 'Erro ao iniciar tela',
          description: e?.message ?? 'Tente novamente',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recarrega lista quando filtros/org mudarem
  useEffect(() => {
    if (!orgId) return;
    loadMembros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, searchTerm, showActiveOnly]);

  // quando abrir o diálogo ou trocar o terreiro no form, carregue os planos
  useEffect(() => {
    if (dialogOpen && selectedTerreiroId) {
      loadPlanosByTerreiro(selectedTerreiroId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, selectedTerreiroId]);

  // ---------- matrícula automática ----------
  const sugerirProximaMatricula = async (terreiroId: string) => {
    try {
      if (!terreiroId) return;
      const { data, error } = await supabase
        .from('membros')
        .select('matricula')
        .eq('org_id', terreiroId) // <--- agora por org_id
        .not('matricula', 'is', null)
        .order('matricula', { ascending: false })
        .limit(1);
      if (error) throw error;

      const ultima = data?.[0]?.matricula || '';
      // formatos aceitos: '2024-001', '000123', '123'
      let proxima = '';
      const m = /^(\d{4})-(\d+)$/.exec(ultima);
      if (m) {
        const ano = m[1];
        const seq = String(parseInt(m[2] || '0', 10) + 1).padStart(m[2].length, '0');
        proxima = `${ano}-${seq}`;
      } else {
        const n = parseInt(ultima.replace(/\D/g, ''), 10);
        if (Number.isFinite(n)) proxima = String(n + 1).padStart(ultima.length || 3, '0');
        else proxima = `${new Date().getFullYear()}-001`;
      }

      setFormData((f) => ({ ...f, matricula: proxima }));
    } catch {
      setFormData((f) => ({ ...f, matricula: `${new Date().getFullYear()}-001` }));
    }
  };

  const resetForm = () => {
    setFormData((f) => ({
      ...f,
      nome: '',
      matricula: '',
      dt_nascimento: '',
      telefone: '',
      email: '',
      endereco: '',
      bairro: '',
      cep: '',
      cidade: '',
      uf: '',
      numero: '',
      complemento: '',
      profissao: '',
      data_admissao_terreiro: '',
      ativo: true,
      observacoes: '',
      tipo_pessoa: 'PF',
      docs_pf: { cpf: '', rg: '', orgao_emissor: '', dt_emissao: '' },
      docs_pj: { razao_social: '', cnpj: '', ie: '', im: '' },
      umbanda: {
        orixas: ['', '', '', ''],
        pretoVelho: ['', ''],
        exu: ['', ''],
        pombaGira: ['', ''],
        caboclo: ['', ''],
        ere: ['', ''],
        outros: '',
      },
      candomble: {
        orixas: [
          { nome: '', qualidade: '' },
          { nome: '', qualidade: '' },
          { nome: '', qualidade: '' },
          { nome: '', qualidade: '' },
        ],
        obrigacoes: [
          { nome: '', data: '' },
          { nome: '', data: '' },
          { nome: '', data: '' },
          { nome: '', data: '' },
        ],
      },
    }));
    setSelectedTerreiroId(orgId ?? '');
    setEditingMembro(null);
    setSelectedPlanoId('');
    setTab('principal');
    // reset dos controles de criação de login
    setCriarLoginAgora(false);
    setRoleNovoUsuario('viewer');
  };

  const openEditDialog = (membro: Membro) => {
    // observacoes jsonb -> string do form
    const obsString =
      typeof membro.observacoes === 'string'
        ? membro.observacoes
        : (membro.observacoes?.texto ??
            (membro.observacoes ? JSON.stringify(membro.observacoes) : ''));

    setFormData({
      nome: membro.nome,
      matricula: membro.matricula ?? '',
      dt_nascimento: membro.dt_nascimento ?? '',
      telefone: membro.telefone ?? '',
      email: membro.email ?? '',
      endereco: membro.endereco ?? '',
      bairro: membro.bairro ?? '',
      cep: membro.cep ?? '',
      cidade: (membro as any).cidade ?? '',
      uf: (membro as any).uf ?? '',
      numero: (membro as any).numero ?? '',
      complemento: (membro as any).complemento ?? '',
      profissao: (membro as any).profissao ?? '',
      data_admissao_terreiro: membro.data_admissao_terreiro ?? '',
      ativo: membro.ativo,
      observacoes: obsString,
      tipo_pessoa: (membro as any).tipo_pessoa ?? 'PF',
      docs_pf: {
        cpf: membro?.docs?.cpf ?? '',
        rg: membro?.docs?.rg ?? '',
        orgao_emissor: membro?.docs?.orgao_emissor ?? '',
        dt_emissao: membro?.docs?.dt_emissao ?? '',
      },
      docs_pj: {
        razao_social: membro?.docs?.razao_social ?? '',
        cnpj: membro?.docs?.cnpj ?? '',
        ie: membro?.docs?.ie ?? '',
        im: membro?.docs?.im ?? '',
      },
      umbanda: {
        orixas: membro?.espiritual_umbanda?.orixas ?? ['', '', '', ''],
        pretoVelho: membro?.espiritual_umbanda?.pretoVelho ?? ['', ''],
        exu: membro?.espiritual_umbanda?.exu ?? ['', ''],
        pombaGira: membro?.espiritual_umbanda?.pombaGira ?? ['', ''],
        caboclo: membro?.espiritual_umbanda?.caboclo ?? ['', ''],
        ere: membro?.espiritual_umbanda?.ere ?? ['', ''],
        outros: membro?.espiritual_umbanda?.outros ?? '',
      },
      candomble: {
        orixas:
          membro?.espiritual_candomble?.orixas?.length
            ? membro.espiritual_candomble.orixas
            : [
                { nome: '', qualidade: '' },
                { nome: '', qualidade: '' },
                { nome: '', qualidade: '' },
                { nome: '', qualidade: '' },
              ],
        obrigacoes:
          membro?.espiritual_candomble?.obrigacoes?.length
            ? membro.espiritual_candomble.obrigacoes
            : [
                { nome: '', data: '' },
                { nome: '', data: '' },
                { nome: '', data: '' },
                { nome: '', data: '' },
              ],
      },
    });
    setSelectedTerreiroId(membro.org_id ?? orgId ?? '');
    setEditingMembro(membro);
    setTab('principal');
    // ao editar, não criar login por padrão
    setCriarLoginAgora(false);
    setRoleNovoUsuario('viewer');
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const validOrg = await ensureValidOrgId();
      const chosen = selectedTerreiroId || validOrg;

      // valida se o terreiro escolhido existe
      const { data: terr } = await supabase
        .from('terreiros')
        .select('id')
        .eq('id', chosen)
        .maybeSingle();

      if (!terr) {
        return toast({
          title: 'Terreiro inválido',
          description: 'Selecione um terreiro válido para o membro.',
          variant: 'destructive',
        });
      }

      const payload = buildPayload(chosen);

      if (editingMembro) {
        const { error } = await supabase
          .from('membros')
          .update(payload)
          .eq('id', editingMembro.id);
        if (error) throw error;

        toast({ title: 'Membro atualizado', description: `${payload.nome} foi atualizado com sucesso` });
      } else {
        // inserir e retornar o registro criado para pegar o id
        const { data: created, error } = await supabase
          .from('membros')
          .insert(payload)
          .select('*')
          .single();

        if (error) throw error;

        // 1) Se NÃO for criar login agora, manda convite (viewer) se tiver e-mail
        if (!criarLoginAgora) {
          try {
            await createViewerInviteIfEmail(chosen, formData.email);
          } catch (invErr: any) {
            // não bloqueia fluxo
            console.warn('Falha ao criar convite viewer:', invErr?.message);
          }
        }

        // 2) criar assinatura automática se escolheu plano (novo schema)
        if (selectedPlanoId) {
          const inicioDate =
            (formData.data_admissao_terreiro?.trim()
              ? formData.data_admissao_terreiro
              : new Date().toISOString().slice(0, 10));

          const { data: assinatura, error: subErr } = await supabase
            .from('assinaturas')
            .insert({
              membro_id: created.id,
              plano_id: selectedPlanoId,
              terreiro_id: chosen, // compat
              org_id: chosen,      // novo
              inicio: inicioDate,
              status: 'ativa',
              ativo: true,
            })
            .select('id')
            .single();

          if (subErr || !assinatura?.id) {
            toast({
              title: 'Membro cadastrado, mas houve problema na assinatura',
              description: subErr?.message ?? 'Não consegui criar a assinatura.',
              variant: 'destructive',
            });
          } else {
            // 3) gerar 24 faturas
            try {
              await generate24Invoices({
                assinatura_id: assinatura.id,
                membro_id: created.id,
                plano_id: selectedPlanoId,
                org: chosen,
                inicioISO: inicioDate,
              });
              toast({
                title: 'Assinatura e faturas criadas',
                description: 'Geradas 24 faturas futuras a partir do plano selecionado.',
              });
            } catch (fatErr: any) {
              toast({
                title: 'Assinatura criada, mas houve problema nas faturas',
                description: fatErr?.message ?? 'Verifique as configurações do plano.',
                variant: 'destructive',
              });
            }
          }
        }

        // 4) Criar login imediatamente (Edge promote-member-to-user)
        if (criarLoginAgora) {
          const emailOk = !!formData.email && /\S+@\S+\.\S+/.test(formData.email);
          if (!emailOk) {
            toast({
              title: 'Membro cadastrado, mas sem e-mail válido para login',
              description: 'Defina um e-mail válido para criar o acesso.',
              variant: 'destructive',
            });
          } else {
            await promoteToUser(created as Membro, roleNovoUsuario);
          }
        }

        toast({ title: 'Membro cadastrado', description: `${payload.nome} foi cadastrado com sucesso` });
      }

      setDialogOpen(false);
      resetForm();
      loadMembros();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar membro',
        description: error?.message ?? 'Verifique os dados e tente novamente',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (membro: Membro) => {
    try {
      const { error } = await supabase
        .from('membros')
        .delete()
        .eq('id', membro.id);
      if (error) throw error;

      toast({ title: 'Membro excluído', description: `${membro.nome} foi excluído do sistema` });
      loadMembros();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir membro',
        description: error?.message ?? 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const filteredMembros = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return membros.filter((m) => {
      const matchesSearch =
        m.nome.toLowerCase().includes(term) ||
        (!!m.matricula && m.matricula.toLowerCase().includes(term));
      const matchesActive = showActiveOnly ? m.ativo : true;
      return matchesSearch && matchesActive;
    });
  }, [membros, searchTerm, showActiveOnly]);

  // Opções fixas de obrigações (Candomblé)
  const OBRIGACOES = ['Bori', 'Yawo', 'Vodunsei', 'Egbomi'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Membros
            </h1>
            <p className="text-muted-foreground">Gerencie os membros (filhos de santo) do terreiro</p>
          </div>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (open) {
                const tid = selectedTerreiroId || orgId || '';
                if (tid) {
                  loadPlanosByTerreiro(tid);
                  sugerirProximaMatricula(tid);
                }
              }
            }}
          >
            <div className="relative z-20 pointer-events-auto">
              <Button
                type="button"
                onClick={() => {
                  resetForm();
                  const tid = orgId ?? '';
                  setSelectedTerreiroId(tid);
                  setDialogOpen(true);
                  if (tid) {
                    loadPlanosByTerreiro(tid);
                    sugerirProximaMatricula(tid);
                  }
                }}
                className="bg-primary text-primary-foreground hover:opacity-90 relative z-20"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Membro
              </Button>
            </div>

            {/* z-index ALTO para o content e os dropdowns não ficarem atrás */}
            <DialogContent className="w-[1100px] max-w-[52vw] max-h-[92vh] overflow-y-auto z-[300]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {editingMembro ? 'Editar Membro' : 'Novo Membro'}
                  <FileBadge2 className="h-4 w-4 text-muted-foreground" />
                </DialogTitle>
                <DialogDescription>
                  {editingMembro ? 'Atualize os dados do membro' : 'Cadastre um novo membro (filho de santo)'}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Tabs value={tab} onValueChange={setTab} className="w-full">

                  <TabsList className="mb-4 flex flex-wrap gap-2 justify-start border-b border-border/50">
                    <TabsTrigger value="principal" className="px-4 py-1 rounded-lg">
                      1. Principal
                    </TabsTrigger>
                    <TabsTrigger value="endereco" className="px-4 py-1 rounded-lg">
                      2. Endereço & Profissão
                    </TabsTrigger>
                    <TabsTrigger value="umbanda" className="px-4 py-1 rounded-lg">
                      3. Espiritual (Umbanda)
                    </TabsTrigger>
                    <TabsTrigger value="candomble" className="px-4 py-1 rounded-lg">
                      4. Espiritual (Candomblé)
                    </TabsTrigger>
                    <TabsTrigger value="docs" className="px-4 py-1 rounded-lg">
                      5. Documentação
                    </TabsTrigger>
                  </TabsList>

                  {/* Aba Principal */}
                  <TabsContent value="principal" className="space-y-4">
                    <TextGrid>
                      {/* Org/Terreiro Select */}
                      <div className="space-y-2">
                        <Label htmlFor="terreiro">Terreiro *</Label>
                        <Select
                          value={selectedTerreiroId}
                          onValueChange={(val) => {
                            setSelectedTerreiroId(val);
                            loadPlanosByTerreiro(val);
                            sugerirProximaMatricula(val);
                          }}
                        >
                          <SelectTrigger id="terreiro">
                            <SelectValue placeholder="Selecione o terreiro" />
                          </SelectTrigger>
                          {/* SelectContent com z-index alto e portal */}
                          <SelectContent className="z-[400]" position="popper" sideOffset={6}>
                            {orgId && (
                              <SelectItem value={orgId}>
                                Terreiro do Perfil{orgNome ? ` — ${orgNome}` : ''}
                              </SelectItem>
                            )}
                            {terreiros
                              .filter(t => t.id !== orgId)
                              .map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Matrícula (auto preenchida mas editável) */}
                      <div className="space-y-2">
                        <Label htmlFor="matricula">Matrícula</Label>
                        <Input
                          id="matricula"
                          value={formData.matricula}
                          onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                          placeholder="ex.: 2024-001"
                        />
                      </div>

                      {/* Nome */}
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome completo *</Label>
                        <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                      </div>

                      {/* Nascimento */}
                      <div className="space-y-2">
                        <Label htmlFor="dt_nascimento">Data de nascimento</Label>
                        <Input id="dt_nascimento" type="date" value={formData.dt_nascimento} onChange={(e) => setFormData({ ...formData, dt_nascimento: e.target.value })} />
                      </div>

                      {/* Admissão */}
                      <div className="space-y-2">
                        <Label htmlFor="data_admissao_terreiro">Data de admissão</Label>
                        <Input
                          id="data_admissao_terreiro"
                          type="date"
                          value={formData.data_admissao_terreiro}
                          onChange={(e) => setFormData({ ...formData, data_admissao_terreiro: e.target.value })}
                        />
                      </div>

                      {/* Telefone */}
                      <div className="space-y-2">
                        <Label htmlFor="telefone">Telefone</Label>
                        <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                      </div>

                      {/* Criar login agora + Papel (NOVO) */}
                      <div className="flex items-center gap-3 md:col-span-2">
                        <Switch
                          id="criar-login-agora"
                          checked={criarLoginAgora}
                          onCheckedChange={setCriarLoginAgora}
                        />
                        <Label htmlFor="criar-login-agora">Criar login agora</Label>

                        <Select
                          disabled={!criarLoginAgora}
                          value={roleNovoUsuario}
                          onValueChange={(v) => setRoleNovoUsuario(v as Role)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Papel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">viewer</SelectItem>
                            <SelectItem value="operador">operador</SelectItem>
                            <SelectItem value="financeiro">financeiro</SelectItem>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="owner">owner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TextGrid>

                    {/* Observações */}
                    <div className="space-y-2">
                      <Label htmlFor="observacoes">Observações</Label>
                      <Textarea id="observacoes" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Observações sobre o membro..." />
                    </div>

                    {/* ---- Plano (ÚLTIMO CAMPO) ---- */}
                    <div className="space-y-2">
                      <Label htmlFor="plano">Plano de início</Label>
                      <Select value={selectedPlanoId} onValueChange={setSelectedPlanoId}>
                        <SelectTrigger id="plano">
                          <SelectValue placeholder={planos.length ? 'Selecione o plano (opcional)' : 'Nenhum plano disponível para este terreiro'} />
                        </SelectTrigger>
                        <SelectContent className="z-[400]" position="popper" sideOffset={6}>
                          {planos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Se escolher um plano, a assinatura será criada com a <strong>data de admissão</strong> e já geraremos <strong>24 faturas</strong>.
                      </p>
                    </div>
                  </TabsContent>

                  {/* Aba Endereço & Profissão */}
                  <TabsContent value="endereco" className="space-y-4">
                    <TextGrid>
                      <div className="space-y-2">
                        <Label htmlFor="endereco">Logradouro</Label>
                        <Input id="endereco" value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} placeholder="Rua..." />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="numero">Número</Label>
                        <Input id="numero" value={formData.numero} onChange={(e) => setFormData({ ...formData, numero: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="complemento">Complemento</Label>
                        <Input id="complemento" value={formData.complemento} onChange={(e) => setFormData({ ...formData, complemento: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bairro">Bairro</Label>
                        <Input id="bairro" value={formData.bairro} onChange={(e) => setFormData({ ...formData, bairro: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cidade">Cidade</Label>
                        <Input id="cidade" value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="uf">UF</Label>
                        <Input id="uf" value={formData.uf} onChange={(e) => setFormData({ ...formData, uf: e.target.value })} maxLength={2} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cep">CEP</Label>
                        <Input id="cep" value={formData.cep} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profissao">Profissão</Label>
                        <Input id="profissao" value={formData.profissao} onChange={(e) => setFormData({ ...formData, profissao: e.target.value })} />
                      </div>
                    </TextGrid>
                  </TabsContent>

                  {/* Aba Umbanda */}
                  <TabsContent value="umbanda" className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Flower2 className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Cadastre guias e Orixás de Umbanda</span>
                    </div>

                    {/* Orixás (4 campos simples) */}
                    <div className="space-y-2">
                      <Label>Orixás</Label>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        {formData.umbanda.orixas.map((v, i) => (
                          <Input
                            key={`orixa-${i}`}
                            placeholder={`Orixá ${i + 1}`}
                            value={v}
                            onChange={(e) => {
                              const arr = [...formData.umbanda.orixas];
                              arr[i] = e.target.value;
                              setFormData({ ...formData, umbanda: { ...formData.umbanda, orixas: arr } });
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Guias: Preto Velho, Exu, Pomba Gira, Caboclo, Erê (cada um com 2 campos) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {([
                        ['pretoVelho','Preto Velho'],
                        ['exu','Exu'],
                        ['pombaGira','Pomba Gira'],
                        ['caboclo','Caboclo'],
                        ['ere','Erê'],
                      ] as ReadonlyArray<[keyof typeof formData.umbanda, string]>).map(([key, label]) => (
                        <div key={key} className="space-y-2">
                          <Label>{label}</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[0,1].map((idx) => (
                              <Input
                                key={`${String(key)}-${idx}`}
                                placeholder={`${label} ${idx+1}`}
                                value={(formData.umbanda[key] as string[])[idx] || ''}
                                onChange={(e) => {
                                  const list = [...(formData.umbanda[key] as string[])];
                                  list[idx] = e.target.value;
                                  setFormData({ ...formData, umbanda: { ...formData.umbanda, [key]: list } });
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label>Outros guias</Label>
                      <Input
                        placeholder="Outros guias/entidades"
                        value={formData.umbanda.outros}
                        onChange={(e) => setFormData({ ...formData, umbanda: { ...formData.umbanda, outros: e.target.value } })}
                      />
                    </div>
                  </TabsContent>

                  {/* Aba Candomblé */}
                  <TabsContent value="candomble" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Orixás (com qualidade)</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {formData.candomble.orixas.map((o, i) => (
                          <div key={`cand-orixa-${i}`} className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder={`Orixá ${i + 1}`}
                              value={o.nome}
                              onChange={(e) => {
                                const arr = [...formData.candomble.orixas];
                                arr[i] = { ...arr[i], nome: e.target.value };
                                setFormData({ ...formData, candomble: { ...formData.candomble, orixas: arr } });
                              }}
                            />
                            <Input
                              placeholder="Qualidade"
                              value={o.qualidade}
                              onChange={(e) => {
                                const arr = [...formData.candomble.orixas];
                                arr[i] = { ...arr[i], qualidade: e.target.value };
                                setFormData({ ...formData, candomble: { ...formData.candomble, orixas: arr } });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Obrigações</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {formData.candomble.obrigacoes.map((o, i) => (
                          <div key={`obr-${i}`} className="grid grid-cols-2 gap-2 items-center">
                            <Select
                              value={o.nome}
                              onValueChange={(v) => {
                                const arr = [...formData.candomble.obrigacoes];
                                arr[i] = { ...arr[i], nome: v };
                                setFormData({ ...formData, candomble: { ...formData.candomble, obrigacoes: arr } });
                              }}
                            >
                              <SelectTrigger className="z-[400]">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent className="z-[400]">
                                {OBRIGACOES.map((n) => (<SelectItem key={`${n}-${i}`} value={n}>{n}</SelectItem>))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="date"
                              value={o.data}
                              onChange={(e) => {
                                const arr = [...formData.candomble.obrigacoes];
                                arr[i] = { ...arr[i], data: e.target.value };
                                setFormData({ ...formData, candomble: { ...formData.candomble, obrigacoes: arr } });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Aba Documentação */}
                  <TabsContent value="docs" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tipo de pessoa</Label>
                      <Select
                        value={formData.tipo_pessoa}
                        onValueChange={(v: any) => setFormData({ ...formData, tipo_pessoa: v as TipoPessoa })}
                      >
                        <SelectTrigger className="z-[400]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[400]">
                          <SelectItem value="PF">Pessoa Física</SelectItem>
                          <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.tipo_pessoa === 'PF' ? (
                      <TextGrid>
                        <div className="space-y-2">
                          <Label>CPF</Label>
                          <Input value={formData.docs_pf.cpf} onChange={(e) => setFormData({ ...formData, docs_pf: { ...formData.docs_pf, cpf: e.target.value } })} />
                        </div>
                        <div className="space-y-2">
                          <Label>RG</Label>
                          <Input value={formData.docs_pf.rg} onChange={(e) => setFormData({ ...formData, docs_pf: { ...formData.docs_pf, rg: e.target.value } })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Órgão emissor</Label>
                          <Input value={formData.docs_pf.orgao_emissor} onChange={(e) => setFormData({ ...formData, docs_pf: { ...formData.docs_pf, orgao_emissor: e.target.value } })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Data emissão</Label>
                          <Input type="date" value={formData.docs_pf.dt_emissao} onChange={(e) => setFormData({ ...formData, docs_pf: { ...formData.docs_pf, dt_emissao: e.target.value } })} />
                        </div>
                      </TextGrid>
                    ) : (
                      <TextGrid>
                        <div className="space-y-2">
                          <Label>Razão Social</Label>
                          <Input value={formData.docs_pj.razao_social} onChange={(e) => setFormData({ ...formData, docs_pj: { ...formData.docs_pj, razao_social: e.target.value } })} />
                        </div>
                        <div className="space-y-2">
                          <Label>CNPJ</Label>
                          <Input value={formData.docs_pj.cnpj} onChange={(e) => setFormData({ ...formData, docs_pj: { ...formData.docs_pj, cnpj: e.target.value } })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Inscrição Estadual</Label>
                          <Input value={formData.docs_pj.ie} onChange={(e) => setFormData({ ...formData, docs_pj: { ...formData.docs_pj, ie: e.target.value } })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Inscrição Municipal</Label>
                          <Input value={formData.docs_pj.im} onChange={(e) => setFormData({ ...formData, docs_pj: { ...formData.docs_pj, im: e.target.value } })} />
                        </div>
                      </TextGrid>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end space-x-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-gradient-sacred hover:opacity-90">
                    {editingMembro ? 'Atualizar' : 'Cadastrar'}
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
                    placeholder="Buscar por nome ou matrícula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="showActive" checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
                <Label htmlFor="showActive">Apenas ativos</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members Table */}
        <Card className="bg-card/30 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>
              {filteredMembros.length} membro{filteredMembros.length !== 1 ? 's' : ''} encontrado{filteredMembros.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
                ))}
              </div>
            ) : (
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
                  {filteredMembros.map((membro) => (
                    <TableRow key={membro.id} className="border-border/50">
                      <TableCell className="font-medium">{membro.nome}</TableCell>
                      <TableCell>{membro.matricula || '-'}</TableCell>
                      <TableCell>{membro.telefone || '-'}</TableCell>
                      <TableCell>{membro.email || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={membro.ativo ? 'default' : 'secondary'}>
                          {membro.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Editar */}
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => openEditDialog(membro)}
                            className="hover:bg-accent hover:text-accent-foreground"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
                          </Button>

                          {/* Promover a usuário */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                title={membro.email ? 'Tornar usuário' : 'Informe um e-mail para promover'}
                                disabled={!membro.email}
                              >
                                <Users className="h-4 w-4" />
                                <span className="sr-only">Tornar usuário</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="top">
                              {(['viewer','operador','financeiro','admin','owner'] as const).map((r) => (
                                <DropdownMenuItem key={r} onClick={() => promoteToUser(membro, r)}>
                                  {r}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* Excluir */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                className="hover:bg-destructive hover:text-destructive-foreground"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Excluir</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir {membro.nome}? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(membro)}
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

            {!loading && filteredMembros.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum membro encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
