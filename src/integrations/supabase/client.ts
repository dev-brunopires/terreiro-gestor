// src/integrations/supabase/client.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Lê as variáveis do Vite (.env.local)
 * Essas devem estar configuradas na raiz do projeto:
 *
 * VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
 * VITE_SUPABASE_ANON_KEY=eyJhbGciOi... (anon key)
 * VITE_SUPABASE_FUNCTIONS_URL=https://SEU-PROJETO.supabase.co/functions/v1
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "[Supabase] Variáveis de ambiente não configuradas corretamente. " +
      "Confira seu .env.local: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY"
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      "x-client-info": "terreiros-gestor",
    },
  },
});
