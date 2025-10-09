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
  CheckCircle,
  Menu,
  X,
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

/** ====== Util: estilo padrão de botão (borda roxa + hover roxo) ====== */
const BTN_PURPLE =
  "border border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white";

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
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Header onOpenHire={openHire} />

      <ErrorBoundary>
        <main className="flex-1">
          {loading ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <div className="animate-pulse text-center">
                <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4" />
                <div className="w-32 h-4 bg-gray-300 rounded mx-auto" />
              </div>
            </div>
          ) : (
            <>
              {/* Hero */}
              <section className="flex flex-col items-center text-center py-20 px-6">
                <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
                  Gestão Espiritual <span className="text-purple-600">com Axé</span>
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mb-10">
                  Traga organização e harmonia para sua casa espiritual. Uma plataforma feita sob medida
                  para terreiros de Umbanda e Candomblé.
                </p>
                <div className="flex gap-4">
                  <Button
                    size="lg"
                    variant="outline"
                    className={BTN_PURPLE}
                    onClick={() => openHire(prefPlan)}
                  >
                    Contratar plano
                  </Button>
                  <Button size="lg" asChild variant="outline" className={BTN_PURPLE}>
                    <Link to="/login">Já tenho conta</Link>
                  </Button>
                </div>
              </section>

              {/* Features */}
              <section id="features" className="py-20 bg-gray-50">
                <div className="max-w-6xl mx-auto px-6 text-center">
                  <h3 className="text-3xl font-bold mb-12">Funcionalidades que trazem equilíbrio</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Feature icon={<Users className="h-8 w-8 text-purple-600" />} title="Gestão de Membros" desc="Cadastre e organize filhos de santo e frequentadores." />
                    <Feature icon={<CreditCard className="h-8 w-8 text-green-600" />} title="Controle Financeiro" desc="Mensalidades, doações e saídas, tudo em ordem." />
                    <Feature icon={<BarChart3 className="h-8 w-8 text-pink-500" />} title="Relatórios Claros" desc="Veja a evolução financeira com transparência." />
                    <Feature icon={<Shield className="h-8 w-8 text-blue-500" />} title="Proteção de Dados" desc="Segurança total das informações do terreiro." />
                    <Feature icon={<Drum className="h-8 w-8 text-yellow-600" />} title="Tradição + Tecnologia" desc="Respeito às raízes, com inovação no dia a dia." />
                    <Feature icon={<Leaf className="h-8 w-8 text-green-500" />} title="Sustentabilidade" desc="Ferramenta digital, menos papel, mais natureza." />
                  </div>
                </div>
              </section>

              {/* Pricing */}
              <section id="pricing" className="py-20">
                <div className="max-w-5xl mx-auto px-6 text-center">
                  <h3 className="text-3xl font-bold mb-12">Planos para cada terreiro</h3>
                  <div className="grid md:grid-cols-3 gap-8">
                    {PLANS.map((p) => (
                      <Plan
                        key={p.name}
                        name={p.name}
                        price={p.price}
                        features={p.features}
                        highlight={p.highlight}
                        onHire={() => openHire(p.name)}
                      />
                    ))}
                  </div>
                </div>
              </section>

              {/* Reviews */}
              <section id="reviews" className="py-20 bg-gray-50">
                <div className="max-w-6xl mx-auto px-6 text-center">
                  <h3 className="text-3xl font-bold mb-12">O que nossos usuários dizem</h3>
                  <div className="grid md:grid-cols-3 gap-8">
                    <Review name="Mãe Joana" role="Dirigente de Terreiro" text="Agora consigo organizar mensalidades e cadastros sem papelada. Axé!" />
                    <Review name="Pai Carlos" role="Babalorixá" text="O sistema trouxe clareza financeira, me sinto mais seguro na gestão." />
                    <Review name="Ana Clara" role="Filha de Santo" text="Adorei ver tudo digital, moderno e respeitoso com a tradição." />
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </ErrorBoundary>

      <footer className="py-10 border-t text-center text-sm text-gray-500">
        {new Date().getFullYear()} Meu Axé — Com fé e organização
      </footer>

      {/* Modal Contratar/Solicitar Plano */}
      {openForm && (
        <HireModal initialPlan={prefPlan} onClose={() => setOpenForm(false)} />
      )}
    </div>
  );
};

/** ====== Header (navbar bonita + blur + sombra ao rolar + mobile) ====== */
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
        "sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        scrolled ? "bg-white/80 shadow-sm border-b" : "bg-white/40",
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-4">
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/logo.png" // ✅ coloque sua logo em public/logo.png
            alt="Logo - Meu Axé"
            className="h-9 w-auto object-contain"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a href="#features" className="hover:text-purple-700 transition-colors">Funcionalidades</a>
          <a href="#pricing" className="hover:text-purple-700 transition-colors">Planos</a>
          <a href="#reviews" className="hover:text-purple-700 transition-colors">Avaliações</a>
        </nav>

        {/* Ações */}
        <div className="hidden md:flex gap-3">
          <Button asChild variant="outline" className={BTN_PURPLE}>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button
            variant="outline"
            className={BTN_PURPLE}
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
        <div className="md:hidden border-t bg-white">
          <nav className="flex flex-col px-4 py-3 text-sm">
            <a href="#features" onClick={close} className="py-2">Funcionalidades</a>
            <a href="#pricing" onClick={close} className="py-2">Planos</a>
            <a href="#reviews" onClick={close} className="py-2">Avaliações</a>
          </nav>
          <div className="flex gap-3 px-4 pb-4">
            <Button asChild variant="outline" className={`flex-1 ${BTN_PURPLE}`}>
              <Link to="/login" onClick={close}>Entrar</Link>
            </Button>
            <Button
              variant="outline"
              className={`flex-1 ${BTN_PURPLE}`}
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

/** ====== Cards ====== */
function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="p-6 text-center border bg-white shadow-sm hover:shadow-md transition">
      <div className="flex justify-center mb-4">{icon}</div>
      <h4 className="font-semibold text-lg mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{desc}</p>
    </Card>
  );
}

function Plan({
  name,
  price,
  features,
  highlight,
  onHire,
}: {
  name: PlanKey;
  price: string;
  features: string[];
  highlight?: boolean;
  onHire: () => void;
}) {
  return (
    <Card
      className={`p-8 border transition transform hover:-translate-y-2 hover:shadow-xl ${
        highlight ? "border-purple-600 shadow-lg scale-105" : "border-gray-200"
      }`}
    >
      <h4 className="text-xl font-bold mb-2">{name}</h4>
      <p className="text-3xl font-extrabold mb-6">{price}/mês</p>
      <ul className="space-y-2 mb-6 text-sm text-gray-600 text-left">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600" />
            {f}
          </li>
        ))}
      </ul>
      <Button variant="outline" className={`w-full ${BTN_PURPLE}`} onClick={onHire}>
        Solicitar plano
      </Button>
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
            <Button type="button" variant="outline" onClick={onClose} className={`flex-1 ${BTN_PURPLE}`}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="outline"
              className={`flex-1 ${BTN_PURPLE}`}
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
