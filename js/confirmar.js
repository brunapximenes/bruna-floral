/* ============================================================
   confirmar.js — Página pública de confirmação de presença (RSVP)
   O convidado abre o link, informa nome + acompanhantes e confirma.
   Insere uma linha em guests (apenas INSERT é permitido para anon).
   ============================================================ */

const _params = new URLSearchParams(location.search);
// Dados injetados pelo servidor (link curto /c/<codigo>); reserva: parâmetros do link antigo
const _CF = (typeof window !== 'undefined' && window.CF) ? window.CF : {};
const _eventId = _CF.id || _params.get('e') || '';

const TIPO_TXT = {
  casamento: 'o casamento', noivado: 'o noivado', aniversario: 'o aniversário',
  batizado: 'o batizado', corporativo: 'o evento'
};

function _fmtDataBR(str) {
  if (!str) return '';
  const d = new Date(str + 'T12:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function initConfirmar() {
  const nome = _CF.nome || _params.get('n') || '';
  const tipo = _CF.tipo || _params.get('t') || '';
  const data = _CF.data || _params.get('d') || '';

  if (!_eventId) {
    document.getElementById('cf-card').innerHTML =
      '<div class="cf-erro">Link inválido. Peça um novo link de confirmação. 🌿</div>';
    return;
  }

  // Cabeçalho amigável
  const titulo = document.getElementById('cf-evento');
  let txt = 'Confirme sua presença';
  if (nome) txt = 'Você está convidado(a)!';
  titulo.textContent = txt;

  const sub = document.getElementById('cf-sub');
  const partes = [];
  if (nome) partes.push('<strong>' + _esc(nome) + '</strong>');
  const dataFmt = _fmtDataBR(data);
  if (dataFmt) partes.push(dataFmt);
  if (partes.length) {
    const prefixo = (TIPO_TXT[tipo] || 'o evento');
    sub.innerHTML = 'Confirme sua presença em ' + prefixo + ' de ' + partes.join(' · ');
  } else {
    sub.innerHTML = 'Preencha abaixo para confirmar sua presença.';
  }

  _toggleCampos();
}

function _esc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Mostra/oculta os campos de acompanhantes conforme "vai / não vai" */
function _toggleCampos() {
  const vai = document.querySelector('input[name="cf-vai"]:checked');
  const bloco = document.getElementById('cf-bloco-acomp');
  bloco.style.display = (vai && vai.value === 'sim') ? '' : 'none';
}

async function enviarConfirmacao() {
  const nome = document.getElementById('cf-nome').value.trim();
  const vaiEl = document.querySelector('input[name="cf-vai"]:checked');
  const erro = document.getElementById('cf-erro');
  const btn  = document.getElementById('cf-enviar');
  erro.textContent = '';

  if (!nome) { erro.textContent = 'Por favor, escreva seu nome.'; return; }
  if (!vaiEl) { erro.textContent = 'Diga se você vai poder comparecer.'; return; }

  const vai = vaiEl.value === 'sim';
  const adultos  = vai ? (parseInt(document.getElementById('cf-adultos').value)  || 0) : 0;
  const criancas = vai ? (parseInt(document.getElementById('cf-criancas').value) || 0) : 0;
  const telefone = document.getElementById('cf-tel').value.trim() || null;
  const mensagem = document.getElementById('cf-recado').value.trim() || null;

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const linha = {
    event_id: _eventId,
    nome,
    telefone,
    status: vai ? 'confirmado' : 'recusado',
    adultos,
    criancas,
    mensagem,
    confirmed_at: new Date().toISOString()
  };

  const { error } = await sb.from('guests').insert(linha);

  btn.disabled = false;
  btn.textContent = 'Confirmar';

  if (error) {
    erro.textContent = 'Não foi possível enviar agora. Tente novamente em instantes.';
    return;
  }

  const total = vai ? (1 + adultos + criancas) : 0;
  document.getElementById('cf-card').innerHTML = vai
    ? '<div class="cf-ok"><div class="cf-ok-ic">💚</div>'
      + '<h2>Presença confirmada!</h2>'
      + '<p>Obrigada, <strong>' + _esc(nome) + '</strong>. Anotamos ' + total
      + (total === 1 ? ' pessoa' : ' pessoas') + '.</p>'
      + '<p class="cf-ok-sub">Até lá! 🌿</p></div>'
    : '<div class="cf-ok"><div class="cf-ok-ic">🌷</div>'
      + '<h2>Tudo bem!</h2>'
      + '<p>Obrigada por avisar, <strong>' + _esc(nome) + '</strong>. Sentiremos sua falta.</p></div>';
}

document.addEventListener('DOMContentLoaded', initConfirmar);
