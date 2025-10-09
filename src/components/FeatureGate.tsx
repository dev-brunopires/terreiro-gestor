// src/components/FeatureGate.tsx
"use client";
import React from "react";
import { useOrgFeatures } from "@/hooks/useOrgFeatures";

type Props = {
  feature: string | string[];
  anyOf?: boolean;
  invert?: boolean;
  /** Se não informado, o padrão é não mostrar nada (bom para navbar/ícones/botões). */
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

function FeatureGateInner({
  feature,
  anyOf = false,
  invert = false,
  fallback = null, // 👈 padrão silencioso (não mostra aviso no nav)
  children,
}: Props) {
  const { has, unlockAll, loading, error } = useOrgFeatures();

  // Evita “piscar” durante carregamento
  if (loading) return null;

  // Em erro de checagem ou política de fail-open, não bloqueie tudo
  if (error || unlockAll) return <>{children}</>;

  const required = Array.isArray(feature) ? feature : [feature];
  const pass = anyOf ? required.some((c) => has(c)) : required.every((c) => has(c));
  const allow = invert ? !pass : pass;

  return <>{allow ? children : fallback}</>;
}

const FeatureGate = FeatureGateInner;
export default FeatureGate;
export { FeatureGate };
