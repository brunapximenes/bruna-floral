/* ============================================================
   supabase-client.js — Inicialização do cliente Supabase
   Requer: config.js carregado antes deste arquivo
   ============================================================ */

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
