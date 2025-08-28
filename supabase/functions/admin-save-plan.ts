// supabase/functions/admin-save-plan/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const URL = Deno.env.get('SUPABASE_URL');
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const sb = createClient(URL, SERVICE);
function toCents(body) {
  if (typeof body.price_cents === 'number') return body.price_cents;
  const n = Number(String(body.price_reais ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
Deno.serve(async (req)=>{
  try {
    // exige usuário autenticado
    const auth = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!auth) return new Response(JSON.stringify({
      error: 'unauthorized'
    }), {
      status: 401
    });
    const body = await req.json();
    const price_cents = toCents(body);
    if (!body.name?.trim() || !price_cents) {
      return new Response(JSON.stringify({
        error: 'Dados inválidos'
      }), {
        status: 400
      });
    }
    const payload = {
      name: body.name.trim(),
      price_cents,
      active: body.active ?? true,
      features: body.features ?? null
    };
    if (body.id) {
      const { data, error } = await sb.from('saas_plans').update(payload).eq('id', body.id).select().maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({
        ok: true,
        plan: data
      }), {
        status: 200
      });
    } else {
      const { data, error } = await sb.from('saas_plans').insert(payload).select().maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({
        ok: true,
        plan: data
      }), {
        status: 201
      });
    }
  } catch (e) {
    return new Response(JSON.stringify({
      error: String(e?.message ?? e)
    }), {
      status: 500
    });
  }
});
