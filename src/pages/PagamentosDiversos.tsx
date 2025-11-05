// PagamentosDiversos.tsx (revisado para NUNCA criar terreiro)
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Trash2, HandCoins, Receipt, FileText, Pencil } from 'lucide-react';
import FeatureGate from "@/components/FeatureGate";
import UpgradeCard from "@/components/UpgradeCard";
interface Membro { id: string; nome: string; matricula: string | null }
interface PagDiverso {
  id: string; tipo: string; descricao: string | null; valor_centavos: number;
  metodo: string | null; membro_id: string | null; matricula: string | null;
  data: string; created_at: string; observacoes: string | null;
}
interface RegistroNomeado { id: string; nome: string }

export default function PagamentosDiversos() {
  const { toast } = useToast();

  // === CONTEXTO DO USUÁRIO ===
  const [userId, setUserId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myMembroId, setMyMembroId] = useState<string | null>(null);
  const [myMatricula, setMyMatricula] = useState<string | null>(null);
  const isViewer = myRole === 'viewer';

  // Organização (apenas leitura; NUNCA cria)
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgNome, setOrgNome] = useState<string>('');
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgEndereco, setOrgEndereco] = useState<string>('');
  const [orgContato, setOrgContato] = useState<string>('');
  const [orgCNPJ, setOrgCNPJ] = useState<string>('');

  // Lista
  const [loading, setLoading] = useState(false);
  const [itens, setItens] = useState<PagDiverso[]>([]);
  const [search, setSearch] = useState('');
  const [apenasHoje, setApenasHoje] = useState(true);

  // Tipos (CRUD)
  const [tipos, setTipos] = useState<RegistroNomeado[]>([]);
  const [addTipoOpen, setAddTipoOpen] = useState(false);
  const [editTipoOpen, setEditTipoOpen] = useState(false);
  const [deleteTipoOpen, setDeleteTipoOpen] = useState(false);
  const [newTipoName, setNewTipoName] = useState('');
  const [editTipoName, setEditTipoName] = useState('');
  const [tipoToEdit, setTipoToEdit] = useState<RegistroNomeado | null>(null);
  const [tipoToDelete, setTipoToDelete] = useState<RegistroNomeado | null>(null);

  // Métodos (CRUD)
  const [metodos, setMetodos] = useState<RegistroNomeado[]>([]);
  const [addMetodoOpen, setAddMetodoOpen] = useState(false);
  const [editMetodoOpen, setEditMetodoOpen] = useState(false);
  const [deleteMetodoOpen, setDeleteMetodoOpen] = useState(false);
  const [newMetodoName, setNewMetodoName] = useState('');
  const [editMetodoName, setEditMetodoName] = useState('');
  const [metodoToEdit, setMetodoToEdit] = useState<RegistroNomeado | null>(null);
  const [metodoToDelete, setMetodoToDelete] = useState<RegistroNomeado | null>(null);

  // Form
  const [form, setForm] = useState({
    tipo: 'doacao',
    descricao: '',
    valor: '',
    metodo: 'pix',
    matricula: '',
    membroNome: '',
    data: new Date().toISOString().slice(0, 10),
    observacoes: '',
  });
  const [membroResolvido, setMembroResolvido] = useState<Membro | null>(null);

  // Pós-salvar → pergunta imprimir
  const [askReceiptOpen, setAskReceiptOpen] = useState(false);
  const [lastInserted, setLastInserted] = useState<PagDiverso[] | null>(null);

  // helpers
  const normalize = (v: string) => (v?.trim() ? v.trim() : null);
  const toCentavos = (v: string): number => {
    const s = v.replace(/\./g, '').replace(',', '.').trim();
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };
  const formatBRL = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);

  const toBaseTipo = (label: string): 'doacao' | 'compra' | 'outro' => {
    const t = (label || '').toLowerCase();
    if (t.includes('doa')) return 'doacao';
    if (t.includes('compr')) return 'compra';
    return 'outro';
  };

  // ========= BOOTSTRAP =========
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');
        setUserId(user.id);

        // profile (org, role, membro_id)
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('org_id, role, membro_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profErr) throw profErr;

        const oid = (profile as any)?.org_id ?? null;
        if (!oid) {
          toast({
            title: 'Sem terreiro vinculado',
            description: 'Seu usuário não está vinculado a nenhum terreiro. Peça a um admin para associá-lo.',
            variant: 'destructive',
          });
          return;
        }

        setOrgId(oid);
        setMyRole((profile as any)?.role ?? null);
        const membId = (profile as any)?.membro_id ?? null;
        setMyMembroId(membId);

        if (membId) {
          const { data: mem } = await supabase
            .from('membros')
            .select('id, nome, matricula')
            .eq('id', membId)
            .maybeSingle();
          setMyMatricula((mem as any)?.matricula ?? null);
        }

        await loadOrgInfo(oid);
        await loadTipos(oid);
        await loadMetodos(oid);
        await loadItens(oid); // primeira carga
      } catch (e: any) {
        console.error(e);
        toast({ title: 'Erro ao iniciar', description: e?.message ?? 'Tente novamente', variant: 'destructive' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se viewer, force PIX e trave matrícula = própria
  useEffect(() => {
    if (isViewer) {
      setForm(f => ({ ...f, metodo: 'pix', matricula: myMatricula ?? '' }));
      setMetodos([{ id: 'preset-pix', nome: 'pix' }]);
      if (myMatricula) void resolveMembro(myMatricula, true);
    }
  }, [isViewer, myMatricula]);

  // Recarrega lista ao mudar filtros básicos
  useEffect(() => {
    if (!orgId) return;
    loadItens(orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, search, apenasHoje, isViewer, myMatricula]);

  /** 👉 Agora apenas garante que já EXISTE um org_id; não cria nada */
  const requireOrgId = async (): Promise<string> => {
    if (orgId) return orgId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('user_id', user.id)
      .maybeSingle();
    const oid = (profile as any)?.org_id ?? null;
    if (!oid) throw new Error('Seu usuário não está vinculado a um terreiro.');
    setOrgId(oid);
    return oid;
  };

  const loadOrgInfo = async (id: string) => {
    const { data } = await supabase
      .from('terreiros')
      .select('nome, logo_url, cnpj, endereco, bairro, cidade, estado, cep, telefone, whatsapp, email, site')
      .eq('id', id)
      .maybeSingle();

    const terr: any = data ?? {};
    setOrgNome(terr.nome ?? '');
    setOrgLogo(terr.logo_url ?? null);
    setOrgCNPJ(terr.cnpj ?? '');

    const enderecoFmt = [
      terr.endereco,
      terr.bairro,
      terr.cidade && terr.estado ? `${terr.cidade}/${terr.estado}` : terr.cidade || terr.estado,
      terr.cep,
    ].filter(Boolean).join(' • ');
    setOrgEndereco(enderecoFmt);

    const contatoFmt = [terr.telefone, terr.whatsapp, terr.email, terr.site].filter(Boolean).join(' • ');
    setOrgContato(contatoFmt);
  };

  // ========= Tipos =========
  const loadTipos = async (oid: string) => {
    try {
      const { data, error } = await supabase
        .from('pagamentos_diversos_tipos')
        .select('id,nome')
        .eq('terreiro_id', oid)
        .order('nome', { ascending: true });

      if (error) throw error;

      const arr = (data || []) as RegistroNomeado[];
      if (arr.length) {
        setTipos(arr);
        if (!arr.some(t => t.nome === form.tipo)) {
          setForm(f => ({ ...f, tipo: arr[0].nome }));
        }
      } else {
        const fallback = [
          { id: 'local-doacao', nome: 'doacao' },
          { id: 'local-compra', nome: 'compra' },
          { id: 'local-outro', nome: 'outro' },
        ];
        setTipos(fallback);
        if (!fallback.some(t => t.nome === form.tipo)) {
          setForm(f => ({ ...f, tipo: 'doacao' }));
        }
      }
    } catch (e:any) {
      console.error(e);
      toast({ title:'Erro ao carregar tipos', description:e?.message ?? 'Tente novamente', variant:'destructive' });
    }
  };

  const openAddTipo = () => { if (isViewer) return; setNewTipoName(''); setAddTipoOpen(true); };
  const openEditTipo = () => {
    if (isViewer) return;
    const atual = tipos.find(t => t.nome === form.tipo) || null;
    if (!atual || atual.id.startsWith('local-')) {
      toast({ title: 'Tipo não editável', description: 'Adicione um tipo personalizado para editar.', variant: 'destructive' });
      return;
    }
    setTipoToEdit(atual); setEditTipoName(atual.nome); setEditTipoOpen(true);
  };
  const openDeleteTipo = () => {
    if (isViewer) return;
    const atual = tipos.find(t => t.nome === form.tipo) || null;
    if (!atual || atual.id.startsWith('local-')) {
      toast({ title: 'Tipo não removível', description: 'Tipos padrão não podem ser removidos.', variant: 'destructive' });
      return;
    }
    setTipoToDelete(atual); setDeleteTipoOpen(true);
  };

  const submitAddTipo = async () => {
    if (isViewer) return;
    try {
      const nome = newTipoName.trim();
      if (!nome) return toast({ title: 'Informe o nome do tipo', variant: 'destructive' });
      const oid = await requireOrgId();
      if (tipos.some(t => t.nome.toLowerCase() === nome.toLowerCase())) {
        return toast({ title: 'Tipo já existe', description: 'Escolha outro nome.', variant: 'destructive' });
      }
      await supabase.from('pagamentos_diversos_tipos').insert({ terreiro_id: oid, nome });
      await loadTipos(oid);
      setForm(f => ({ ...f, tipo: nome }));
      setAddTipoOpen(false);
      toast({ title: 'Tipo adicionado' });
    } catch (e:any) {
      toast({ title: 'Erro ao adicionar', description: e?.message ?? 'Crie a tabela pagamentos_diversos_tipos.', variant: 'destructive' });
    }
  };
  const submitEditTipo = async () => {
    if (isViewer) return;
    try {
      const nome = editTipoName.trim();
      if (!nome || !tipoToEdit) return;
      if (tipos.some(t => t.nome.toLowerCase() === nome.toLowerCase() && t.id !== tipoToEdit.id)) {
        return toast({ title: 'Conflito', description: 'Já existe um tipo com esse nome.', variant: 'destructive' });
      }
      await supabase.from('pagamentos_diversos_tipos').update({ nome }).eq('id', tipoToEdit.id);
      if (orgId) await loadTipos(orgId);
      setForm(f => ({ ...f, tipo: nome }));
      setEditTipoOpen(false);
      toast({ title: 'Tipo atualizado' });
    } catch (e:any) {
      toast({ title: 'Erro ao atualizar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    }
  };
  const submitDeleteTipo = async () => {
    if (isViewer) return;
    try {
      if (!tipoToDelete) return;
      await supabase.from('pagamentos_diversos_tipos').delete().eq('id', tipoToDelete.id);
      if (orgId) await loadTipos(orgId);
      setForm(f => ({ ...f, tipo: 'doacao' }));
      setDeleteTipoOpen(false);
      toast({ title: 'Tipo excluído' });
    } catch (e:any) {
      toast({ title: 'Erro ao excluir', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    }
  };

  // ========= Métodos =========
  const loadMetodos = async (oid: string) => {
    try {
      if (isViewer) {
        setMetodos([{ id: 'preset-pix', nome: 'pix' }]);
        setForm(f => ({ ...f, metodo: 'pix' }));
        return;
      }

      const { data, error } = await supabase
        .from('pagamentos_diversos_metodos')
        .select('id,nome')
        .eq('terreiro_id', oid)
        .order('nome', { ascending: true });
      if (error) throw error;

      const personalizados = (data || []) as RegistroNomeado[];
      const presets: RegistroNomeado[] = [
        { id: 'preset-pix',            nome: 'pix' },
        { id: 'preset-dinheiro',       nome: 'dinheiro' },
        { id: 'preset-cartao',         nome: 'cartao' },
        { id: 'preset-transferencia',  nome: 'transferencia' },
      ];

      const nomes = new Set<string>();
      const merged: RegistroNomeado[] = [];
      for (const it of personalizados.concat(presets)) {
        if (nomes.has(it.nome.toLowerCase())) continue;
        nomes.add(it.nome.toLowerCase());
        merged.push(it);
      }

      setMetodos(merged);
      if (!merged.some(m => m.nome === form.metodo)) {
        setForm(f => ({ ...f, metodo: merged[0]?.nome || 'pix' }));
      }
    } catch {
      const fallback: RegistroNomeado[] = [
        { id: 'preset-pix',            nome: 'pix' },
        { id: 'preset-dinheiro',       nome: 'dinheiro' },
        { id: 'preset-cartao',         nome: 'cartao' },
        { id: 'preset-transferencia',  nome: 'transferencia' },
      ];
      setMetodos(isViewer ? [{ id: 'preset-pix', nome: 'pix' }] : fallback);
      setForm(f => ({ ...f, metodo: 'pix' }));
    }
  };

  const openAddMetodo = () => { if (isViewer) return; setNewMetodoName(''); setAddMetodoOpen(true); };
  const openEditMetodo = () => { if (isViewer) return; const atual = metodos.find(m => m.nome === form.metodo) || null; setMetodoToEdit(atual); setEditMetodoName(atual?.nome || ''); setEditMetodoOpen(true); };
  const openDeleteMetodo = () => {
    if (isViewer) return;
    const atual = metodos.find(m => m.nome === form.metodo) || null;
    if (!atual || atual.id.startsWith('preset-')) {
      return toast({ title: 'Método não removível', description: 'Presets não podem ser removidos.', variant: 'destructive' });
    }
    setMetodoToDelete(atual); setDeleteMetodoOpen(true);
  };

  const submitAddMetodo = async () => {
    if (isViewer) return;
    try {
      const nome = newMetodoName.trim();
      if (!nome) return toast({ title: 'Informe o nome do método', variant: 'destructive' });
      const oid = await requireOrgId();
      if (metodos.some(m => m.nome.toLowerCase() === nome.toLowerCase())) {
        return toast({ title: 'Método já existe', description: 'Escolha outro nome.', variant: 'destructive' });
      }
      await supabase.from('pagamentos_diversos_metodos').insert({ terreiro_id: oid, nome });
      await loadMetodos(oid);
      setForm(f => ({ ...f, metodo: nome }));
      setAddMetodoOpen(false);
      toast({ title: 'Método adicionado' });
    } catch (e:any) {
      toast({ title: 'Erro ao adicionar', description: e?.message ?? 'Crie a tabela pagamentos_diversos_metodos.', variant: 'destructive' });
    }
  };
  const submitEditMetodo = async () => {
    if (isViewer) return;
    try {
      const nome = editMetodoName.trim();
      if (!nome || !metodoToEdit) return;

      if (metodoToEdit.id.startsWith('preset-')) {
        if (metodos.some(m => m.nome.toLowerCase() === nome.toLowerCase())) {
          return toast({ title: 'Conflito', description: 'Já existe um método com esse nome.', variant: 'destructive' });
        }
        const oid = await requireOrgId();
        await supabase.from('pagamentos_diversos_metodos').insert({ terreiro_id: oid, nome });
        await loadMetodos(oid);
        setForm(f => ({ ...f, metodo: nome }));
      } else {
        if (metodos.some(m => m.nome.toLowerCase() === nome.toLowerCase() && m.id !== metodoToEdit.id)) {
          return toast({ title: 'Conflito', description: 'Já existe um método com esse nome.', variant: 'destructive' });
        }
        await supabase.from('pagamentos_diversos_metodos').update({ nome }).eq('id', metodoToEdit.id);
        if (orgId) await loadMetodos(orgId);
        setForm(f => ({ ...f, metodo: nome }));
      }

      setEditMetodoOpen(false);
      toast({ title: 'Método atualizado' });
    } catch (e:any) {
      toast({ title: 'Erro ao atualizar', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    }
  };
  const submitDeleteMetodo = async () => {
    if (isViewer) return;
    try {
      if (!metodoToDelete) return;
      await supabase.from('pagamentos_diversos_metodos').delete().eq('id', metodoToDelete.id);
      if (orgId) await loadMetodos(orgId);
      setForm(f => ({ ...f, metodo: 'pix' }));
      setDeleteMetodoOpen(false);
      toast({ title: 'Método excluído' });
    } catch (e:any) {
      toast({ title: 'Erro ao excluir', description: e?.message ?? 'Tente novamente.', variant: 'destructive' });
    }
  };

  // ========= Itens =========
  const loadItens = async (finalOrgId?: string) => {
    try {
      setLoading(true);
      const org = finalOrgId ?? orgId;
      if (!org) return;

      let query = supabase
        .from('pagamentos_diversos')
        .select('id, tipo, descricao, metodo, valor_centavos, membro_id, matricula, data, created_at, observacoes, usuario_operacao')
        .eq('terreiro_id', org)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      // Viewer: restringe à própria matrícula OU lançamentos feitos por ele
      if (isViewer) {
        const parts: string[] = [];
        if (userId) parts.push(`usuario_operacao.eq.${userId}`);
        if (myMatricula) parts.push(`matricula.eq.${myMatricula}`);
        if (parts.length) query = query.or(parts.join(','));
      }

      if (apenasHoje) {
        const hoje = new Date().toISOString().slice(0, 10);
        query = query.eq('data', hoje);
      }
      if (search.trim()) {
        const q = `%${search.trim()}%`;
        query = query.or(`descricao.ilike.${q},matricula.ilike.${q},tipo.ilike.${q},observacoes.ilike.${q}`);
      }

      const { data, error } = await query
        .select(`
          *,
          formas_pagamento:forma_pagamento_id (nome)
        `);
      if (error) throw error;
      
      const mapped = (data || []).map((item: any) => ({
        ...item,
        metodo: item.formas_pagamento?.nome || null
      }));
      setItens(mapped);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar lançamentos', description: e?.message ?? 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // membro
  const resolveMembro = async (mat: string, silent = false) => {
    const matUse = (isViewer && myMatricula) ? myMatricula : mat;
    if (!matUse || !matUse.trim()) {
      setMembroResolvido(null);
      setForm(f => ({ ...f, membroNome: '' }));
      return;
    }
    try {
      const { data, error } = await supabase
        .from('membros')
        .select('id,nome,matricula,terreiro_id')
        .eq('matricula', matUse.trim())
        .eq('terreiro_id', orgId!)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        if (!silent) toast({ title: 'Matrícula não encontrada', description: 'Verifique o número informado.' });
        setMembroResolvido(null);
        setForm(f => ({ ...f, membroNome: '' }));
        return;
      }
      setMembroResolvido(data as any as Membro);
      setForm(f => ({ ...f, membroNome: (data as any).nome || '', matricula: matUse }));
    } catch (err: any) {
      if (!silent) toast({ title: 'Erro ao buscar matrícula', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setForm({
      tipo: tipos[0]?.nome || 'doacao',
      descricao: '',
      valor: '',
      metodo: isViewer ? 'pix' : (metodos[0]?.nome || 'pix'),
      matricula: isViewer ? (myMatricula ?? '') : '',
      membroNome: '',
      data: new Date().toISOString().slice(0, 10),
      observacoes: '',
    });
    setMembroResolvido(null);
    if (isViewer && myMatricula) void resolveMembro(myMatricula, true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const oid = await requireOrgId(); // 👉 não cria; só confirma que existe
      const centavos = toCentavos(form.valor);
      if (!centavos) return toast({ title: 'Informe um valor válido', variant: 'destructive' });

      const metodoFinal = isViewer ? 'pix' : form.metodo;

      let matriculaFinal = normalize(form.matricula || '');
      if (isViewer) {
        if (!myMatricula) {
          return toast({ title: 'Sem matrícula vinculada', description: 'Seu perfil não possui matrícula para vincular.', variant: 'destructive' });
        }
        matriculaFinal = myMatricula;
      }

      // Garante membro_id coerente com a matrícula
      let membroId: string | null = membroResolvido?.id ?? null;
      if (matriculaFinal) {
        if (!membroResolvido || membroResolvido.matricula !== matriculaFinal) {
          const { data: mem, error: memErr } = await supabase
            .from('membros')
            .select('id,nome,matricula')
            .eq('matricula', matriculaFinal)
            .eq('terreiro_id', oid)
            .maybeSingle();
          if (memErr) throw memErr;
          membroId = (mem as any)?.id ?? null;
        }
      }

      const payload = {
        terreiro_id: oid,
        tipo: toBaseTipo(form.tipo),
        descricao: normalize(form.descricao || ''),
        valor_centavos: centavos,
        forma_pagamento_id: metodoFinal,
        membro_id: membroId,
        matricula: matriculaFinal,
        data: form.data || new Date().toISOString().slice(0, 10),
        usuario_operacao: userId ?? null,
        observacoes: normalize(form.observacoes || ''),
      };

      const { data: inserted, error } = await supabase
        .from('pagamentos_diversos')
        .insert(payload)
        .select('id, tipo, descricao, valor_centavos, membro_id, matricula, data, created_at, observacoes');

      if (error) throw error;

      toast({ title: 'Lançamento salvo', description: `Registro criado com sucesso.` });
      setLastInserted((inserted || []) as PagDiverso[]);
      setAskReceiptOpen(true);
      resetForm();
      loadItens(oid);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message ?? 'Tente novamente', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (isViewer) return; // viewer não pode excluir
    try {
      const { error } = await supabase.from('pagamentos_diversos').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Lançamento excluído' });
      if (orgId) loadItens(orgId);
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e?.message ?? 'Tente novamente', variant: 'destructive' });
    }
  };

  const itensFiltrados = useMemo(() => itens, [itens]);

  // Cupom 80mm
  const imprimirCupom = () => {
    try {
      setAskReceiptOpen(false);
      const rows = lastInserted ?? [];
      if (!rows.length) {
        toast({ title: 'Nada para imprimir' });
        return;
      }

      const dataHora = new Date().toLocaleString('pt-BR');
      const moeda = (v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((v||0)/100);

      const linhas = rows.map((r) => {
        const item = (r.descricao || r.tipo || '-').slice(0, 40);
        const mat = r.matricula || '-';
        const val = moeda(r.valor_centavos);
        return `<tr>
          <td>${item}</td>
          <td style="text-align:center">${mat}</td>
          <td style="text-align:right">${val}</td>
        </tr>`;
      }).join('');

      const total = moeda(rows.reduce((acc, i) => acc + (i.valor_centavos || 0), 0));
      const metodo = rows[0]?.metodo || '-';
      const membroLinha = rows[0]?.matricula
        ? `Matrícula: ${rows[0].matricula}`
        : (membroResolvido?.nome ? `Membro: ${membroResolvido.nome}` : '');
      const obsLinha = rows[0]?.observacoes ? `<div class="muted">Obs.: ${rows[0].observacoes}</div>` : '';

      const html = `<!doctype html>
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
    th, td { padding: 4px 0; }
    th { text-align: left; border-bottom: 1px dashed #999; }
    tbody td { border-bottom: 1px dashed #999; }
    .tot { border-top: 1px dashed #999; padding-top: 6px; margin-top: 4px; font-weight: 700; }
    .foot { border-top: 1px dashed #999; margin-top: 8px; padding-top: 6px; font-size: 10px; text-align: center; }
  </style>
  </head>
  <body>
    <div class="wrap">
      <div class="center">
        ${orgLogo ? `<img src="${orgLogo}" class="logo" />` : ''}
        <div class="title">${orgNome || 'Comprovante'}</div>
        <div class="muted">
          ${orgCNPJ ? `CNPJ: ${orgCNPJ}<br/>` : ''}
          ${orgEndereco || ''}${orgContato ? `<br/>${orgContato}` : ''}
        </div>
      </div>

      <div class="muted" style="margin-top:6px">Data/Hora: ${dataHora}</div>
      <div class="muted">Método: ${metodo}</div>
      ${membroLinha ? `<div class="muted">${membroLinha}</div>` : ''}
      ${obsLinha}

      <table>
        <thead>
          <tr><th>Item</th><th style="text-align:center">Mat</th><th style="text-align:right">Valor</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>

      <div class="tot">Total pago: ${total}</div>
      <div class="foot">Obrigado pela contribuição.<br/>Este documento não substitui NF-e.</div>
    </div>
    <script>
      window.onload = function () {
        try { window.focus(); window.print(); } catch (e) {}
      }
    </script>
  </body>
  </html>`;

      // imprime via iframe oculto
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || (iframe as any).contentWindow?.document;
      if (!doc) throw new Error('Não foi possível preparar a impressão.');
      doc.open();
      doc.write(html);
      doc.close();

      const cleanup = () => {
        try { document.body.removeChild(iframe); } catch {}
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      setTimeout(cleanup, 8000);
    } catch (e:any) {
      console.error(e);
      toast({ title: 'Erro ao imprimir cupom', description: e?.message ?? 'Tente novamente', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <FeatureGate feature="pagamentos_diversos" fallback={<UpgradeCard needed="Pagamentos diversos" />}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <HandCoins className="h-8 w-8 text-primary" />
                Pagamentos Diversos
              </h1>
              <p className="text-muted-foreground">
                {isViewer
                  ? 'Você pode lançar seus pagamentos apenas via PIX.'
                  : <>Lance doações e compras avulsas do terreiro {orgNome ? `— ${orgNome}` : ''}</>}
              </p>
            </div>
          </div>

          {/* Form */}
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader><CardTitle>Novo lançamento</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipo */}
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="flex gap-2">
                    <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        {tipos.map(t => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!isViewer && (
                      <>
                        <Button type="button" variant="outline" size="icon" title="Inserir tipo" onClick={()=>{ setNewTipoName(''); setAddTipoOpen(true); }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" title="Editar tipo" onClick={openEditTipo}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" title="Excluir tipo" onClick={openDeleteTipo}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Gerencie tipos (evento, rifa, bazar, campanha...).</p>
                </div>

                {/* Método */}
                <div className="space-y-2">
                  <Label>Método de pagamento</Label>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={form.metodo}
                      onValueChange={(v: any) => setForm({ ...form, metodo: v })}
                      disabled={isViewer} // viewer travado em PIX
                    >
                      <SelectTrigger className="w-48"><SelectValue placeholder="Selecione o método" /></SelectTrigger>
                      <SelectContent>
                        {metodos.map(m => <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!isViewer && (
                      <>
                        <Button type="button" variant="outline" size="icon" title="Inserir método" onClick={()=>{ setNewMetodoName(''); setAddMetodoOpen(true); }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" title="Editar método" onClick={openEditMetodo}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" size="icon" title="Excluir método" onClick={openDeleteMetodo}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  {isViewer && <p className="text-xs text-muted-foreground">Para seu perfil, o método é sempre PIX.</p>}
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    placeholder={form.tipo === 'doacao' ? 'Ex.: Doação voluntária' : 'Ex.: Camiseta branca M'}
                    value={form.descricao}
                    onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input inputMode="decimal" placeholder="0,00" value={form.valor} onChange={(e)=>setForm({ ...form, valor: e.target.value })}/>
                </div>

                <div className="space-y-2">
                  <Label>Matrícula</Label>
                  <Input
                    placeholder="Ex.: 2024-001"
                    value={isViewer ? (myMatricula ?? '') : form.matricula}
                    onChange={(e) => setForm({ ...form, matricula: e.target.value })}
                    onBlur={(e) => resolveMembro(e.target.value)}
                    disabled={isViewer} // << trava para viewer
                  />
                  <p className="text-xs text-muted-foreground">
                    {isViewer
                      ? myMatricula
                        ? <>Lançamento vinculado à sua matrícula <span className="font-mono">{myMatricula}</span>.</>
                        : 'Seu perfil não possui matrícula vinculada.'
                      : membroResolvido?.nome
                          ? `Vinculado a: ${membroResolvido.nome}`
                          : form.matricula
                            ? 'Pressione Tab ou clique fora para buscar a matrícula.'
                            : 'Se preencher, o valor será atrelado ao membro.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Data do movimento</Label>
                  <Input type="date" value={form.data} onChange={(e)=>setForm({ ...form, data: e.target.value })}/>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Detalhes adicionais..."
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Observações são salvas junto ao lançamento.</p>
                </div>

                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>Limpar</Button>
                  <Button type="submit" className="bg-gradient-sacred hover:opacity-90">
                    <Plus className="h-4 w-4 mr-2" /> Lançar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Lista */}
          <Card className="bg-card/30 backdrop-blur-sm">
            <CardHeader><CardTitle>Últimos lançamentos</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4 items-end">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input placeholder="Buscar por descrição, matrícula, método, tipo ou observações..." value={search} onChange={(e)=>setSearch(e.target.value)} className="pl-10" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="apenasHoje" checked={apenasHoje} onCheckedChange={setApenasHoje} />
                  <Label htmlFor="apenasHoje">Apenas de hoje</Label>
                </div>
              </div>

              {loading ? (
                <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      {!isViewer && <TableHead className="w-[100px]">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensFiltrados.map(item => (
                      <TableRow key={item.id} className="border-border/50">
                        <TableCell>{new Date(item.data).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge variant={item.tipo === 'doacao' ? 'default' : item.tipo === 'compra' ? 'secondary' : 'outline'}>
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate" title={item.descricao || ''}>{item.descricao || '-'}</TableCell>
                        <TableCell className="font-mono">{item.matricula || '-'}</TableCell>
                        <TableCell className="capitalize">{item.metodo || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">{formatBRL(item.valor_centavos)}</TableCell>
                        {!isViewer && (
                          <TableCell>
                            <Button size="sm" variant="outline" className="hover:bg-destructive hover:text-destructive-foreground" onClick={()=>handleDelete(item.id)} title="Excluir">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {!loading && itensFiltrados.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhum lançamento encontrado.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pergunta: imprimir cupom fiscal? */}
          <Dialog open={askReceiptOpen} onOpenChange={setAskReceiptOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Imprimir cupom fiscal?</DialogTitle>
                <DialogDescription>Deseja gerar o cupom fiscal do lançamento registrado?</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAskReceiptOpen(false)}>Não agora</Button>
                <Button onClick={imprimirCupom} className="gap-2"><FileText className="h-4 w-4" />Gerar cupom</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* POPUPs: Tipos (bloqueados para viewer) */}
          <Dialog open={addTipoOpen} onOpenChange={setAddTipoOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Novo tipo de pagamento diverso</DialogTitle>
                <DialogDescription>Adicione um tipo (evento, rifa, bazar, campanha...).</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Label htmlFor="novo-tipo">Nome do tipo</Label>
                <Input id="novo-tipo" placeholder="Ex.: evento" value={newTipoName} onChange={(e)=>setNewTipoName(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') submitAddTipo(); }} />
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={()=>setAddTipoOpen(false)}>Cancelar</Button>
                  <Button onClick={submitAddTipo} disabled={!newTipoName.trim() || isViewer}>Adicionar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={editTipoOpen} onOpenChange={setEditTipoOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Editar tipo</DialogTitle><DialogDescription>Renomeie o tipo selecionado.</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <Label htmlFor="edit-tipo">Nome</Label>
                <Input id="edit-tipo" value={editTipoName} onChange={(e)=>setEditTipoName(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') submitEditTipo(); }} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={()=>setEditTipoOpen(false)}>Cancelar</Button>
                  <Button onClick={submitEditTipo} disabled={!editTipoName.trim() || isViewer}>Salvar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteTipoOpen} onOpenChange={setDeleteTipoOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Excluir tipo?</DialogTitle><DialogDescription>Essa ação não pode ser desfeita.</DialogDescription></DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={()=>setDeleteTipoOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={submitDeleteTipo} disabled={isViewer}>Excluir</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* POPUPs: Métodos (bloqueados para viewer) */}
          <Dialog open={addMetodoOpen} onOpenChange={setAddMetodoOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Novo método de pagamento</DialogTitle><DialogDescription>Adicione um método personalizado.</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <Label htmlFor="novo-metodo">Nome do método</Label>
                <Input id="novo-metodo" placeholder="Ex.: boleto" value={newMetodoName} onChange={(e)=>setNewMetodoName(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') submitAddMetodo(); }} />
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={()=>setAddMetodoOpen(false)}>Cancelar</Button>
                  <Button onClick={submitAddMetodo} disabled={!newMetodoName.trim() || isViewer}>Adicionar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={editMetodoOpen} onOpenChange={setEditMetodoOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Editar método</DialogTitle><DialogDescription>Renomeie o método selecionado.</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <Label htmlFor="edit-metodo">Nome</Label>
                <Input id="edit-metodo" value={editMetodoName} onChange={(e)=>setEditMetodoName(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') submitEditMetodo(); }} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={()=>setEditMetodoOpen(false)}>Cancelar</Button>
                  <Button onClick={submitEditMetodo} disabled={!editMetodoName.trim() || isViewer}>Salvar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteMetodoOpen} onOpenChange={setDeleteMetodoOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Excluir método?</DialogTitle><DialogDescription>Essa ação não pode ser desfeita.</DialogDescription></DialogHeader>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={()=>setDeleteMetodoOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={submitDeleteMetodo} disabled={isViewer}>Excluir</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
