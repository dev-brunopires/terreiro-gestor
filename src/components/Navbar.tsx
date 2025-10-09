// src/components/Navbar.tsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // fecha o menu ao trocar de rota
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header
      className={[
        "sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-white/60",
        scrolled ? "bg-white/80 shadow-sm border-b" : "bg-white/40"
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <img
            src="/logo.png"        // coloque sua logo em /public/logo.png
            alt="Logo"
            className="h-9 w-auto object-contain"
          />
          <span className="text-lg font-semibold text-gray-800 group-hover:text-purple-700 transition-colors">
            Meu Axé
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a href="#features" className="hover:text-purple-700 transition-colors">Funcionalidades</a>
          <a href="#pricing" className="hover:text-purple-700 transition-colors">Planos</a>
          <a href="#reviews" className="hover:text-purple-700 transition-colors">Avaliações</a>
        </nav>

        {/* Ações */}
        <div className="hidden md:flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
          >
            <Link to="/login">Entrar</Link>
          </Button>
          <Button
            asChild
            className="bg-gradient-to-r from-purple-600 to-pink-500 text-white"
          >
            <Link to="/signup">Começar Agora</Link>
          </Button>
        </div>

        {/* Toggle mobile */}
        <button
          aria-label="Abrir menu"
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 border"
          onClick={() => setOpen(v => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden border-t bg-white">
          <nav className="flex flex-col px-4 py-3 text-sm">
            <a href="#features" onClick={() => setOpen(false)} className="py-2">Funcionalidades</a>
            <a href="#pricing"  onClick={() => setOpen(false)} className="py-2">Planos</a>
            <a href="#reviews"  onClick={() => setOpen(false)} className="py-2">Avaliações</a>
          </nav>
          <div className="flex gap-3 px-4 pb-4">
            <Button
              asChild
              variant="outline"
              className="flex-1 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
            >
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="flex-1 bg-gradient-to-r from-purple-600 to-pink-500 text-white">
              <Link to="/signup">Começar Agora</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
