// src/components/DebugFeatureBar.tsx
"use client";
import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useOrgFeatures } from "@/hooks/useOrgFeatures";

function featureFromPath(pathname: string): string | null {
  if (pathname.startsWith("/superadmin")) return null;
  if (pathname.startsWith("/membros")) return "membros";
  if (pathname.startsWith("/planos")) return "planos";
  if (pathname.startsWith("/assinaturas")) return "assinaturas";
  if (pathname.startsWith("/mensalidades")) return "mensalidades";
  if (pathname.startsWith("/faturas")) return "faturas";
  if (pathname.startsWith("/pagamentos-diversos")) return "pagamentos_diversos";
  if (pathname.startsWith("/relatorios")) return "relatorios";
  if (pathname.startsWith("/usuarios")) return "usuarios";
  if (pathname.startsWith("/pdv")) return "pdv";
  if (pathname.startsWith("/configuracoes")) return "configuracoes";
  return null;
}

export default function DebugFeatureBar() {
  const { pathname } = useLocation();
  const needed = featureFromPath(pathname);

  const { loading, error, orgId, planId, unlockAll, has } = useOrgFeatures();
  const all = ["membros","planos","assinaturas","mensalidades","faturas","pagamentos_diversos","relatorios","usuarios","pdv","configuracoes"];

  const granted = useMemo(() => all.filter((k) => has(k)), [all, has]);
  const pass = needed ? has(needed) : true;

  if (typeof window !== "undefined") {
    console.log("[DBG] useOrgFeatures", { loading, error, orgId, planId, unlockAll, granted, needed, pass });
  }

  return (
    <div style={{position:"sticky",top:0,zIndex:50}} className="bg-yellow-100 text-yellow-900 text-xs px-3 py-1 border-b">
      <b>ORG:</b> {orgId || "(null)"} &nbsp;|&nbsp; 
      <b>PLAN:</b> {planId || "(null)"} &nbsp;|&nbsp; 
      <b>unlockAll:</b> {String(unlockAll)} &nbsp;|&nbsp; 
      <b>error:</b> {error || "-"} &nbsp;|&nbsp; 
      <b>needed:</b> {needed || "-"} &nbsp;|&nbsp;
      <b>pass:</b> {String(pass)} &nbsp;|&nbsp;
      <b>granted:</b> {granted.join(", ") || "-"}
    </div>
  );
}
