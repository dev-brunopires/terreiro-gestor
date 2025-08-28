// supabase/functions/pos-open-drawer/index.ts
// Gera sequência ESC/POS para acionar a gaveta (drawer kick) e retorna em base64.
// Padrão ESC p m t1 t2  -> 1B 70 m t1 t2
// m: 0 ou 1 (pino 2 ou 5), t1/t2: tempos (em unidades de 2 ms) — valores comuns 0x19 e 0xFA.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
const json = (payload, status = 200)=>new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
function toBase64(bytes) {
  const bin = Uint8Array.from(bytes);
  return btoa(String.fromCharCode(...bin));
}
serve(async (req)=>{
  try {
    if (req.method !== "POST") return json({
      error: "Method not allowed"
    }, 405);
    const body = await req.json().catch(()=>({}));
    const m = (body.pin ?? 0) === 1 ? 1 : 0;
    const t1 = Number.isInteger(body.t1) ? Math.max(0, Math.min(255, body.t1)) : 0x19; // 25
    const t2 = Number.isInteger(body.t2) ? Math.max(0, Math.min(255, body.t2)) : 0xFA; // 250
    // ESC p m t1 t2
    const bytes = [
      0x1B,
      0x70,
      m,
      t1,
      t2
    ];
    const b64 = toBase64(bytes);
    return json({
      ok: true,
      bytes_hex: bytes.map((b)=>b.toString(16).padStart(2, "0")).join(" "),
      bytes_base64: b64,
      hint: "Envie esses bytes para a impressora (USB/Serial/Rede) usando seu agente ou API local."
    }, 200);
  } catch (err) {
    console.error("[pos-open-drawer] erro:", err);
    return json({
      error: "Erro interno"
    }, 500);
  }
});
