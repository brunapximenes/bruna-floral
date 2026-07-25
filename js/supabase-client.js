/* ============================================================
   supabase-client.js — Inicialização do cliente Supabase
   Requer: config.js carregado antes deste arquivo
   ============================================================ */

const { createClient } = supabase;
console.log('[supabase-client] URL:', typeof SUPABASE_URL, SUPABASE_URL && SUPABASE_URL.slice(0, 30));
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
