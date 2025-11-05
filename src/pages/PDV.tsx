"use client";

/**
 * PDV.tsx — POS multi-tenant compatível com seu schema
 * - Usa: public.pos_vendas + public.pos_venda_itens
 * - Baixa estoque em produtos.estoque_atual e registra em movimentacoes_estoque
 * - Pagamentos: public.pagamentos_diversos (tipo = 'loja')
 */
import FeatureGate from "@/components/FeatureGate";
import UpgradeCard from "@/components/UpgradeCard";
import { Upload, Download } from "lucide-react";
import * as XLSX from "xlsx";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/contexts/OrgContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SectionHeader } from "@/components/SectionHeader"; // no topo
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

import {
  Search, Barcode, ShoppingCart, Trash2, CreditCard, Percent,
  Package, PlusCircle, Save, Printer, ImageIcon, Pencil, X, FolderOpen,
  History, RefreshCcw
} from "lucide-react";

/* ================== Tipos ================== */
export type Produto = {
  id: string;
  nome: string;
  sku?: string | null;
  codigo_barras?: string | null;
  unidade?: string | null;
  preco_centavos: number;
  estoque_atual?: number | null;
  categoria_id?: string | null;
  ativo?: boolean | null;
  imagem_url?: string | null;
  descricao?: string | null;
};

export type Categoria = { id: string; nome: string; ativo?: boolean | null };

export type Membro = { id: string; nome: string; matricula?: string | null };

type MetodoPagamento = "PIX" | "Cartão" | "Dinheiro";

type VendaItem = {
  venda_id: string;
  produto_id: string;
  quantidade: number;
  preco_centavos: number;
  total_centavos: number;
  produto_nome?: string | null;
  produto_unidade?: string | null;
};

type Venda = {
  id: string;
  created_at: string;
  total_centavos: number;
  metodo_pagamento?: string | null;
  membro_id?: string | null;
  numero?: number | null; // <-- novo
  itens?: VendaItem[]; // ✅ add
};

/* ================== Helpers ================== */
const cents = (v: number) => Math.max(0, Math.round(v));
const fmt = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyStrToCents = (s: string) => {
  const clean = (s || "0").replace(/\./g, "").replace(",", ".");
  const val = Number.isFinite(parseFloat(clean)) ? parseFloat(clean) : 0;
  return cents(val * 100);
};
const intFromInput = (s: string) => {
  const n = parseInt(s || "0", 10);
  return Number.isFinite(n) ? n : 0;
};
// ✅ utilzinho seguro para obter range mesmo se vazio
function safeRange(ws: XLSX.WorkSheet): XLSX.Range {
  if (!ws["!ref"]) return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  return XLSX.utils.decode_range(ws["!ref"]);
}

// ✅ helper para criar uma sheet com cabeçalho (se a lista estiver vazia)
function sheetWithHeaders<T extends object>(rows: T[], headers: string[]) {
  if (rows.length > 0) return XLSX.utils.json_to_sheet(rows);

  // cria só o cabeçalho quando não há dados
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  return ws;
}
/* ============ ErrorBoundary ============ */
class NiceErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: any }> {
  constructor(props: any) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(error: any) {
    return { err: error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("[PDV] runtime error:", error, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div className="p-6">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle>Algo deu errado no PDV</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-destructive mb-2">{String(this.state.err?.message || this.state.err)}</p>
              <p className="text-muted-foreground">Veja o console do navegador para detalhes.</p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children as any;
  }
}

/* ================== Funções de Infra POS ================== */

/**
 * Cria a venda em `pos_vendas` e os itens em `pos_venda_itens`.
 * Depois baixa estoque em `produtos.estoque_atual` e registra em `movimentacoes_estoque`.
 */
/**
 * Cria a venda em `pos_vendas` e os itens em `pos_venda_itens`.
 * Depois valida saldo e registra apenas as saídas em `movimentacoes_estoque`
 * (não atualiza diretamente `produtos.estoque_atual`, evitando dupla baixa).
 */
async function createPosSale(
  supabaseClient: any,
  args: {
    org_id: string;
    terreiro_id: string;
    membro_id?: string | null;
    itens: { produto_id: string; qtd: number; preco_unit_centavos: number }[];
    subtotal_centavos: number;
    desconto_centavos?: number;
    total_centavos: number;
    pago_centavos: number;
    troco_centavos: number;
    metodo_pagamento: string;
    observacoes?: string | null;
    usuario_operacao?: string | null;
  }
) {
  const {
    org_id,
    terreiro_id,
    membro_id = null,
    itens,
    subtotal_centavos,
    desconto_centavos = 0,
    total_centavos,
    pago_centavos,
    troco_centavos,
    metodo_pagamento,
    observacoes = null,
    usuario_operacao = null,
  } = args;

  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("Nenhum item na venda.");
  }

  // ========= 0) Validação de saldo (AGORA filtra por org_id) =========
  const ids = itens.map((i) => i.produto_id);
  const { data: prodsCheck, error: checkErr } = await supabaseClient
    .from("produtos")
    .select("id, nome, estoque_atual")
    .in("id", ids)
    .eq("org_id", org_id);
  if (checkErr) throw checkErr;

  const estoqueMap = new Map<string, { nome: string; q: number }>(
    (prodsCheck || []).map((p: any) => [p.id, { nome: p.nome, q: Number(p.estoque_atual ?? 0) }])
  );

  for (const it of itens) {
    const reg = estoqueMap.get(it.produto_id) || { nome: "Produto", q: 0 };
    if ((it.qtd ?? 0) <= 0) {
      throw new Error(`Quantidade inválida para "${reg.nome}".`);
    }
    if (it.qtd > reg.q) {
      throw new Error(
        `Estoque insuficiente para "${reg.nome}". Disponível: ${reg.q}, solicitado: ${it.qtd}.`
      );
    }
  }

  // ========= 1) Cria a venda (pos_vendas) =========
  const { data: venda, error: vendaErr } = await supabaseClient
    .from("pos_vendas")
    .insert([
      {
        org_id,
        terreiro_id,
        membro_id,
        metodo_pagamento,
        subtotal_centavos,
        desconto_centavos,
        total_centavos,
        pago_centavos,
        troco_centavos,
        observacoes,
        usuario_operacao,
      },
    ])
    .select("id, created_at, total_centavos, metodo_pagamento, membro_id, numero")
    .single();
  if (vendaErr) throw vendaErr;

  // ========= 2) Insere os itens (com fallback para itens_venda se necessário) =========
  const itensRows = itens.map((i) => ({
    venda_id: venda.id,
    produto_id: i.produto_id,
    quantidade: i.qtd,
    preco_centavos: i.preco_unit_centavos,
    total_centavos: i.qtd * i.preco_unit_centavos,
    org_id,
    terreiro_id,
  }));

  async function insertItensFlex() {
    let res = await supabaseClient.from("pos_venda_itens").insert(itensRows);
    if (!res.error) return;
    if ((res.error as any)?.code === "42P01") {
      // ambiente sem pos_venda_itens → tenta itens_venda
      const compat = itensRows.map(({ org_id: _o, terreiro_id: _t, quantidade, preco_centavos, total_centavos, ...rest }: any) => ({
        venda_id: rest.venda_id,
        produto_id: rest.produto_id,
        qtd: quantidade,
        preco_unit_centavos: preco_centavos,
        subtotal_centavos: total_centavos,
      }));
      res = await supabaseClient.from("itens_venda").insert(compat);
    }
    if (res.error) throw res.error;
  }
  try {
    await insertItensFlex();
  } catch (itensErr) {
    await supabaseClient.from("pos_vendas").delete().eq("id", venda.id);
    throw itensErr;
  }

  // ========= 3) Registra movimentações de saída =========
  const movs = itens.map((it) => ({
    produto_id: it.produto_id,
    quantidade: it.qtd,
    tipo: "saida",
    referencia: "POS",
    pos_venda_id: venda.id,
    org_id,
    terreiro_id,
  }));
  const { error: movErr } = await supabaseClient.from("movimentacoes_estoque").insert(movs);
  if (movErr) {
    await supabaseClient.from("pos_venda_itens").delete().eq("venda_id", venda.id);
    await supabaseClient.from("pos_vendas").delete().eq("id", venda.id);
    throw movErr;
  }

  // ========= 4) (IMEDIATO) Atualiza estoque_atual localmente =========
  // Obs.: Se você criar o trigger no banco para refletir movimentacoes_estoque em produtos,
  // esta etapa pode ser removida.
  // ========= 4) NÃO ATUALIZA DIRETO O ESTOQUE (evita dupla baixa) =========
// Removido o loop que chamava `supabase.rpc("debita_estoque_se_disponivel", ...)`
// ou fazia UPDATE direto em `produtos.estoque_atual`.
// Agora a baixa fica **somente** pelas inserções em `movimentacoes_estoque`
// (e, se você usa trigger no banco, ele atualiza `produtos.estoque_atual`).


  return venda as {
    id: string;
    created_at: string;
    total_centavos: number;
    metodo_pagamento?: string | null;
    membro_id?: string | null;
    numero?: number | null; // <--- GARANTA QUE ESTÁ AQUI;
  };
}



/**
 * Registra o pagamento de PDV em `pagamentos_diversos` (tipo 'loja').
 */
// mude a assinatura para aceitar o numero
async function registrarPagamentoPOS(args: {
  venda_id: string;
  venda_numero?: number | null;
  org_id: string;
  terreiro_id: string;
  membro_id: string | null;
  total_centavos: number;
  metodo: string;
}) {
  const { venda_id, venda_numero, org_id, terreiro_id, membro_id, total_centavos, metodo } = args;

  // Buscar ID da forma de pagamento pelo código/nome
  const { data: formaData } = await supabase
    .from("formas_pagamento")
    .select("id")
    .or(`codigo.ilike.${metodo},nome.ilike.${metodo}`)
    .maybeSingle();

  const forma_pagamento_id = formaData?.id || null;
  
  if (!forma_pagamento_id) {
    console.warn(`Forma de pagamento não encontrada para: ${metodo}`);
  }

  const { error } = await supabase.from("pagamentos_diversos").insert({
    terreiro_id,
    membro_id,
    tipo: "loja",
    descricao: `PDV: venda ${venda_id}`,
    forma_pagamento_id,
    valor_centavos: total_centavos,
    usuario_operacao: "pdv",
    observacoes: "POS",
    pos_venda_id: venda_id,
  });

  if (error) throw error;
}


/* ================== Página ================== */
export default function PDVPage() {
  const { toast } = useToast();
  const { session } = useAuth();
  const { orgId: contextOrgId } = useOrg();

  // fallback org pelo profile
  const [fallbackOrgId, setFallbackOrgId] = useState<string | null>(null);
  const [fallbackOrgName, setFallbackOrgName] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [loadingOrg, setLoadingOrg] = useState<boolean>(false);

  

  const orgId = contextOrgId ?? fallbackOrgId;
  // no seu schema, terreiro_id = org_id
  const terreiroId = orgId;
  const orgName = fallbackOrgName ?? undefined;

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  // ===== Cliente
  const [clienteModo, setClienteModo] = useState<"avulso" | "membro">("avulso");
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [clienteQuery, setClienteQuery] = useState(""); // busca por nome | matrícula

  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [orgCNPJ, setOrgCNPJ] = useState<string | null>(null);
  const [orgEndereco, setOrgEndereco] = useState<string | null>(null);
  const [orgContato, setOrgContato] = useState<string | null>(null);
  // ===== Desconto
  const [descontoModo, setDescontoModo] = useState<"valor" | "percent">("valor")
  // ======= Estado principal (com persistência) =======
  const STORAGE_KEY = "pdv_state_v2";

  const [activeTab, setActiveTab] = useState<"vender" | "produtos" | "categorias" | "lista" | "historico">("vender");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");

  const [cart, setCart] = useState<{ produto: Produto; quantidade: number }[]>([]);
  const [selectedMembro, setSelectedMembro] = useState<string | null>(null);

  const [descontoReais, setDescontoReais] = useState<string>("0,00");
  const [descontoPercent, setDescontoPercent] = useState<string>("0");
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>("PIX");
  const [pagoReais, setPagoReais] = useState<string>("0,00");

  const [isFinishing, setIsFinishing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<{
    venda_id?: string;
    venda_numero?: number | null; 
    itens: { produto: Produto; quantidade: number }[];
    subtotal: number; desconto: number; total: number; pago: number; troco: number; membro_nome?: string;
  } | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // produto rápido
  const [pNome, setPNome] = useState("");
  const [pSku, setPSku] = useState("");
  const [pBarras, setPBarras] = useState("");
  const [pUnidade, setPUnidade] = useState("un");
  const [pPreco, setPPreco] = useState("0,00");
  const [pEstoque, setPEstoque] = useState(0);
  const [pCategoria, setPCategoria] = useState<string | null>(null);
  const [pDescricao, setPDescricao] = useState("");
  const [pArquivo, setPArquivo] = useState<File | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // categorias
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<Categoria | null>(null);
  const [catNome, setCatNome] = useState("");

  // edição produto
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [edNome, setEdNome] = useState("");
  const [edSku, setEdSku] = useState("");
  const [edBarras, setEdBarras] = useState("");
  const [edUnidade, setEdUnidade] = useState("un");
  const [edPreco, setEdPreco] = useState("0,00");
  const [edEstoque, setEdEstoque] = useState(0);
  const [edCategoria, setEdCategoria] = useState<string | null>(null);
  const [edDescricao, setEdDescricao] = useState("");
  const [edArquivo, setEdArquivo] = useState<File | null>(null);

  // histórico
  const [historico, setHistorico] = useState<Venda[]>([]);
  const [historicoTable, setHistoricoTable] = useState<string | null>(null);
  const [historicoSearch, setHistoricoSearch] = useState("");
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // confirmação de reembolso
  const [confirmRefundOpen, setConfirmRefundOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<{ id: string } | null>(null);
  const openRefundDialog = (id: string) => {
    setRefundTarget({ id });
    setConfirmRefundOpen(true);
  };

  /* ============ Persistência (load) ============ */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.activeTab) setActiveTab(s.activeTab);
      if (Array.isArray(s.cart)) setCart(s.cart);
      if (typeof s.selectedMembro !== "undefined") setSelectedMembro(s.selectedMembro);
      if (typeof s.descontoReais === "string") setDescontoReais(s.descontoReais);
      if (typeof s.descontoPercent === "string") setDescontoPercent(s.descontoPercent);
      if (typeof s.metodoPagamento === "string") setMetodoPagamento(s.metodoPagamento);
      if (typeof s.pagoReais === "string") setPagoReais(s.pagoReais);
    } catch {}
  }, []);

  /* ============ Persistência (save) ============ */
  useEffect(() => {
    const state = {
      activeTab,
      cart,
      selectedMembro,
      descontoReais,
      descontoPercent,
      metodoPagamento,
      pagoReais,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [activeTab, cart, selectedMembro, descontoReais, descontoPercent, metodoPagamento, pagoReais]);

  /* ============ Aviso sair com carrinho cheio ============ */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (cart.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [cart.length]);

  /* ============ Fallback de org ============ */
  useEffect(() => {
    if (contextOrgId || fallbackOrgId || !session?.user?.id) return;
    setLoadingOrg(true);
    (async () => {
      try {
        const { data: pfRows, error: e1 } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (e1) throw e1;

        const pfOrgId = pfRows?.[0]?.org_id ?? null;
        setFallbackOrgId(pfOrgId);

        if (pfOrgId) {
          const { data: t, error: e2 } = await supabase
            .from("terreiros")
            .select("id, nome")
            .eq("id", pfOrgId)
            .maybeSingle();
          if (!e2 && t?.nome) setFallbackOrgName(t.nome);
        }
      } catch (err: any) {
        console.error("[PDV] fallback org error:", err);
        toast({
          title: "Falha ao detectar sua organização",
          description: err?.message || String(err),
          variant: "destructive",
        });
      } finally {
      setLoadingOrg(false);
    }
    })();
  }, [contextOrgId, fallbackOrgId, session?.user?.id, toast]);

  /* ============ Loads ============ */
  const loadAll = async (oid: string) => {
    try {
      const { data: cats, error: e1 } = await supabase
        .from("categorias_produtos")
        .select("id, nome, ativo")
        .eq("org_id", oid)
        .order("nome");
      if (e1) throw e1;
      setCategorias(cats || []);

      const { data: prods, error: e2 } = await supabase
        .from("produtos")
        .select("*")
        .eq("org_id", oid)
        .eq("ativo", true)
        .order("nome");
      if (e2) throw e2;
      setProdutos((prods as Produto[]) || []);

      const { data: mems, error: e3 } = await supabase
        .from("membros")
        .select("id, nome, matricula") // <— add matricula
        .eq("org_id", oid)
        .eq("ativo", true)
        .order("nome");
      if (e3) throw e3;
      setMembros(mems || []);
    } catch (err: any) {
      console.error("[PDV] load error:", err);
      toast({
        title: "Falha ao carregar dados",
        description: err?.message || String(err),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (orgId) loadAll(orgId);
  }, [orgId]);

  /* ============ Histórico de vendas (POS) ============ */
  const mapVendaRow = (row: any): Venda => ({
    id: String(row?.id ?? ""),
    created_at: row?.created_at ?? new Date().toISOString(),
    total_centavos: Number(row?.total_centavos ?? 0) || 0,
    metodo_pagamento: row?.metodo_pagamento ?? null,
    membro_id: row?.membro_id ?? null,
    numero: row?.numero ?? null, // <---
  });

  const loadHistorico = async (oid: string) => {
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from("pos_vendas")
        .select("*")
        .eq("org_id", oid)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const parsed = (data || []).map(mapVendaRow).filter(v => v.id);

      if (parsed.length) {
        const ids = parsed.map(v => v.id);
        const { data: itens, error: itErr } = await supabase
          .from("pos_venda_itens")
          .select("venda_id, produto_id, quantidade, preco_centavos, total_centavos")
          .in("venda_id", ids);
        if (!itErr && itens?.length) {
          const prodIds = Array.from(new Set(itens.map(i => i.produto_id)));
          const { data: prods } = await supabase
            .from("produtos")
            .select("id, nome, unidade")
            .in("id", prodIds);
          const prodMap = new Map((prods || []).map(p => [p.id, p]));
          const itensByVenda = new Map<string, VendaItem[]>();
          for (const it of itens) {
            const p = prodMap.get(it.produto_id);
            const enr: VendaItem = {
              ...it,
              produto_nome: (p as any)?.nome ?? null,
              produto_unidade: (p as any)?.unidade ?? null,
            } as any;
            const arr = itensByVenda.get(it.venda_id) || [];
            arr.push(enr);
            itensByVenda.set(it.venda_id, arr);
          }
          parsed.forEach(v => { v.itens = itensByVenda.get(v.id) || []; });
        }
      }

      setHistorico(parsed);
      setHistoricoTable("pos_vendas");
    } catch (e: any) {
      console.warn("[PDV] histórico POS falhou:", e?.message || e);
      setHistorico([]);
      setHistoricoTable(null);
    } finally {
      setLoadingHistorico(false);
    }
  };

  useEffect(() => {
    if (activeTab === "historico" && orgId) loadHistorico(orgId);
  }, [activeTab, orgId]);

  const loadOrgPublicData = React.useCallback(async (oid: string) => {
    try {
      const { data, error } = await supabase
        .from("terreiros")
        .select("id, nome, cnpj, logo_url, endereco, telefone, email, whatsapp, site, bairro, cidade, estado, cep")
        .eq("id", oid)
        .maybeSingle();

      if (error && (error as any)?.code !== "42703") throw error;

      if (data) {
        setFallbackOrgName(data.nome ?? null);
        setOrgLogo(data.logo_url ?? null);
        setOrgCNPJ(data.cnpj ?? null);
        
        const enderecoFmt = [
          data.endereco,
          data.bairro,
          data.cidade && data.estado ? `${data.cidade}/${data.estado}` : data.cidade || data.estado,
          data.cep
        ].filter(Boolean).join(' • ');
        setOrgEndereco(enderecoFmt || null);

        const contatoFmt = [data.telefone, data.whatsapp, data.email, data.site]
          .filter(Boolean).join(' • ');
        setOrgContato(contatoFmt || null);
        return;
      }

      const { data: d2 } = await supabase
        .from("terreiros")
        .select("id, nome")
        .eq("id", oid)
        .maybeSingle();

      if (d2) setFallbackOrgName(d2.nome ?? null);
    } catch (e) {
      console.warn("[PDV] org public load fallback:", e);
    }
  }, []);

useEffect(() => {
  if (orgId) loadOrgPublicData(orgId);
}, [orgId, loadOrgPublicData]);

  /* ============ Catálogo / Carrinho ============ */
  const visibleProdutos = useMemo(() => {
    let list = produtos;
    if (cat) list = list.filter((p) => p.categoria_id === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.nome.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q) ||
          (p.codigo_barras || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [produtos, cat, search]);
  const membrosFiltrados = useMemo(() => {
  const q = clienteQuery.trim().toLowerCase();
  if (!q) return membros;
  return membros.filter(m =>
    (m.nome || "").toLowerCase().includes(q) ||
    (m.matricula || "").toLowerCase().includes(q)
  );
}, [membros, clienteQuery]);

  const addToCart = (produto: Produto, qtt = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((ci) => ci.produto.id === produto.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantidade: copy[idx].quantidade + qtt };
        return copy;
      }
      return [...prev, { produto, quantidade: qtt }];
    });
  };
  const removeFromCart = (id: string) => setCart((prev) => prev.filter((ci) => ci.produto.id !== id));
  const updateQty = (id: string, qtt: number) =>
    setCart((prev) => prev.map((ci) => (ci.produto.id === id ? { ...ci, quantidade: Math.max(1, qtt || 1) } : ci)));
  const clearCart = () => setCart([]);

  const subtotal = useMemo(
    () => cart.reduce((sum, ci) => sum + cents(ci.produto.preco_centavos * ci.quantidade), 0),
    [cart]
  );

  const descontoManualCentavos = useMemo(() => {
    const valorReaisCents = moneyStrToCents(descontoReais);
    const pct = Number.isFinite(parseFloat(descontoPercent)) ? Math.max(0, Math.min(100, parseFloat(descontoPercent))) : 0;

    const byValue = Math.min(subtotal, valorReaisCents);
    const byPct   = Math.min(subtotal, Math.round((subtotal * pct) / 100));

    return descontoModo === "valor" ? byValue : byPct;
  }, [descontoReais, descontoPercent, subtotal, descontoModo]);


  const total = useMemo(() => Math.max(0, subtotal - descontoManualCentavos), [subtotal, descontoManualCentavos]);
  const pagoCentavos = useMemo(() => moneyStrToCents(pagoReais), [pagoReais]);
  const troco = useMemo(() => Math.max(0, pagoCentavos - total), [pagoCentavos, total]);

  const onBarcodeEnter = async () => {
    const code = barcode.trim();
    if (!code || !orgId) return;
    const local = produtos.find((p) => p.codigo_barras && p.codigo_barras === code);
    if (local) {
      addToCart(local, 1);
      setBarcode("");
      return;
    }
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("org_id", orgId)
      .eq("codigo_barras", code)
      .maybeSingle();
    if (error) {
      console.error(error);
      toast({ title: "Busca falhou", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      addToCart(data as Produto, 1);
      setBarcode("");
    } else {
      toast({ title: "Código não encontrado", description: `Nenhum produto com código ${code}.`, variant: "destructive" });
    }
  };

  /* ============ Finalização (POS) ============ */
  const finishSale = async (print = true) => {
    if (!orgId || !terreiroId) {
      toast({ title: "Selecione uma organização", description: "org_id/terreiro_id ausente.", variant: "destructive" });
      return;
    }

    if (cart.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione itens para finalizar.", variant: "destructive" });
      return;
    }

    if (pagoCentavos < total) {
      toast({ title: "Pagamento insuficiente", description: "Valor pago é menor que o total.", variant: "destructive" });
      return;
    }

    setIsFinishing(true);
    try {
      const itensForInsert = cart.map(ci => ({
        produto_id: ci.produto.id,
        qtd: Number(ci.quantidade) || 1,
        preco_unit_centavos: cents(ci.produto.preco_centavos),
      }));

      const venda = await createPosSale(supabase, {
        org_id: String(orgId),
        terreiro_id: String(terreiroId),
        membro_id: selectedMembro ? String(selectedMembro) : null,
        itens: itensForInsert,
        subtotal_centavos: subtotal,
        desconto_centavos: descontoManualCentavos,
        total_centavos: total,
        pago_centavos: pagoCentavos,
        troco_centavos: troco,
        metodo_pagamento: metodoPagamento,
        observacoes: null,
        usuario_operacao: session?.user?.email || session?.user?.id || "pdv",
      });

      await registrarPagamentoPOS({
        venda_id: venda.id,
        venda_numero: venda.numero ?? null,   // <<< agora passa o número
        org_id: String(orgId),
        terreiro_id: String(terreiroId),
        membro_id: selectedMembro,
        total_centavos: total,
        metodo: metodoPagamento,
      });

      const snapshot = {
        venda_id: venda.id,
        venda_numero: venda.numero ?? null,
        itens: cart,
        subtotal,
        desconto: descontoManualCentavos,
        total,
        pago: pagoCentavos,
        troco,
        membro_nome: selectedMembro ? (membros.find(m => m.id === selectedMembro)?.nome || undefined) : undefined,
        metodo: metodoPagamento,
      };
      setLastSale(snapshot);

      if (print) {
        try {
          imprimirCupomPDV(
            {
              venda_id: snapshot.venda_id,
              venda_numero: snapshot.venda_numero, // <<-- AQUI!
              itens: snapshot.itens,
              subtotal: snapshot.subtotal,
              desconto: snapshot.desconto,
              total: snapshot.total,
              pago: snapshot.pago,
              troco: snapshot.troco,
              membro_nome: snapshot.membro_nome,
            },
            orgName || String(orgId),
            metodoPagamento
          );
        } catch {}
      }
      setShowReceipt(!print);
      clearCart();
      setPagoReais("0,00");
      setDescontoReais("0,00");
      setDescontoPercent("0");
      toast({
        title: "Venda concluída",
        description: `#${venda.numero ?? venda.id} — ${fmt(total)}`
      });

      if (orgId) {
        await loadAll(orgId);
        await loadHistorico(orgId);
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao finalizar", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIsFinishing(false);
    }
  };


  /* ============ Cancelamento / Reembolso (POS) ============ */

  const actuallyRefund = async () => {
    if (!orgId || !refundTarget?.id) return;
    const vendaId = refundTarget.id;

    try {
      // 1) Reverter estoque: apaga movimentações de SAÍDA desta venda
      const { error: delMovErr } = await supabase
        .from("movimentacoes_estoque")
        .delete()
        .eq("org_id", orgId)
        .eq("pos_venda_id", vendaId)
        .eq("tipo", "saida");
      if (delMovErr) throw delMovErr;

      // 2) Apagar o pagamento gerado pelo PDV (usa pos_venda_id)
      const { error: delPagErr } = await supabase
        .from("pagamentos_diversos")
        .delete()
        .eq("org_id", orgId)
        .eq("tipo", "loja")
        .eq("pos_venda_id", vendaId);
      if (delPagErr) throw delPagErr;

      // 3) Apagar itens da venda
      const { error: delItensErr } = await supabase
        .from("pos_venda_itens")
        .delete()
        .eq("org_id", orgId)
        .eq("venda_id", vendaId);
      if (delItensErr) throw delItensErr;

      // 4) Apagar a venda
      const { error: delVendaErr } = await supabase
        .from("pos_vendas")
        .delete()
        .eq("org_id", orgId)
        .eq("id", vendaId);
      if (delVendaErr) throw delVendaErr;

      toast({ title: "Reembolso concluído", description: `Venda ${vendaId} cancelada.` });
      setConfirmRefundOpen(false);
      setRefundTarget(null);
      await Promise.all([loadHistorico(orgId), loadAll(orgId)]);
    } catch (e: any) {
      toast({ title: "Falha ao reembolsar", description: e?.message || String(e), variant: "destructive" });
    }
  };



  /* ============ Cupom HTML (modelo Mensalidades / 80mm) ============ */

function abrirJanelaCupomPDV(html: string) {
  // cria iframe oculto
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  // usar srcdoc evita document.open/write e mantém mesma origem
  (iframe as any).srcdoc = html;
  document.body.appendChild(iframe);

  const cleanup = () => {
    try { document.body.removeChild(iframe); } catch {}
  };

  // **Escute no elemento iframe**, não no contentWindow
  iframe.addEventListener("load", () => {
    const w = iframe.contentWindow;
    if (!w) { cleanup(); return; }
    try {
      // aguarda um frame para layout/render
      requestAnimationFrame(() => {
        try { w.focus(); w.print(); } catch (e) { console.error("[PDV] print erro:", e); }
        // alguns browsers não disparam afterprint no iframe; faça cleanup por timeout
        setTimeout(cleanup, 1000);
      });
    } catch (e) {
      console.error("[PDV] print erro:", e);
      cleanup();
    }
  }, { once: true });

  // fallback duro (se load nunca vier)
  setTimeout(cleanup, 15000);
}


function gerarCupomHTMLPDV(args: {
  orgNome: string;
  orgLogo?: string | null;
  orgCNPJ?: string | null;
  orgEndereco?: string | null;
  orgContato?: string | null;
  membro?: string | null;
  vendaNumero?: number | null;
  metodo: string;
  itens: { nome: string; qtd: number; unit_cent: number }[];
  subtotal_cent: number;
  desconto_cent: number;
  total_cent: number;
  pago_cent: number;
  troco_cent: number;
}) {
  const fmtBRL = (c: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
      .format((c || 0) / 100);

  const dataHora = new Date().toLocaleString("pt-BR");

  const linhas = args.itens
    .map((it) => {
      const linhaTotal = fmtBRL(it.qtd * it.unit_cent);
      return `<tr>
        <td style="text-align:left">${(it.nome || "").toUpperCase()}</td>
        <td style="text-align:center">${it.qtd}</td>
        <td style="text-align:right">${linhaTotal}</td>
      </tr>`;
    })
    .join("");

  const linhaDesconto =
    args.desconto_cent > 0
      ? `<div class="muted">Desconto: - ${fmtBRL(args.desconto_cent)}</div>`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Cupom</title>
<style>
  @page { size: 80mm auto; margin: 6mm; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  .wrap { width: 80mm; max-width: 80mm; }
  .center { text-align: center; }
  .logo { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; margin-bottom: 4px; }
  .title { font-weight: 700; margin: 6px 0; }
  .muted { color: #444; font-size: 10px; line-height: 1.3; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0; }
  th, td { padding: 4px 0; }
  th { text-align: left; border-bottom: 1px dashed #999; }
  tbody td { border-bottom: 1px dashed #999; }
  .tot { border-top: 1px dashed #999; padding-top: 6px; margin-top: 4px; font-weight: 700; }
  .foot { border-top: 1px dashed #999; margin-top: 8px; padding-top: 6px; font-size: 10px; text-align: center; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      ${args.orgLogo ? `<img src="${args.orgLogo}" class="logo" />` : ``}
      <div class="title">${args.orgNome || "Comprovante"}</div>
      <div class="muted">
        ${args.orgCNPJ ? `CNPJ: ${args.orgCNPJ}<br/>` : ``}
        ${args.orgEndereco ? `${args.orgEndereco}<br/>` : ``}
        ${args.orgContato ? `${args.orgContato}` : ``}
      </div>
    </div>

    <div class="muted" style="margin-top:6px">Data/Hora: ${dataHora}</div>
    ${typeof args.vendaNumero === "number" ? `<div class="muted">Venda nº: ${args.vendaNumero}</div>` : ``}
    <div class="muted">Método: ${args.metodo || "-"}</div>
    <div class="muted">Cliente: ${args.membro || "Avulso"}</div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center">Qtd</th>
          <th style="text-align:right">Valor</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>

    <div class="muted">Subtotal: ${fmtBRL(args.subtotal_cent)}</div>
    ${linhaDesconto}
    <div class="tot">Total: ${fmtBRL(args.total_cent)}</div>
    <div class="muted">Pago: ${fmtBRL(args.pago_cent)}</div>
    ${args.troco_cent > 0 ? `<div class="muted">Troco: ${fmtBRL(args.troco_cent)}</div>` : ``}

    <div class="foot">Obrigado pela preferência.<br/>Este documento não substitui NF-e.</div>
  </div>
</body>
</html>`;
}





function imprimirCupomPDV(
  snap: {
    venda_id?: string;
    venda_numero?: number | null;
    itens: { produto: { nome: string; preco_centavos: number }; quantidade: number }[];
    subtotal: number; desconto: number; total: number; pago: number; troco: number;
    membro_nome?: string;
  },
  orgNome: string,
  metodo: string
) {
  const itens = snap.itens.map(i => ({
    nome: i.produto.nome,
    qtd: i.quantidade,
    unit_cent: i.produto.preco_centavos,
  }));

  const html = gerarCupomHTMLPDV({
    orgNome,
    orgLogo,       // ← vem do useState do componente
    orgCNPJ,
    orgEndereco,
    orgContato,
    membro: snap.membro_nome ?? "Avulso",
    vendaNumero: snap.venda_numero ?? null,
    metodo,
    itens,
    subtotal_cent: snap.subtotal,
    desconto_cent: snap.desconto,
    total_cent: snap.total,
    pago_cent: snap.pago,
    troco_cent: snap.troco,
  });

  abrirJanelaCupomPDV(html);
}





  /* ============ Upload de imagem ============ */
  async function uploadImagem(file: File, pathHint: string) {
    if (!orgId || !file) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const key = `org/${orgId}/${pathHint}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("produtos").upload(key, file, { upsert: true });
    if (upErr) {
      toast({ title: "Falha no upload", description: upErr.message, variant: "destructive" });
      return null;
    }
    const { data: pub } = supabase.storage.from("produtos").getPublicUrl(key);
    return pub?.publicUrl ?? null;
  }

  /* ============ Cadastro de Produto ============ */
  const salvarProduto = async () => {
    if (!orgId || !terreiroId) {
      toast({ title: "Selecione um terreiro", variant: "destructive" });
      return;
    }
    if (!pNome.trim()) {
      toast({ title: "Informe o nome do produto", variant: "destructive" });
      return;
    }
    setSavingProduct(true);
    try {
      let imagem_url: string | null = null;
      if (pArquivo) imagem_url = await uploadImagem(pArquivo, editingProductId ? editingProductId : "novo");

      const preco = moneyStrToCents(pPreco);

      if (editingProductId) {
        // UPDATE
        const { data, error } = await supabase
          .from("produtos")
          .update({
            nome: pNome.trim(),
            sku: pSku || null,
            codigo_barras: pBarras || null,
            unidade: pUnidade || "un",
            preco_centavos: preco,
            estoque_atual: Number.isFinite(pEstoque) ? pEstoque : 0,
            categoria_id: pCategoria || null,
            descricao: pDescricao || null,
            ...(imagem_url ? { imagem_url } : {}),
          })
          .eq("id", editingProductId)
          .eq("org_id", orgId)
          .select("*")
          .single();
        if (error) throw error;

        setProdutos((prev) =>
          prev.map((x) => (x.id === editingProductId ? (data as Produto) : x)).sort((a, b) => a.nome.localeCompare(b.nome))
        );
        toast({ title: "Produto atualizado", description: data?.nome });

      } else {
        // INSERT
        const { data, error } = await supabase
          .from("produtos")
          .insert({
            nome: pNome.trim(),
            sku: pSku || null,
            codigo_barras: pBarras || null,
            unidade: pUnidade || "un",
            preco_centavos: preco,
            estoque_atual: Number.isFinite(pEstoque) ? pEstoque : 0,
            categoria_id: pCategoria || null,
            descricao: pDescricao || null,
            imagem_url,
            ativo: true,
            org_id: orgId,
            terreiro_id: terreiroId,
          })
          .select("*")
          .single();
        if (error) throw error;

        setProdutos((prev) => [...prev, data as Produto].sort((a, b) => a.nome.localeCompare(b.nome)));
        toast({ title: "Produto salvo", description: data?.nome });
      }

      // Limpa o formulário e sai do modo edição
      setEditingProductId(null);
      setPNome(""); setPSku(""); setPBarras(""); setPUnidade("un");
      setPPreco("0,00"); setPEstoque(0); setPCategoria(null); setPDescricao(""); setPArquivo(null);
      setActiveTab("lista");

    } catch (e: any) {
      toast({ title: "Erro ao salvar produto", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSavingProduct(false);
    }
  };


  /* ============ Categorias ============ */
  const openNewCategory = () => { setCatEditing(null); setCatNome(""); setCatModalOpen(true); };
  const openEditCategory = (c: Categoria) => { setCatEditing(c); setCatNome(c.nome); setCatModalOpen(true); };

  const saveCategory = async () => {
    if (!orgId) return;
    try {
      if (catEditing) {
        const { error } = await supabase.from("categorias_produtos")
          .update({ nome: catNome.trim() })
          .eq("id", catEditing.id)
          .eq("org_id", orgId);
        if (error) throw error;
        setCategorias((prev) => prev.map((x) => x.id === catEditing.id ? { ...x, nome: catNome.trim() } : x));
        toast({ title: "Categoria atualizada" });
      } else {
        const { data, error } = await supabase.from("categorias_produtos")
          .insert({ nome: catNome.trim(), ativo: true, org_id: orgId, terreiro_id: orgId })
          .select("id, nome, ativo")
          .single();
        if (error) throw error;
        setCategorias((prev) => [...prev, data as Categoria].sort((a, b) => a.nome.localeCompare(b.nome)));
        toast({ title: "Categoria criada" });
      }
    } catch (e: any) {
      toast({ title: "Erro nas categorias", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setCatModalOpen(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!orgId) return;
    try {
      await supabase.from("categorias_produtos").delete().eq("id", id).eq("org_id", orgId);
      setCategorias((prev) => prev.filter((x) => x.id !== id));
      toast({ title: "Categoria removida" });
    } catch (e: any) {
      toast({ title: "Erro ao remover", description: e?.message || String(e), variant: "destructive" });
    }
  };

  const deleteProduto = async (id: string) => {
    if (!orgId) return;
    try {
      const { error } = await supabase
        .from("produtos")
        .delete()
        .eq("id", id)
        .eq("org_id", orgId);
      if (error) throw error;

      setProdutos((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Produto removido" });
    } catch (e: any) {
      toast({
        title: "Erro ao remover produto",
        description: e?.message || String(e),
        variant: "destructive",
      });
    }
  };

  /* ============ Edição Produto ============ */
const openEditProduto = (p: Produto) => {
  // Preenche o formulário de cadastro com os dados do produto
  setEditingProductId(p.id);
  setPNome(p.nome || "");
  setPSku(p.sku || "");
  setPBarras(p.codigo_barras || "");
  setPUnidade(p.unidade || "un");
  setPPreco((p.preco_centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  setPEstoque(p.estoque_atual ?? 0);
  setPCategoria(p.categoria_id || null);
  setPDescricao(p.descricao || "");
  setPArquivo(null);

  // Vai para a aba Produtos
  setActiveTab("produtos");
};



  const saveEditProduto = async () => {
    if (!orgId || !editing) return;
    try {
      let imagem_url = editing.imagem_url || null;
      if (edArquivo) {
        const newUrl = await uploadImagem(edArquivo, editing.id);
        if (newUrl) imagem_url = newUrl;
      }
      const preco = moneyStrToCents(edPreco);
      const { data, error } = await supabase
        .from("produtos")
        .update({
          nome: edNome.trim(),
          sku: edSku || null,
          codigo_barras: edBarras || null,
          unidade: edUnidade || "un",
          preco_centavos: preco,
          estoque_atual: Number.isFinite(edEstoque) ? edEstoque : 0,
          categoria_id: edCategoria || null,
          descricao: edDescricao || null,
          imagem_url,
        })
        .eq("id", editing.id)
        .eq("org_id", orgId)
        .select("*")
        .single();
      if (error) throw error;

      setProdutos((prev) => prev.map((x) => (x.id === editing.id ? (data as Produto) : x)).sort((a, b) => a.nome.localeCompare(b.nome)));
      toast({ title: "Produto atualizado" });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar produto", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setProdModalOpen(false);
    }
  };


const handleExportProdutosXLSX = () => {
  const rows = produtos.map((p) => ({
    Nome: p.nome,
    SKU: p.sku ?? "",
    CodigoBarras: p.codigo_barras ?? "",
    Unidade: p.unidade ?? "un",
    "Preço (R$)": (p.preco_centavos ?? 0) / 100,
    EstoqueAtual: p.estoque_atual ?? 0,
    Categoria: categorias.find((c) => c.id === p.categoria_id)?.nome ?? "",
    Descricao: p.descricao ?? "",
    Ativo: p.ativo ? "Sim" : "Não",
  }));

  const headers = [
    "Nome",
    "SKU",
    "CodigoBarras",
    "Unidade",
    "Preço (R$)",
    "EstoqueAtual",
    "Categoria",
    "Descricao",
    "Ativo",
  ];

  const ws = sheetWithHeaders(rows, [
    "Nome", "SKU", "CodigoBarras", "Unidade", "Preço (R$)", 
    "EstoqueAtual", "Categoria", "Descricao", "Ativo"
  ]);
  const range = safeRange(ws);

  // ✅ Autofiltro no cabeçalho (uso correto de encode_range)
  ws["!autofilter"] = { ref: XLSX.utils.encode_range(range) };

  // (Opcional) Congelar linha 1 corretamente
  (ws as any)["!pane"] = { state: "frozen", ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };

  // Larguras
  ws["!cols"] = [
    { wch: 28 }, // Nome
    { wch: 14 }, // SKU
    { wch: 16 }, // CodigoBarras
    { wch: 8  }, // Unidade
    { wch: 14 }, // Preço (R$)
    { wch: 14 }, // EstoqueAtual
    { wch: 18 }, // Categoria
    { wch: 32 }, // Descricao
    { wch: 10 }, // Ativo
  ];

  // Formato monetário na coluna "Preço (R$)" (c = 4)
  // Começa em r=1 para pular o cabeçalho
  for (let r = 1; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 4 });
    const cell = ws[addr];
    if (cell && typeof cell.v === "number") {
      cell.t = "n";
      cell.z = 'R$ #,##0.00';
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");

  const nome = `produtos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, nome);
};



const importInputRef = useRef<HTMLInputElement | null>(null);

const handleOpenImport = () => {
  importInputRef.current?.click();
};

// Converte "preco" em reais (ex.: "12,50") -> centavos
const reaisToCentavos = (v: string) => {
  if (!v) return 0;
  const clean = v.replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const onImportXLSX = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws);

  for (const r of rows) {
    const nome = r["Nome"]?.toString().trim();
    if (!nome) continue;

    // Se vier "Preço (R$)" no template/export novo:
    const precoReais = Number(r["Preço (R$)"]) || 0;
    const preco_centavos = Math.round(precoReais * 100);

    await supabase.from("produtos").upsert({
      nome,
      sku: r["SKU"] || null,
      codigo_barras: r["CodigoBarras"] || null,
      unidade: r["Unidade"] || "un",
      preco_centavos,
      estoque_atual: Number(r["EstoqueAtual"]) || 0,
      descricao: r["Descricao"] || null,
      ativo: String(r["Ativo"] ?? "Sim").toLowerCase().startsWith("s"),
      org_id: orgId,
      terreiro_id: orgId,
      // Dica: se quiser mapear Categoria por nome -> categoria_id, faça um lookup nas suas categorias aqui
    });
  }

  toast({ title: "Importação concluída", description: `${rows.length} produto(s) processados.` });
};


const handleDownloadTemplateXLSX = () => {
  const exampleRows = [
    {
      Nome: "Vela palito branca",
      SKU: "VELA-PAL-BR",
      CodigoBarras: "7891234567890",
      Unidade: "un",
      "Preço (R$)": 3.50,          // mostramos em reais no template
      EstoqueAtual: 100,
      Categoria: "Velas",
      Descricao: "Vela palito 20cm",
      Ativo: "Sim",                // Sim/Não
    },
  ];

  const ws = XLSX.utils.json_to_sheet(exampleRows);
  const range = safeRange(ws);

  ws["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
  (ws as any)["!pane"] = { state: "frozen", ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };

  ws["!cols"] = [
    { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 8  },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 32 }, { wch: 10 },
  ];

  // Formatar "Preço (R$)" (c = 4)
  for (let r = 1; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 4 });
    const cell = ws[addr];
    if (cell && typeof cell.v === "number") {
      cell.t = "n";
      cell.z = 'R$ #,##0.00';
    }
  }

  // Aba Dicionário
  const wsDic = XLSX.utils.json_to_sheet([
    { Campo: "Ativo", Opcoes: "Sim | Não" },
    { Campo: "Unidade", Opcoes: "un | pct | cx | kg | lt" },
    { Campo: "Observação", Opcoes: "Na importação, o 'Preço (R$)' será convertido para centavos." },
  ]);
  wsDic["!cols"] = [{ wch: 18 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.utils.book_append_sheet(wb, wsDic, "Dicionário");

  XLSX.writeFile(wb, "produtos_template.xlsx");
};



  /* ============ UI: Vender ============ */
  const venderTab = (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Busca / catálogo */}
      <div className="xl:col-span-2 space-y-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" />
              Buscar produtos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              <div className="lg:col-span-2 flex items-center gap-2">
                <Input placeholder="Nome, SKU ou código de barras" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
              </div>
              <div className="flex items-center gap-2">
                <Input placeholder="Leitor de código de barras" value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onBarcodeEnter(); }} className="h-9" />
                <Button variant="secondary" onClick={onBarcodeEnter} title="Adicionar por código" className="h-9 px-3">
                  <Barcode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge onClick={() => setCat(null)} className={`cursor-pointer ${cat === null ? "bg-primary text-primary-foreground" : ""}`}>Todas</Badge>
              {categorias.map((c) => (
                <Badge key={c.id} onClick={() => setCat(c.id)} className={`cursor-pointer ${cat === c.id ? "bg-primary text-primary-foreground" : ""}`}>{c.nome}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4" />
              Catálogo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[42vh] md:h-[50vh] xl:h-[calc(100vh-25rem)] pr-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {visibleProdutos.map((p) => (
                  <button key={p.id} onClick={() => addToCart(p, 1)} className="group text-left border rounded-lg p-2 hover:shadow-md transition flex flex-col gap-2">
                    <div className="aspect-square w-full rounded-md bg-muted overflow-hidden">
                      {p.imagem_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center"><ImageIcon className="opacity-40" /></div>
                      )}
                    </div>
                    <div className="text-[13px] font-medium line-clamp-2">{p.nome}</div>
                    <div className="text-[11px] text-muted-foreground">{p.sku || p.codigo_barras || p.unidade || ""}</div>
                    <div className="mt-auto text-sm font-semibold">{fmt(p.preco_centavos)}</div>
                  </button>
                ))}
                {visibleProdutos.length === 0 && <div className="col-span-full text-sm text-muted-foreground">Nenhum produto encontrado.</div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>


      <div className="xl:col-span-3 space-y-4">

{/* =================== CARRINHO =================== */}
        <Card className="sticky top-24 self-start">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Carrinho
            </CardTitle>
          </CardHeader>

          <CardContent className="max-h-[calc(100vh-7rem)] overflow-auto">
            {/* ===== Cliente ===== */}
            <div className="mb-3 space-y-2">
              <Label className="text-xs block">Cliente</Label>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={clienteModo === "avulso" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setClienteModo("avulso"); setSelectedMembro(null); }}
                >
                  Avulso
                </Button>

                <Button
                  type="button"
                  variant={clienteModo === "membro" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setClienteModo("membro"); setClienteDialogOpen(true); }}
                >
                  Selecionar membro
                </Button>

                {selectedMembro && (
                  <Badge variant="secondary" className="ml-1">
                    {(() => {
                      const m = membros.find(mm => mm.id === selectedMembro);
                      return m ? `${m.nome}${m.matricula ? ` • ${m.matricula}` : ""}` : selectedMembro;
                    })()}
                  </Badge>
                )}
              </div>

              {/* Dialog — busca por Nome ou Matrícula */}
              <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Selecionar membro</DialogTitle>
                    <DialogDescription>Busque por nome ou matrícula.</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2">
                    <Input
                      autoFocus
                      placeholder="Digite nome ou matrícula..."
                      value={clienteQuery}
                      onChange={(e) => setClienteQuery(e.target.value)}
                      className="h-9"
                    />

                    <ScrollArea className="h-72 rounded-md border">
                      <div className="p-2 space-y-1">
                        {membrosFiltrados.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedMembro(m.id);
                              setClienteModo("membro");
                              setClienteDialogOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-muted"
                          >
                            <div className="text-sm font-medium">{m.nome}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {m.matricula ? `Matrícula: ${m.matricula}` : "—"}
                            </div>
                          </button>
                        ))}
                        {membrosFiltrados.length === 0 && (
                          <div className="text-sm text-muted-foreground px-3 py-6 text-center">
                            Nenhum membro encontrado
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="secondary" onClick={() => setClienteDialogOpen(false)}>Fechar</Button>
                      {selectedMembro && (
                        <Button variant="outline" onClick={() => { setSelectedMembro(null); setClienteModo("avulso"); }}>
                          Limpar seleção
                        </Button>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* ===== Tabela de itens ===== */}
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-24">Qtd</TableHead>
                    <TableHead className="w-32 text-right">Preço</TableHead>
                    <TableHead className="w-32 text-right">Total</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((ci) => (
                    <TableRow key={ci.produto.id}>
                      <TableCell>
                        <div className="text-sm font-medium">{ci.produto.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          {ci.produto.sku || ci.produto.codigo_barras}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={ci.quantidade}
                          onChange={(e) => updateQty(ci.produto.id, intFromInput(e.target.value))}
                          className="h-9"
                        />
                      </TableCell>
                      <TableCell className="text-right">{fmt(ci.produto.preco_centavos)}</TableCell>
                      <TableCell className="text-right">{fmt(ci.produto.preco_centavos * ci.quantidade)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeFromCart(ci.produto.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cart.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground text-center">
                        Carrinho vazio
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ===== Desconto (segmented) ===== */}
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Desconto
                  </Label>

                  <div className="inline-flex rounded-md border overflow-hidden">
                    <button
                      type="button"
                      className={`px-3 py-1 text-sm ${descontoModo === "valor" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      onClick={() => setDescontoModo("valor")}
                    >
                      R$
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 text-sm border-l ${descontoModo === "percent" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                      onClick={() => setDescontoModo("percent")}
                    >
                      %
                    </button>
                  </div>
                </div>

                {descontoModo === "valor" ? (
                  <Input
                    value={descontoReais}
                    onChange={(e) => setDescontoReais(e.target.value)}
                    placeholder="0,00"
                    className="h-9"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={descontoPercent}
                      onChange={(e) => setDescontoPercent(e.target.value)}
                      placeholder="0"
                      className="h-9"
                    />
                    <span className="text-sm text-muted-foreground">% (máx. 100)</span>
                  </div>
                )}

                {descontoModo === "percent" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[5, 10, 15].map((p) => (
                      <Button
                        key={p}
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDescontoPercent(String(p))}
                      >
                        -{p}%
                      </Button>
                    ))}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDescontoPercent("0")}>
                      Zerar
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* ===== Resumo ===== */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {descontoManualCentavos > 0 && (
                  <div className="flex justify-between">
                    <span>Descontos</span>
                    <span className="text-destructive">- {fmt(descontoManualCentavos)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>

              <Separator />

              {/* ===== Pagamento ===== */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Método</Label>
                  <Select value={metodoPagamento} onValueChange={(v) => setMetodoPagamento(v as any)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pago (R$)</Label>
                  <Input
                    value={pagoReais}
                    onChange={(e) => setPagoReais(e.target.value)}
                    placeholder="0,00"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span>Troco</span>
                <span className="font-medium">{fmt(troco)}</span>
              </div>

              {/* ===== Ações ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <Button className="w-full" onClick={() => finishSale(true)} disabled={isFinishing || cart.length === 0}>
                  <Printer className="h-4 w-4 mr-2" /> Finalizar e imprimir
                </Button>
                <Button className="w-full" variant="secondary" onClick={() => finishSale(false)} disabled={isFinishing || cart.length === 0}>
                  <CreditCard className="h-4 w-4 mr-2" /> Finalizar
                </Button>
                <Button className="w-full" variant="outline" onClick={clearCart} disabled={cart.length === 0}>
                  Limpar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );

  /* ============ Produtos / Categorias / Lista ============ */
  const produtosTab = (
    <div className="max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            PDV
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ponto de venda e histórico de vendas
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nome *</Label><Input value={pNome} onChange={(e) => setPNome(e.target.value)} placeholder="Ex.: Vela palito" /></div>
            <div>
              <Label>Categoria</Label>
              <div className="flex gap-2">
                <Select value={pCategoria ?? "__semcat__"} onValueChange={(v) => setPCategoria(v === "__semcat__" ? null : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__semcat__">Sem categoria</SelectItem>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setActiveTab("categorias")}><FolderOpen className="h-4 w-4 mr-2" />Categorias</Button>
              </div>
            </div>
            <div><Label>SKU</Label><Input value={pSku} onChange={(e) => setPSku(e.target.value)} placeholder="Opcional" /></div>
            <div><Label>Código de barras</Label><Input value={pBarras} onChange={(e) => setPBarras(e.target.value)} placeholder="EAN/GTIN" /></div>
            <div>
              <Label>Unidade</Label>
              <Select value={pUnidade} onValueChange={setPUnidade}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">un</SelectItem><SelectItem value="pct">pct</SelectItem>
                  <SelectItem value="cx">cx</SelectItem><SelectItem value="kg">kg</SelectItem><SelectItem value="lt">lt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Preço (R$)</Label><Input value={pPreco} onChange={(e) => setPPreco(e.target.value)} placeholder="0,00" /></div>
            <div><Label>Estoque inicial</Label><Input type="number" value={pEstoque} onChange={(e) => setPEstoque(intFromInput(e.target.value))} /></div>
            <div><Label>Foto</Label><Input type="file" accept="image/*" onChange={(e) => setPArquivo(e.target.files?.[0] ?? null)} /></div>
            <div className="md:col-span-2"><Label>Descrição</Label><Textarea value={pDescricao} onChange={(e) => setPDescricao(e.target.value)} rows={3} /></div>
          </div>

          <div className="flex gap-2">
            <Button onClick={salvarProduto} disabled={savingProduct}><Save className="h-4 w-4 mr-2" />Salvar</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPNome(""); setPSku(""); setPBarras(""); setPUnidade("un");
                setPPreco("0,00"); setPEstoque(0); setPCategoria(null); setPDescricao(""); setPArquivo(null);
              }}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const categoriasTab = (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold">Categorias</h3>
        <Button onClick={openNewCategory}><PlusCircle className="h-4 w-4 mr-2" /> Nova categoria</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead className="w-36 text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {categorias.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.nome}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEditCategory(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCategory(c.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {categorias.length === 0 && <TableRow><TableCell colSpan={2} className="text-sm text-muted-foreground text-center">Nenhuma categoria</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{catEditing ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <DialogDescription>Preencha o nome e clique em salvar.</DialogDescription>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={catNome} onChange={(e) => setCatNome(e.target.value)} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setCatModalOpen(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
              <Button onClick={saveCategory}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const [listQuery, setListQuery] = useState("");
  const produtosFiltrados = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter((p) =>
      [p.nome, p.sku, p.codigo_barras]
        .filter(Boolean)
        .some((s) => (s || "").toLowerCase().includes(q))
    );
  }, [produtos, listQuery]);

  const listaTab = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">Produtos</h3>

        <div className="flex gap-2">
          <Input
            className="w-64"
            placeholder="Buscar por nome, SKU, código..."
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
          />

          {/* EXPORTAR CSV */}
          <Button
            type="button"
            variant="outline"
            onClick={handleExportProdutosXLSX}
            title="Exportar XLSX"
          >
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDownloadTemplateXLSX}
            title="Baixar template XLSX"
          >
            <Download className="h-4 w-4 mr-2" /> Template
          </Button>


          {/* IMPORTAR CSV (input oculto + botão) */}
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={onImportXLSX}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenImport}
            title="Importar XLSX"
          >
            <Upload className="h-4 w-4 mr-2" /> Importar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Foto</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="w-28">Preço</TableHead>
                <TableHead className="w-24">Estoque</TableHead>
                <TableHead className="w-36 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtosFiltrados.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="w-12 h-12 rounded-md bg-muted overflow-hidden grid place-items-center">
                      {p.imagem_url ? (
                        <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 opacity-40" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.nome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.sku || p.codigo_barras || p.unidade}
                    </div>
                  </TableCell>
                  <TableCell>{fmt(p.preco_centavos)}</TableCell>
                  <TableCell>{p.estoque_atual ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEditProduto(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => deleteProduto(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {produtosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground text-center">
                    Sem produtos
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );


  /* ============ Histórico ============ */
  const membrosById = useMemo(() => {
    const map = new Map<string, string>();
    membros.forEach((m) => map.set(m.id, m.nome));
    return map;
  }, [membros]);

  const historicoFiltrado = useMemo(() => {
    const q = historicoSearch.trim().toLowerCase();
    if (!q) return historico;
    return historico.filter((v) => {
      const nome = v.membro_id ? (membrosById.get(v.membro_id) || "") : "avulso";
      const numStr = (v.numero != null ? String(v.numero) : "");
      return (
        nome.toLowerCase().includes(q) ||
        (v.metodo_pagamento || "").toLowerCase().includes(q) ||
        numStr.includes(q) // <-- busca por número
      );
    });
  }, [historico, historicoSearch, membrosById]);

  const historicoTab = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5" />
        <h3 className="text-xl font-semibold">Histórico de vendas</h3>
        <div className="ml-auto flex gap-2">
          <Input
            className="w-64"
            placeholder="Buscar por cliente, método ou nº"
            value={historicoSearch}
            onChange={(e) => setHistoricoSearch(e.target.value)}
          />
          <Button variant="outline" onClick={() => orgId && loadHistorico(orgId)} disabled={loadingHistorico}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Recarregar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Data</TableHead>
                <TableHead className="w-40">Venda ID</TableHead>
                <TableHead>Cliente / Itens</TableHead>
                <TableHead className="w-40">Método</TableHead>
                <TableHead className="w-32 text-right">Total</TableHead>                
                <TableHead className="w-36 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historicoFiltrado.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{new Date(v.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{v.numero ?? v.id}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{v.membro_id ? (membrosById.get(v.membro_id) || v.membro_id) : "Avulso"}</span>
                      {!!v.itens?.length && (
                        <span className="text-xs text-muted-foreground mt-1">
                          {v.itens.slice(0, 3).map(i => `${i.quantidade}x ${i.produto_nome ?? "Produto"}`).join(", ")}
                          {v.itens.length > 3 ? ` e +${v.itens.length - 3}` : ""}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{v.metodo_pagamento || "-"}</TableCell>
                  <TableCell className="text-right">{fmt(v.total_centavos || 0)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="text-destructive border-destructive" onClick={() => openRefundDialog(v.id)}>
                      Reembolsar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!historicoFiltrado || historicoFiltrado.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground text-center">
                    {loadingHistorico ? "Carregando vendas…" : "Nenhuma venda encontrada para os filtros."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {historicoTable && <div className="text-xs text-muted-foreground">Fonte: {historicoTable} (100 mais recentes)</div>}
    </div>
  );

  /* ============ Shell da página ============ */
  const content = (
    <div className="mx-auto max-w-[1400px] px-4 md:px-6 pt-2 md:pt-4 space-y-4 relative z-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Package className="h-8 w-8 text-primary" />
            PDV
          </h1>
          <p className="text-muted-foreground">
            Ponto de venda e histórico de vendas
          </p>
          {orgName && (
            <Badge variant="secondary" className="mt-2">
              {orgName}
            </Badge>
          )}
        </div>
      </div>

      {!orgId ? (
        <Card>
          <CardHeader><CardTitle>{loadingOrg ? "Carregando organização..." : "Organização não encontrada"}</CardTitle></CardHeader>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="vender">Vender</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="vender">{venderTab}</TabsContent>
          <TabsContent value="produtos">{produtosTab}</TabsContent>
          <TabsContent value="categorias">{categoriasTab}</TabsContent>
          <TabsContent value="lista">{listaTab}</TabsContent>
          <TabsContent value="historico">{historicoTab}</TabsContent>
        </Tabs>
      )}

      {/* Recibo */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recibo</DialogTitle>
            <DialogDescription>Comprovante simples da venda realizada no PDV.</DialogDescription>
          </DialogHeader>
          <div id="receipt-print" ref={receiptRef} className="text-sm space-y-1">
            <div>Organização: {orgName || orgId}</div>
            <div>
              Cliente: { lastSale?.membro_nome ||
                (selectedMembro ? (membros.find(m => m.id === selectedMembro)?.nome || selectedMembro) : "Avulso") }
            </div>
            {lastSale?.venda_numero && <div>Venda: #{lastSale.venda_numero}</div>}
            <Separator className="my-2" />
            {(lastSale?.itens || cart).map(ci => (
              <div key={ci.produto.id} className="flex justify-between">
                <span>{ci.quantidade}x {ci.produto.nome}</span>
                <span>{fmt(ci.produto.preco_centavos * ci.quantidade)}</span>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex justify-between"><span>Total</span><span>{fmt(lastSale?.total ?? 0)}</span></div>
            <div className="flex justify-between"><span>Pago</span><span>{fmt(lastSale?.pago ?? 0)}</span></div>
            <div className="flex justify-between"><span>Troco</span><span>{fmt(lastSale?.troco ?? 0)}</span></div>
            <div className="pt-2 text-muted-foreground">Obrigado pela preferência!</div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                if (!lastSale) return;
                imprimirCupomPDV(
                  {
                    venda_id: lastSale.venda_id,
                    venda_numero: lastSale.venda_numero, // <<-- use lastSale
                    itens: lastSale.itens,
                    subtotal: lastSale.subtotal,
                    desconto: lastSale.desconto,
                    total: lastSale.total,
                    pago: lastSale.pago,
                    troco: lastSale.troco,
                    membro_nome: lastSale.membro_nome,
                  },
                  orgName || String(orgId),
                  metodoPagamento
                );
              }}
            >
              <Printer className="h-4 w-4 mr-2" /> Imprimir
            </Button>

            <Button variant="secondary" onClick={() => setShowReceipt(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de reembolso */}
      <AlertDialog open={confirmRefundOpen} onOpenChange={setConfirmRefundOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reembolso</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai cancelar a venda <b>#{refundTarget?.id}</b> e reverter o estoque dos itens. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={actuallyRefund}>
              Confirmar reembolso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <DashboardLayout>
      <FeatureGate feature="pdv" fallback={<UpgradeCard needed="PDV" />}>      
      <NiceErrorBoundary>{content}</NiceErrorBoundary>
      </FeatureGate>
    </DashboardLayout>
  );
}
