import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Users,
  CreditCard,
  BarChart3,
  Shield,
  Zap,
  CheckCircle,
  Drum,
  Leaf,
  Star,
} from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4" />
          <div className="w-32 h-4 bg-gray-300 rounded mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      {/* Navbar */}
      <header className="flex items-center justify-between px-8 py-4 border-b">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          🕯️ Terreiro Gestor
        </h1>
        <nav className="flex gap-6 text-sm font-medium">
          <a href="#features" className="hover:text-purple-600">
            Funcionalidades
          </a>
          <a href="#pricing" className="hover:text-purple-600">
            Planos
          </a>
          <a href="#reviews" className="hover:text-purple-600">
            Avaliações
          </a>
        </nav>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link to="/login">Entrar</Link>
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-purple-600 to-pink-500 text-white"
          >
            <Link to="/signup">Começar Agora</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center text-center py-20 px-6 relative overflow-hidden">
        <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
          Gestão Espiritual <span className="text-purple-600">com Axé</span>
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mb-10">
          Traga organização e harmonia para sua casa espiritual. 
          Uma plataforma feita sob medida para terreiros de Umbanda e Candomblé.
        </p>
        <div className="flex gap-4">
          <Button
            size="lg"
            asChild
            className="bg-gradient-to-r from-purple-600 to-pink-500 text-white"
          >
            <Link to="/signup">Criar Conta</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="border-purple-600 text-purple-600 hover:bg-purple-50"
          >
            <Link to="/login">Já tenho conta</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-12">
            Funcionalidades que trazem equilíbrio
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Feature
              icon={<Users className="h-8 w-8 text-purple-600" />}
              title="Gestão de Membros"
              desc="Cadastre e organize filhos de santo e frequentadores."
            />
            <Feature
              icon={<CreditCard className="h-8 w-8 text-green-600" />}
              title="Controle Financeiro"
              desc="Mensalidades, doações e saídas, tudo em ordem."
            />
            <Feature
              icon={<BarChart3 className="h-8 w-8 text-pink-500" />}
              title="Relatórios Claros"
              desc="Veja a evolução financeira com transparência."
            />
            <Feature
              icon={<Shield className="h-8 w-8 text-blue-500" />}
              title="Proteção de Dados"
              desc="Segurança total das informações do terreiro."
            />
            <Feature
              icon={<Drum className="h-8 w-8 text-yellow-600" />}
              title="Tradição + Tecnologia"
              desc="Respeito às raízes, com inovação no dia a dia."
            />
            <Feature
              icon={<Leaf className="h-8 w-8 text-green-500" />}
              title="Sustentabilidade"
              desc="Ferramenta digital, menos papel, mais natureza."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-12">Planos para cada terreiro</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Plan
              name="Axé Básico"
              price="R$49"
              features={["Gestão de membros", "Relatórios básicos"]}
            />
            <Plan
              name="Axé Profissional"
              price="R$99"
              highlight
              features={[
                "Tudo do Básico",
                "Controle Financeiro",
                "Relatórios avançados",
              ]}
            />
            <Plan
              name="Axé Completo"
              price="R$199"
              features={[
                "Tudo do Profissional",
                "Suporte dedicado",
                "Integrações especiais",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold mb-12">
            O que nossos usuários dizem
          </h3>
          <div className="grid md:grid-cols-3 gap-8">
            <Review
              name="Mãe Joana"
              role="Dirigente de Terreiro"
              text="Agora consigo organizar mensalidades e cadastros sem papelada. Axé!"
            />
            <Review
              name="Pai Carlos"
              role="Babalorixá"
              text="O sistema trouxe clareza financeira, me sinto mais seguro na gestão."
            />
            <Review
              name="Ana Clara"
              role="Filha de Santo"
              text="Adorei ver tudo digital, moderno e respeitoso com a tradição."
            />
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 text-center bg-gradient-to-r from-purple-600 to-pink-500 text-white">
        <h3 className="text-3xl font-bold mb-6">
          Pronto para modernizar seu terreiro?
        </h3>
        <p className="mb-8 max-w-xl mx-auto">
          Traga mais organização, transparência e Axé para sua casa espiritual.
        </p>
        <Button size="lg" asChild className="bg-white text-purple-600 font-bold">
          <Link to="/signup">Começar Agora</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t text-center text-sm text-gray-500">
        ✨ {new Date().getFullYear()} Terreiro Gestor — Com fé, organização e Axé ✨
      </footer>
    </div>
  );
};

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
}: {
  name: string;
  price: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <Card
      className={`p-8 border transition transform hover:-translate-y-2 hover:shadow-xl hover:border-purple-600 ${
        highlight ? "border-purple-600 shadow-lg scale-105" : "border-gray-200"
      }`}
    >
      <h4 className="text-xl font-bold mb-2">{name}</h4>
      <p className="text-3xl font-extrabold mb-6">{price}/mês</p>
      <ul className="space-y-2 mb-6 text-sm text-gray-600">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-purple-600" />
            {f}
          </li>
        ))}
      </ul>
      <Button
        asChild
        className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white"
      >
        <Link to="/signup">Escolher</Link>
      </Button>
    </Card>
  );
}

function Review({
  name,
  role,
  text,
}: {
  name: string;
  role: string;
  text: string;
}) {
  return (
    <Card className="p-6 bg-white shadow-sm hover:shadow-md transition text-left">
      <div className="flex items-center gap-3 mb-3">
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

export default Index;
