/* ============================================================
   exportar-sheets.js — Exportar evento para Google Sheets
   Chama a Vercel Serverless Function /api/export-sheets
   ============================================================ */

async function exportarSheets() {
  if (!eventoAtual) return;

  const btn = document.querySelector('[onclick="exportarSheets()"]');
  const btns = document.querySelectorAll('[onclick="exportarSheets()"]');
  btns.forEach(b => { b.disabled = true; b.textContent = '⏳ Exportando...'; });

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { toast('Sessão expirada. Faça login novamente.', 'erro'); return; }

    const res = await fetch('/api/export-sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ eventId: eventoAtual.id })
    });

    const json = await res.json();

    if (!res.ok) throw new Error(json.error || 'Erro desconhecido');

    toast('✓ Exportado para o Google Sheets!');
    if (json.sheetUrl) {
      setTimeout(() => window.open(json.sheetUrl, '_blank'), 1000);
    }
  } catch (err) {
    console.error(err);
    toast('Erro ao exportar: ' + err.message, 'erro');
  } finally {
    btns.forEach(b => { b.disabled = false; b.innerHTML = '📊 Exportar para Google Sheets'; });
  }
}
