/* ============================================================
   painel-anotacoes.js — Aba "Anotações" (página livre por evento)
   Campo rico (contenteditable) com a mesma barra de formatação do
   descritivo. Salvo em events.anotacoes_pag — só para a Bruna.
   Calcula estilo OneNote: "2+2=" + espaço → insere o resultado.
   ============================================================ */

let _anotTimer = null;

function carregarAnotacoes() {
  const el = document.getElementById('anotacoes-doc');
  if (!el || !eventoAtual) return;

  const val = eventoAtual.anotacoes_pag || '';
  el.innerHTML = _pareceHtml(val) ? val : _textoParaHtml(val);

  if (el._anotOn) return;
  el._anotOn = true;

  el.addEventListener('input', () => {
    clearTimeout(_anotTimer);
    _anotTimer = setTimeout(_salvarAnotacoesPag, 800);
  });
  // Mesma calculadora estilo OneNote das anotações do descritivo
  el.addEventListener('keydown', _notasCalcKeydownCE);
}

async function _salvarAnotacoesPag() {
  const el = document.getElementById('anotacoes-doc');
  if (!el || !eventoAtual) return;
  const html = el.innerHTML;
  eventoAtual.anotacoes_pag = html;
  await sb.from('events').update({ anotacoes_pag: html }).eq('id', eventoAtual.id);
}
