// src/components/UpgradeCard.tsx
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UpgradeCard({ needed }: { needed: string }) {
  return (
    <Card className="my-6">
      <CardHeader><CardTitle>Recurso indisponível</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <p>Seu plano atual não permite acessar <b>{needed}</b>.</p>
        <Button asChild><a href="/configuracoes?tab=plano">Ver planos</a></Button>
      </CardContent>
    </Card>
  );
}
