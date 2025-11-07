// src/pages/Index.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Users,
  CreditCard,
  BarChart3,
  Shield,
  Drum,
  Leaf,
  Star,
  Menu,
  X,
  Calendar,
  FileText,
  TrendingUp,
  Bell,
  Settings,
  Zap,
} from "lucide-react";

/** ====== Tipos ====== */
type PlanKey = "Controle Básico" | "Controle Profissional" | "Controle Completo";

type LeadPayload = {
  nome: string;
  email: string;
  telefone: string;
  terreiro_nome: string;
  cidade_uf?: string;
  tamanho_terreiro?: string;
  plano: PlanKey;
  origem: "landing";
};

/** ====== Planos ====== */
const PLANS: { name: PlanKey; price: string; features: string[]; highlight?: boolean }[] = [
  { name: "Controle Básico", price: "R$79", features: ["Gestão de Membros", "Gestão de Mensalidade"] },
  {
    name: "Controle Profissional",
    price: "R$99",
    highlight: true,
    features: ["Tudo do Básico", "Relatórios avançados", "Pagamentos Diversos"],
  },
  {
    name: "Controle Completo",
    price: "R$159",
    features: ["Tudo do Profissional", "Suporte dedicado", "Integrações especiais", "PDV"],
  },
];

/** ====== Funcionalidades expandidas ====== */
const FEATURES = [
  {
    icon: <Users className="h-8 w-8" />,
    title: "Gestão de Membros",
    desc: "Cadastre e organize filhos de santo, frequentadores e visitantes com facilidade.",
    color: "from-purple-500 to-purple-600",
  },
  {
    icon: <CreditCard className="h-8 w-8" />,
    title: "Controle Financeiro",
    desc: "Gerencie mensalidades, doações, pagamentos diversos e PDV integrado.",
    color: "from-green-500 to-green-600",
  },
  {
    icon: <BarChart3 className="h-8 w-8" />,
    title: "Relatórios Avançados",
    desc: "Visualize a evolução financeira com gráficos claros e exportação para Excel/PDF.",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: <Calendar className="h-8 w-8" />,
    title: "Gestão de Assinaturas",
    desc: "Controle de planos, renovações automáticas e histórico completo.",
    color: "from-pink-500 to-pink-600",
  },
  {
    icon: <FileText className="h-8 w-8" />,
    title: "Faturas & Notas",
    desc: "Emissão e controle de faturas com rastreamento de status e vencimentos.",
    color: "from-orange-500 to-orange-600",
  },
  {
    icon: <TrendingUp className="h-8 w-8" />,
    title: "Dashboard Inteligente",
    desc: "Visão 360° do terreiro com métricas em tempo real e insights estratégicos.",
    color: "from-indigo-500 to-indigo-600",
  },
  {
    icon: <Bell className="h-8 w-8" />,
    title: "Notificações",
    desc: "Alertas de vencimentos, pagamentos recebidos e eventos importantes.",
    color: "from-yellow-500 to-yellow-600",
  },
  {
    icon: <Shield className="h-8 w-8" />,
    title: "Segurança Total",
    desc: "Proteção de dados com criptografia, backup automático e controle de acesso.",
    color: "from-red-500 to-red-600",
  },
  {
    icon: <Settings className="h-8 w-8" />,
    title: "Configurações Flexíveis",
    desc: "Personalize o sistema conforme as necessidades do seu terreiro.",
    color: "from-teal-500 to-teal-600",
  },
];

/** ====== Error Boundary simples ====== */
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [err, setErr] = useState<Error | null>(null);
  try {
    return <>{children}</>;
  } catch (e: any) {
    if (!err) setErr(e);
    return (
      <div className="max-w-3xl mx-auto p-4 text-red-700">
        <h3 className="font-bold mb-2">Ops, algo falhou ao renderizar.</h3>
        <pre className="text-xs bg-red-50 p-3 rounded">{String(e?.message || e)}</pre>
      </div>
    );
  }
}

const Index = () => {
  const { loading } = useAuth();

  const [openForm, setOpenForm] = useState(false);
  const [prefPlan, setPrefPlan] = useState<PlanKey>("Controle Profissional");

  const openHire = (plan?: PlanKey) => {
    if (plan) setPrefPlan(plan);
    setOpenForm(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <Header onOpenHire={openHire} />

      <ErrorBoundary>
        <main className="flex-1">
          {loading ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="animate-pulse text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-full mx-auto mb-4" />
                <div className="w-32 h-4 bg-muted rounded mx-auto" />
              </div>
            </div>
          ) : (
            <>
              {/* Hero */}
              <section className="relative flex flex-col items-center text-center py-24 md:py-32 px-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
                <div className="relative z-10 max-w-4xl mx-auto">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
                    <Zap className="h-4 w-4" />
                    Gestão Espiritual Moderna
                  </div>
                  <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent animate-fade-in">
                    Meu Axé
                  </h1>
                  <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in">
                    A plataforma completa para gestão de terreiros de Umbanda e Candomblé.
                    <span className="block mt-2 text-base">
                      Organize membros, finanças e rotinas com tecnologia que respeita a tradição.
                    </span>
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
                    <Button
                      size="lg"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                      onClick={() => openHire(prefPlan)}
                    >
                      Começar Agora
                    </Button>
                    <Button size="lg" asChild variant="outline">
                      <Link to="/login">Acessar Sistema</Link>
                    </Button>
                  </div>
                </div>
              </section>

              {/* Features Grid */}
              <section id="features" className="py-20 px-6">
                <div className="max-w-7xl mx-auto">
                  <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold mb-4">
                      Tudo que seu terreiro precisa
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      Uma plataforma completa com todas as ferramentas essenciais para gestão espiritual e administrativa
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {FEATURES.map((feature, idx) => (
                      <FeatureCard key={idx} {...feature} delay={idx * 0.1} />
                    ))}
                  </div>
                </div>
              </section>

              {/* Stats Section */}
              <section className="py-20 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10">
                <div className="max-w-6xl mx-auto px-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div className="p-6">
                      <div className="text-5xl font-bold text-primary mb-2">100%</div>
                      <div className="text-muted-foreground">Digital e Seguro</div>
                    </div>
                    <div className="p-6">
                      <div className="text-5xl font-bold text-primary mb-2">24/7</div>
                      <div className="text-muted-foreground">Acesso Contínuo</div>
                    </div>
                    <div className="p-6">
                      <div className="text-5xl font-bold text-primary mb-2">∞</div>
                      <div className="text-muted-foreground">Possibilidades</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Reviews */}
              <section id="reviews" className="py-20 px-6">
                <div className="max-w-6xl mx-auto text-center">
                  <h3 className="text-4xl font-bold mb-4">Confiança que vem da comunidade</h3>
                  <p className="text-lg text-muted-foreground mb-12">Veja o que nossos usuários têm a dizer</p>
                  <div className="grid md:grid-cols-3 gap-8">
                    <Review 
                      name="Mãe Joana" 
                      role="Dirigente de Terreiro" 
                      text="Agora consigo organizar mensalidades e cadastros sem papelada. O sistema é intuitivo e respeitoso com nossa tradição." 
                    />
                    <Review 
                      name="Pai Carlos" 
                      role="Babalorixá" 
                      text="O sistema trouxe clareza financeira que eu nunca tive. Os relatórios são claros e me ajudam a tomar decisões melhores." 
                    />
                    <Review 
                      name="Ana Clara" 
                      role="Filha de Santo" 
                      text="Adorei ver tudo digital, moderno e ao mesmo tempo respeitoso com a tradição. Facilita muito a vida de todos." 
                    />
                  </div>
                </div>
              </section>

              {/* CTA Final */}
              <section className="py-20 px-6 bg-gradient-to-br from-primary/5 to-accent/5">
                <div className="max-w-4xl mx-auto text-center">
                  <h3 className="text-4xl md:text-5xl font-bold mb-6">
                    Pronto para modernizar seu terreiro?
                  </h3>
                  <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                    Entre em contato e descubra como podemos ajudar na gestão do seu espaço sagrado
                  </p>
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                    onClick={() => openHire(prefPlan)}
                  >
                    Solicitar Contato
                  </Button>
                </div>
              </section>
            </>
          )}
        </main>
      </ErrorBoundary>

      <footer className="py-10 border-t bg-card text-center text-sm text-muted-foreground">
        <div className="max-w-6xl mx-auto px-6">
          <p>{new Date().getFullYear()} Meu Axé — Tecnologia com respeito à tradição</p>
        </div>
      </footer>

      {/* Modal Contratar/Solicitar Plano */}
      {openForm && (
        <HireModal initialPlan={prefPlan} onClose={() => setOpenForm(false)} />
      )}
    </div>
  );
};

/** ====== Header (navbar moderna com blur) ====== */
function Header({ onOpenHire }: { onOpenHire: (p?: PlanKey) => void }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all",
        scrolled ? "bg-background/80 shadow-sm border-b" : "bg-background/40",
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-4">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/logo.png"
            alt="Logo - Meu Axé"
            className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a href="#features" className="hover:text-primary transition-colors">Funcionalidades</a>
          <a href="#reviews" className="hover:text-primary transition-colors">Avaliações</a>
        </nav>

        {/* Ações */}
        <div className="hidden md:flex gap-3">
          <Button asChild variant="outline">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button
            onClick={() => onOpenHire("Controle Profissional")}
          >
            Contratar
          </Button>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 border"
          aria-label="Abrir menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t bg-background">
          <nav className="flex flex-col px-4 py-3 text-sm">
            <a href="#features" onClick={close} className="py-2">Funcionalidades</a>
            <a href="#reviews" onClick={close} className="py-2">Avaliações</a>
          </nav>
          <div className="flex gap-3 px-4 pb-4">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/login" onClick={close}>Entrar</Link>
            </Button>
            <Button
              className="flex-1"
              onClick={() => { onOpenHire("Controle Profissional"); close(); }}
            >
              Contratar
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

/** ====== Feature Card Moderna ====== */
function FeatureCard({ 
  icon, 
  title, 
  desc, 
  color,
  delay 
}: { 
  icon: React.ReactNode; 
  title: string; 
  desc: string;
  color: string;
  delay: number;
}) {
  return (
    <Card 
      className="group relative p-6 border hover:border-primary/50 transition-all duration-300 hover:shadow-lg overflow-hidden"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 blur-2xl transition-opacity duration-500`} />
      <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${color} text-white mb-4 shadow-md`}>
        {icon}
      </div>
      <h4 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </Card>
  );
}

function Review({ name, role, text }: { name: string; role: string; text: string }) {
  return (
    <Card className="p-6 bg-white shadow-sm hover:shadow-md transition text-left">
      <div className="flex items-center gap-1 mb-3">
        <Star className="text-yellow-500" />
        <Star className="text-yellow-500" />
        <Star className="text-yellow-500" />
        <Star className="text-yellow-500" />
        <Star className="text-yellow-500" />
      </div>
      <p className="text-gray-700 mb-4">“{text}”</p>
      <p className="font-semibold">{name}</p>
      <p className="text-sm text-gray-500">{role}</p>
    </Card>
  );
}

/** ====== Helper: Edge Function (fallback e-mail) ====== */
async function sendFallbackEmail(form: LeadPayload) {
  const fnBase =
    import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
    || (import.meta.env.VITE_SUPABASE_URL
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
        : undefined);

  if (!fnBase) {
    throw new Error("VITE_SUPABASE_FUNCTIONS_URL não configurada e não foi possível deduzir a partir de VITE_SUPABASE_URL.");
  }

  const url = `${fnBase}/send-plan-request`; // <— nome certo da Edge

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      nome: form.nome,
      email: form.email,
      telefone: form.telefone || null,
      terreiro: form.terreiro_nome,
      cidade_uf: form.cidade_uf || null,
      tamanho_terreiro: form.tamanho_terreiro || null,
      plano: form.plano,
      origem: "landing",
    }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.error) {
    throw new Error(json?.error || `Falha no envio de e-mail (${resp.status})`);
  }
  return json;
}

/** ====== Modal + Form (INSERT anon + fallback Edge + mailto) ====== */
function HireModal({
  initialPlan,
  onClose,
}: {
  initialPlan: PlanKey;
  onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<LeadPayload>({
    nome: "",
    email: "",
    telefone: "",
    terreiro_nome: "",
    cidade_uf: "",
    tamanho_terreiro: "",
    plano: initialPlan,
    origem: "landing",
  });

  const planOptions = useMemo(() => PLANS.map((p) => p.name), []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const validate = () => {
    if (!form.nome || !form.email || !form.telefone || !form.terreiro_nome) return false;
    if (!form.email.includes("@")) return false;
    return true;
  };

  const buildMailtoHref = () => {
    const body =
      `Nome: ${form.nome}\n` +
      `E-mail: ${form.email}\n` +
      `Telefone: ${form.telefone}\n` +
      `Terreiro: ${form.terreiro_nome}\n` +
      `Cidade/UF: ${form.cidade_uf}\n` +
      `Tamanho: ${form.tamanho_terreiro}\n` +
      `Plano: ${form.plano}\n` +
      `Origem: landing\n`;
    return `mailto:dev.brunopires@gmail.com?subject=${encodeURIComponent(
      "Novo pedido de contratação - " + form.plano
    )}&body=${encodeURIComponent(body)}`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(null);
    setErr(null);

    if (!validate()) {
      setErr("Confira os campos obrigatórios.");
      return;
    }

    setSending(true);

    try {
      const {
        nome,
        email,
        telefone,
        terreiro_nome,
        cidade_uf,
        tamanho_terreiro,
        plano,
      } = form;

      const payload = {
        nome,
        email,
        telefone,
        terreiro: terreiro_nome,
        plano,
        cidade_uf: cidade_uf || null,
        tamanho_terreiro: tamanho_terreiro || null,
        origem: "landing",
      };

      const fnBase =
        import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
        || (import.meta.env.VITE_SUPABASE_URL
            ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
            : `https://${import.meta.env.VITE_SUPABASE_PROJECT_REF}.supabase.co/functions/v1`);

      const FUNC_URL = `${fnBase}/send-plan-request`;

      const resp = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(`Edge falhou: ${resp.status} - ${JSON.stringify(errJson)}`);
      }

      await resp.json();

      setOk("Recebemos seus dados! Vamos entrar em contato por e-mail/WhatsApp. Axé! ✨");
      setTimeout(onClose, 1600);
    } catch (e: any) {
      console.error("[edge-error]", e?.message || e);

      try {
        await sendFallbackEmail(form);
        setOk("Recebemos seu pedido por e-mail. Obrigado! ✨");
        setTimeout(onClose, 1600);
      } catch (mailErr: any) {
        console.error("[lead-mail-fallback]", mailErr?.message || mailErr);
        const msg = e?.message || "Não foi possível salvar seu pedido agora.";
        setErr(`${msg} Você pode enviar por e-mail pelo botão abaixo.`);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Solicitar plano</h3>
          <button className="p-2 rounded-md hover:bg-gray-100" aria-label="Fechar" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="grid gap-4" onSubmit={submit} noValidate>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Nome completo *</label>
            <input
              className="border rounded-md px-3 py-2"
              name="nome"
              value={form.nome}
              onChange={onChange}
              placeholder="Seu nome"
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">E-mail *</label>
            <input
              className="border rounded-md px-3 py-2"
              type="email"
              name="email"
              value={form.email}
              onChange={onChange}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Telefone / WhatsApp *</label>
            <input
              className="border rounded-md px-3 py-2"
              name="telefone"
              value={form.telefone}
              onChange={onChange}
              placeholder="(xx) 9xxxx-xxxx"
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Nome do Terreiro *</label>
            <input
              className="border rounded-md px-3 py-2"
              name="terreiro_nome"
              value={form.terreiro_nome}
              onChange={onChange}
              placeholder="Terreiro de..."
              required
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Cidade / UF</label>
            <input
              className="border rounded-md px-3 py-2"
              name="cidade_uf"
              value={form.cidade_uf}
              onChange={onChange}
              placeholder="Macaé / RJ"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Tamanho do terreiro (opcional)</label>
            <input
              className="border rounded-md px-3 py-2"
              name="tamanho_terreiro"
              value={form.tamanho_terreiro}
              onChange={onChange}
              placeholder="ex.: 80 membros ativos"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Plano</label>
            <select
              className="border rounded-md px-3 py-2"
              name="plano"
              value={form.plano}
              onChange={onChange}
            >
              {planOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
          {ok && <p className="text-sm text-green-600">{ok}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={sending}
            >
              {sending ? "Enviando..." : "Enviar pedido"}
            </Button>
          </div>

          {/* Fallback manual para e-mail, apenas se houve erro no insert e no e-mail */}
          {err && (
            <div className="mt-3">
              <a className="text-sm underline" href={buildMailtoHref()}>
                Enviar por e-mail
              </a>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-2">
            *Ao enviar, você concorda em receber nosso contato para finalizar a contratação.
          </p>
        </form>
      </div>
    </div>
  );
}

export default Index;
