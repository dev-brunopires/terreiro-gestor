"use client";
import React from "react";
import { useOrgFeatures } from "@/hooks/useOrgFeatures";

type Props = {
  code: string;                      // ex.: "faturas"
  children: React.ReactNode;
  fallback?: React.ReactNode;        // o que mostrar quando não tem acesso
};

export default function FeatureGate({ code, children, fallback = null }: Props) {
  const { has, loading } = useOrgFeatures();
  if (loading) return null;          // pode trocar por skeleton
  if (!has(code)) return <>{fallback}</>;
  return <>{children}</>;
}
