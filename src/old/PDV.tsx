"use client";

/**
 * PDV.tsx — POS multi-tenant com gestão completa
 * Abas:
 *  - Vender: fluxo PDV
 *  - Produtos: cadastro rápido (com upload de foto)
 *  - Categorias: CRUD completo
 *  - Lista: tabela de produtos (foto, editar, excluir)
 *
 * Requer:
 * - Tabela produtos com (recomendado) coluna opcional: imagem_url text
 * - Bucket Supabase Storage "produtos"
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/contexts/OrgContext";
import { DashboardLayout } from "@/components/DashboardLayout";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  Search, Barcode, ShoppingCart, Trash2, CreditCard, Percent,
  Package, PlusCircle, Save, Printer, ImageIcon, Pencil, X, FolderOpen
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
  imagem_url?: string | null; // opcional
  descricao?: string | null;  // opcional
};

export type Categoria = { id: string; nome: string; ativo?: boolean | null };
export type Membro = { id: string; nome: string };

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

/* Edge Functions fallback list — ajuste se seus nomes diferirem */
const EDGE_FUNCTIONS = ["pos-create-sale"] as const;

/* ================== ErrorBoundary ================== */
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
              <p className="text-muted-foreground">
                Veja o console do navegador para detalhes.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children as any;
  }
}

/* ================== Página ================== */
export default function PDVPage() {
  const { toast } = useToast();
  const { session } = useAuth();
  const { currentOrg } = useOrg();

  // Fallback automático de org usando profiles.org_id
  const [fallbackOrgId, setFallbackOrgId] = useState<string | null>(null);
  const [fallbackOrgName, setFallbackOrgName] = useState<string | null>(null);
  const [loadingOrg, setLoadingOrg] = useState<boolean>(false);

  // orgId efetivo usado pela página (contexto OU fallback)
  const orgId = currentOrg?.id ?? fallbackOrgId;
  const terreiroId = orgId;
  const orgName = currentOrg?.nome ?? fallbackOrgName ?? undefined;

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);

  // Abas / filtros
  const [activeTab, setActiveTab] = useState<"vender" | "produtos" | "categorias" | "lista">("vender");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");

  // Carrinho / cliente
  const [cart, setCart] = useState<{ produto: Produto; quantidade: number }[]>([]);
  const [selectedMembro, setSelectedMembro] = useState<string | null>(null); // null = avulso

  // Pagamento
  const [descontoReais, setDescontoReais] = useState<string>("0,00");
  const [descontoPercent, setDescontoPercent] = useState<string>("0");
  const [metodoPagamento, setMetodoPagamento] = useState<"PIX" | "Cartão" | "Dinheiro">("PIX");
  const [pagoReais, setPagoReais] = useState<string>("0,00");

  const [isFinishing, setIsFinishing] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<{
    venda_id?: string;
    itens: { produto: Produto; quantidade: number }[];
    subtotal: number; desconto: number; total: number; pago: number; troco: number; membro_nome?: string;
  } | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  // Form produto (cadastro rápido)
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

  // Categorias CRUD
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<Categoria | null>(null);
  const [catNome, setCatNome] = useState("");

  // Produto edição
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

  /* ============ Fallback de org (profiles.org_id) ============ */
  useEffect(() => {
    if (currentOrg?.id || fallbackOrgId || !session?.user?.id) return;
    setLoadingOrg(true);
    (async () => {
      try {
        const { data: profile, error: e1 } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (e1) throw e1;

        const pfOrgId = profile?.org_id ?? null;
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
  }, [currentOrg?.id, fallbackOrgId, session?.user?.id, toast]);

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
        .select("id, nome")
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

  /* ============ Filtros/Busca (Catálogo) ============ */
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

  /* ============ Carrinho ============ */
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
    const reaisCents = moneyStrToCents(descontoReais);
    const pct = Number.isFinite(parseFloat(descontoPercent)) ? parseFloat(descontoPercent) : 0;
    const byValue = reaisCents;
    const byPct = Math.round((subtotal * pct) / 100);
    return Math.min(subtotal, Math.max(byValue, byPct));
  }, [descontoReais, descontoPercent, subtotal]);

  const total = useMemo(() => Math.max(0, subtotal - descontoManualCentavos), [subtotal, descontoManualCentavos]);
  const pagoCentavos = useMemo(() => moneyStrToCents(pagoReais), [pagoReais]);
  const troco = useMemo(() => Math.max(0, pagoCentavos - total), [pagoCentavos, total]);

  /* ============ Código de barras ============ */
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
      toast({
        title: "Código não encontrado",
        description: `Nenhum produto com código ${code}.`,
        variant: "destructive",
      });
    }
  };

  /* ============ Finalização (Edges alinhadas + fallback/diagnóstico) ============ */
  const callEdge = async (payload: any) => {
    const supabaseUrl =
      (supabase as any)?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

    const invokeOnce = async (fn: string) => {
      // 1) tenta via SDK
      try {
        const { data, error } = await supabase.functions.invoke(fn, { body: payload });
        if (error) throw error;
        return data;
      } catch (sdkErr: any) {
        console.warn(`[PDV] invoke via SDK falhou para '${fn}':`, sdkErr?.message || sdkErr);

        // 2) fallback: fetch direto com Bearer
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess?.session?.access_token ?? "";
          const url = `${supabaseUrl}/functions/v1/${fn}`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "authorization": token ? `Bearer ${token}` : "",
            },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status} — ${text}`);
          }
          return await res.json();
        } catch (fetchErr: any) {
          throw new Error(`Edge '${fn}' indisponível: ${fetchErr?.message || fetchErr}`);
        }
      }
    };

    let lastErr: any = null;
    for (const fn of EDGE_FUNCTIONS) {
      try {
        return await invokeOnce(fn);
      } catch (e) {
        lastErr = e;
        console.warn(`[PDV] Edge '${fn}' falhou. Tentando próxima…`, e);
      }
    }
    throw lastErr || new Error("Falha ao chamar Edge Function de venda");
  };

  const finishSale = async (print = true) => {
    if (!orgId || !terreiroId) {
      toast({
        title: "Organização não encontrada",
        description: "Não foi possível detectar sua organização automaticamente.",
        variant: "destructive",
      });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Carrinho vazio", description: "Adicione itens antes de finalizar." });
      return;
    }
    if (pagoCentavos < total) {
      toast({ title: "Pagamento insuficiente", description: `Falta ${fmt(total - pagoCentavos)}.`, variant: "destructive" });
      return;
    }

    setIsFinishing(true);
    try {
      const itens = cart.map((ci) => ({
        produto_id: ci.produto.id,
        quantidade: ci.quantidade,
        preco_centavos: ci.produto.preco_centavos,
        total_centavos: cents(ci.produto.preco_centavos * ci.quantidade),
      }));

      const payload = {
        org_id: orgId,
        terreiro_id: terreiroId, // compat com edge (espelhado se não vier)
        membro_id: selectedMembro,
        itens,
        subtotal_centavos: subtotal,
        desconto_centavos: descontoManualCentavos,
        total_centavos: total,
        pago_centavos: pagoCentavos,
        troco_centavos: troco,
        metodo_pagamento: metodoPagamento,
        observacoes: null,
        usuario_operacao: session?.user?.email || session?.user?.id || "pdv",
      };

      const result = await callEdge(payload);

      const snap = {
        venda_id: result?.venda_id as string | undefined,
        itens: cart.map((ci) => ({ produto: ci.produto, quantidade: ci.quantidade })),
        subtotal,
        desconto: descontoManualCentavos,
        total,
        pago: pagoCentavos,
        troco,
        membro_nome: selectedMembro ? membros.find((m) => m.id === selectedMembro)?.nome : undefined,
      };

      setLastSale(snap);
      setShowReceipt(true);

      if (print) {
        try {
          await imprimirCupomESCPos(snap, orgName || "Terreiro", metodoPagamento);
        } catch (err) {
          console.warn("Falha ao imprimir cupom:", err);
        }
      }

      clearCart();
      setDescontoReais("0,00");
      setDescontoPercent("0");
      setPagoReais("0,00");

      toast({ title: "Venda concluída", description: `Venda #${result?.venda_id || "-" } registrada com sucesso!` });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao finalizar", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setIsFinishing(false);
    }
  };

  /* ============ Impressão ESC/POS ============ */
  async function imprimirCupomESCPos(
    snap: {
      venda_id?: string;
      itens: { produto: Produto; quantidade: number }[];
      total: number; pago: number; troco: number; desconto: number; subtotal: number; membro_nome?: string;
    },
    orgNameParam: string,
    metodo: string
  ) {
    const now = new Date();
    const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s.padEnd(n));
    const line = "-".repeat(32);

    const encoder = new TextEncoder();
    const ESC = 0x1b, GS = 0x1d;
    const bytes: number[] = [];

    bytes.push(ESC, 0x40);             // Initialize
    bytes.push(ESC, 0x61, 0x01);       // align center
    bytes.push(...encoder.encode((orgNameParam || "ORGANIZAÇÃO").toUpperCase() + "\n"));
    bytes.push(...encoder.encode("CUPOM PDV\n"));
    bytes.push(ESC, 0x61, 0x00);       // align left
    bytes.push(...encoder.encode(now.toLocaleString("pt-BR") + "\n"));
    if (snap.venda_id) bytes.push(...encoder.encode(`Venda: ${snap.venda_id}\n`));
    if (snap.membro_nome) bytes.push(...encoder.encode(`Cliente: ${snap.membro_nome}\n`));
    bytes.push(...encoder.encode(line + "\n"));

    snap.itens.forEach(({ produto, quantidade }) => {
      const nome = (produto.nome || "").toUpperCase();
      const totalLinha = fmt(produto.preco_centavos * quantidade);
      const row = (quantidade + "x " + nome).slice(0, 22).padEnd(22) + totalLinha.padStart(10);
      bytes.push(...encoder.encode(row + "\n"));
    });

    bytes.push(...encoder.encode(line + "\n"));
    if (snap.desconto > 0) bytes.push(...encoder.encode(pad("Descontos:", 22) + pad("-" + fmt(snap.desconto), 10) + "\n"));
    bytes.push(...encoder.encode(pad("Total:", 22) + pad(fmt(snap.total), 10) + "\n"));
    bytes.push(...encoder.encode(pad(`Pago (${metodo}):`, 22) + pad(fmt(snap.pago), 10) + "\n"));
    if (snap.troco > 0) bytes.push(...encoder.encode(pad("Troco:", 22) + pad(fmt(snap.troco), 10) + "\n"));
    bytes.push(...encoder.encode("\nObrigado pela preferência!\n\n"));

    bytes.push(GS, 0x56, 0x42, 0x10); // Cut parcial

    // abre a gaveta (edge separada)
    try { await supabase.functions.invoke("pos-open-drawer", { body: { pin: 0, org_id: orgId, terreiro_id: terreiroId } }); } catch {}

    const hasWindow = typeof window !== "undefined";
    const LOCAL_PRINTER =
      (hasWindow && (window as any).__PRINTER_URL__) ||
      (hasWindow && localStorage.getItem("printer_url")) ||
      "http://localhost:5179/print";

    try {
      const b64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      await fetch(LOCAL_PRINTER, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bytes_base64: b64 }),
      });
    } catch (e) {
      console.warn("Agente local de impressão indisponível:", e);
    }
  }

  /* ============ Upload de imagem (Supabase Storage) ============ */
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

  /* ============ Cadastro de Produto (rápido) ============ */
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
      if (pArquivo) imagem_url = await uploadImagem(pArquivo, "novo");

      const preco = moneyStrToCents(pPreco);
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
          terreiro_id: terreiroId, // compat com back-end
        })
        .select("*")
        .single();

      if (error) throw error;

      setProdutos((prev) => [...prev, data as Produto].sort((a, b) => a.nome.localeCompare(b.nome)));

      // limpa formulário
      setPNome("");
      setPSku("");
      setPBarras("");
      setPUnidade("un");
      setPPreco("0,00");
      setPEstoque(0);
      setPCategoria(null);
      setPDescricao("");
      setPArquivo(null);

      toast({ title: "Produto salvo", description: `${data?.nome}` });
      setActiveTab("lista");
    } catch (e: any) {
      toast({ title: "Erro ao salvar produto", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setSavingProduct(false);
    }
  };

  /* ============ CRUD Categorias ============ */
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

  /* ============ Editar / Excluir Produtos (Lista) ============ */
  const openEditProduto = (p: Produto) => {
    setEditing(p);
    setEdNome(p.nome || "");
    setEdSku(p.sku || "");
    setEdBarras(p.codigo_barras || "");
    setEdUnidade(p.unidade || "un");
    setEdPreco((p.preco_centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
    setEdEstoque(p.estoque_atual || 0);
    setEdCategoria(p.categoria_id || null);
    setEdDescricao(p.descricao || "");
    setEdArquivo(null);
    setProdModalOpen(true);
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

  const deleteProduto = async (id: string) => {
    if (!orgId) return;
    try {
      await supabase.from("produtos").delete().eq("id", id).eq("org_id", orgId);
      setProdutos((prev) => prev.filter((x) => x.id !== id));
      toast({ title: "Produto removido" });
    } catch (e: any) {
      toast({ title: "Erro ao remover produto", description: e?.message || String(e), variant: "destructive" });
    }
  };

  /* ============ UI: Vender (catálogo + carrinho) ============ */
  const venderTab = (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Coluna de produtos/busca — AGORA 2 colunas no xl (menor) */}
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
                <Input
                  placeholder="Nome, SKU ou código de barras"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Leitor de código de barras"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") onBarcodeEnter(); }}
                  className="h-9"
                />
                <Button variant="secondary" onClick={onBarcodeEnter} title="Adicionar por código" className="h-9 px-3">
                  <Barcode className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge
                onClick={() => setCat(null)}
                className={`cursor-pointer ${cat === null ? "bg-primary text-primary-foreground" : ""}`}
              >
                Todas
              </Badge>
              {categorias.map((c) => (
                <Badge
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={`cursor-pointer ${cat === c.id ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {c.nome}
                </Badge>
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
                  <button
                    key={p.id}
                    onClick={() => addToCart(p, 1)}
                    className="group text-left border rounded-lg p-2 hover:shadow-md transition flex flex-col gap-2"
                  >
                    <div className="aspect-square w-full rounded-md bg-muted overflow-hidden">
                      {p.imagem_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full grid place-items-center">
                          <ImageIcon className="opacity-40" />
                        </div>
                      )}
                    </div>
                    <div className="text-[13px] font-medium line-clamp-2">{p.nome}</div>
                    <div className="text-[11px] text-muted-foreground">{p.sku || p.codigo_barras || p.unidade || ""}</div>
                    <div className="mt-auto text-sm font-semibold">{fmt(p.preco_centavos)}</div>
                  </button>
                ))}
                {visibleProdutos.length === 0 && (
                  <div className="col-span-full text-sm text-muted-foreground">Nenhum produto encontrado.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Coluna do carrinho — AGORA 3 colunas no xl (maior) */}
      <div className="xl:col-span-3 space-y-4">
        <Card className="sticky top-24 self-start">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingCart className="h-4 w-4" />
              Carrinho
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[calc(100vh-7rem)] overflow-auto">
            {/* Cliente */}
            <div className="mb-3">
              <Label className="text-xs mb-1 block">Cliente</Label>
              <Select
                value={selectedMembro ?? "__avulso__"}
                onValueChange={(v) => setSelectedMembro(v === "__avulso__" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Cliente avulso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__avulso__">Cliente avulso</SelectItem>
                  {membros.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                        <div className="text-xs text-muted-foreground">{ci.produto.sku || ci.produto.codigo_barras}</div>
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
                      <TableCell colSpan={5} className="text-sm text-muted-foreground text-center">Carrinho vazio</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="flex items-center gap-2">
                    <Percent className="h-4 w-4" /> Desconto (R$)
                  </Label>
                  <Input value={descontoReais} onChange={(e) => setDescontoReais(e.target.value)} placeholder="0,00" className="h-9" />
                </div>
                <div>
                  <Label>%</Label>
                  <Input value={descontoPercent} onChange={(e) => setDescontoPercent(e.target.value)} placeholder="0" className="h-9" />
                </div>
              </div>

              <Separator />

              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                <div className="flex justify-between"><span>Descontos</span><span>- {fmt(descontoManualCentavos)}</span></div>
                <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{fmt(total)}</span></div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Método</Label>
                  <Select value={metodoPagamento} onValueChange={(v: "PIX" | "Cartão" | "Dinheiro") => setMetodoPagamento(v)}>
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
                  <Input value={pagoReais} onChange={(e) => setPagoReais(e.target.value)} placeholder="0,00" className="h-9" />
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <span>Troco</span>
                <span className="font-medium">{fmt(troco)}</span>
              </div>

              {/* Botões proporcionais e responsivos */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <Button className="w-full" onClick={() => finishSale(true)} disabled={isFinishing || cart.length === 0}>
                  <CreditCard className="h-4 w-4 mr-2" /> Finalizar e imprimir
                </Button>
                <Button className="w-full" variant="secondary" onClick={() => finishSale(false)} disabled={isFinishing || cart.length === 0}>
                  <Printer className="h-4 w-4 mr-2" /> Só finalizar
                </Button>
                <Button className="w-full" variant="outline" onClick={clearCart} disabled={cart.length === 0}>Limpar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  /* ============ UI: Cadastro rápido de produto ============ */
  const produtosTab = (
    <div className="max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <PlusCircle className="h-5 w-5" />
            Cadastro de produto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={pNome} onChange={(e) => setPNome(e.target.value)} placeholder="Ex.: Vela palito" />
            </div>
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
                <Button type="button" variant="outline" onClick={() => setActiveTab("categorias")}>
                  <FolderOpen className="h-4 w-4 mr-2" /> Categorias
                </Button>
              </div>
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={pSku} onChange={(e) => setPSku(e.target.value)} placeholder="Opcional" />
            </div>
            <div>
              <Label>Código de barras</Label>
              <Input value={pBarras} onChange={(e) => setPBarras(e.target.value)} placeholder="EAN/GTIN" />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={pUnidade} onValueChange={setPUnidade}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">un</SelectItem>
                  <SelectItem value="pct">pct</SelectItem>
                  <SelectItem value="cx">cx</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lt">lt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input value={pPreco} onChange={(e) => setPPreco(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Estoque inicial</Label>
              <Input type="number" value={pEstoque} onChange={(e) => setPEstoque(intFromInput(e.target.value))} />
            </div>
            <div>
              <Label>Foto</Label>
              <Input type="file" accept="image/*" onChange={(e) => setPArquivo(e.target.files?.[0] ?? null)} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={pDescricao} onChange={(e) => setPDescricao(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={salvarProduto} disabled={savingProduct}>
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
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

  /* ============ UI: Categorias ============ */
  const categoriasTab = (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xl font-semibold">Categorias</h3>
        <Button onClick={openNewCategory}><PlusCircle className="h-4 w-4 mr-2" /> Nova categoria</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-36 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.nome}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEditCategory(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteCategory(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {categorias.length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-sm text-muted-foreground text-center">Nenhuma categoria</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal categoria */}
      <Dialog open={catModalOpen} onOpenChange={setCatModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{catEditing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={catNome} onChange={(e) => setCatNome(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setCatModalOpen(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
              <Button onClick={saveCategory}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  /* ============ UI: Lista de produtos ============ */
  const [listQuery, setListQuery] = useState("");
  const produtosFiltrados = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter((p) =>
      [p.nome, p.sku, p.codigo_barras].filter(Boolean).some((s) => (s || "").toLowerCase().includes(q))
    );
  }, [produtos, listQuery]);

  const listaTab = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">Produtos</h3>
        <div className="flex gap-2">
          <Input className="w-64" placeholder="Buscar por nome, SKU, código..." value={listQuery} onChange={(e) => setListQuery(e.target.value)} />
          <Button variant="outline" onClick={() => setActiveTab("produtos")}><PlusCircle className="h-4 w-4 mr-2" /> Novo</Button>
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
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                      ) : <ImageIcon className="h-5 w-5 opacity-40" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.nome}</div>
                    <div className="text-[11px] text-muted-foreground">{p.sku || p.codigo_barras || p.unidade}</div>
                  </TableCell>
                  <TableCell>{fmt(p.preco_centavos)}</TableCell>
                  <TableCell>{p.estoque_atual ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEditProduto(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteProduto(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {produtosFiltrados.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground text-center">Sem produtos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal produto (editar) */}
      <Dialog open={prodModalOpen} onOpenChange={setProdModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar produto</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={edNome} onChange={(e) => setEdNome(e.target.value)} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={edCategoria ?? "__semcat__"} onValueChange={(v) => setEdCategoria(v === "__semcat__" ? null : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={edSku} onChange={(e) => setEdSku(e.target.value)} />
            </div>
            <div>
              <Label>Código de barras</Label>
              <Input value={edBarras} onChange={(e) => setEdBarras(e.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={edUnidade} onValueChange={setEdUnidade}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">un</SelectItem>
                  <SelectItem value="pct">pct</SelectItem>
                  <SelectItem value="cx">cx</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lt">lt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input value={edPreco} onChange={(e) => setEdPreco(e.target.value)} />
            </div>
            <div>
              <Label>Estoque</Label>
              <Input type="number" value={edEstoque} onChange={(e) => setEdEstoque(intFromInput(e.target.value))} />
            </div>
            <div>
              <Label>Foto</Label>
              <Input type="file" accept="image/*" onChange={(e) => setEdArquivo(e.target.files?.[0] ?? null)} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={3} value={edDescricao} onChange={(e) => setEdDescricao(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setProdModalOpen(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            <Button onClick={saveEditProduto}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  /* ============ Shell da página ============ */
  const content = (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">PDV</h1>
        {orgName && <Badge variant="secondary" className="ml-2">{orgName}</Badge>}
      </div>

      {!orgId ? (
        <Card>
          <CardHeader>
            <CardTitle>{loadingOrg ? "aCarregando organização..." : "Organização não encontrada"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loadingOrg
              ? "Buscando sua organização padrão no perfil."
              : "Não foi possível detectar automaticamente sua organização."}
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="vender">Vender</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="categorias">Categorias</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
          </TabsList>

          <TabsContent value="vender">{venderTab}</TabsContent>
          <TabsContent value="produtos">{produtosTab}</TabsContent>
          <TabsContent value="categorias">{categoriasTab}</TabsContent>
          <TabsContent value="lista">{listaTab}</TabsContent>
        </Tabs>
      )}

      {/* Recibo */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recibo</DialogTitle></DialogHeader>
          <div ref={receiptRef} className="text-sm space-y-1">
            <div>Organização: {orgName || orgId}</div>
            <div>
              Cliente: { lastSale?.membro_nome ||
                (selectedMembro ? (membros.find(m => m.id === selectedMembro)?.nome || selectedMembro) : "Avulso") }
            </div>
            {lastSale?.venda_id && <div>Venda: #{lastSale.venda_id}</div>}
            <Separator className="my-2" />
            {(lastSale?.itens || cart).map(ci => (
              <div key={ci.produto.id} className="flex justify-between">
                <span>{ci.quantidade}x {ci.produto.nome}</span>
                <span>{fmt(ci.produto.preco_centavos * ci.quantidade)}</span>
              </div>
            ))}
            <Separator className="my-2" />
            <div className="flex justify-between"><span>Total</span><span>{fmt(lastSale?.total ?? total)}</span></div>
            <div className="flex justify-between"><span>Pago</span><span>{fmt(lastSale?.pago ?? pagoCentavos)}</span></div>
            <div className="flex justify-between"><span>Troco</span><span>{fmt(lastSale?.troco ?? troco)}</span></div>
            <div className="pt-2 text-muted-foreground">Obrigado pela preferência!</div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
            <Button variant="secondary" onClick={() => setShowReceipt(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <DashboardLayout>
      <NiceErrorBoundary>{content}</NiceErrorBoundary>
    </DashboardLayout>
  );
}
