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
function _escAttr(s) { return _esc(s).replace(/"/g, '&quot;'); }

/* Mostra/oculta os campos de acompanhantes conforme "vai / não vai" */
function _toggleCampos() {
  const vai = document.querySelector('input[name="cf-vai"]:checked');
  const bloco = document.getElementById('cf-bloco-acomp');
  bloco.style.display = (vai && vai.value === 'sim') ? '' : 'none';
  if (vai && vai.value === 'sim') _renderNomes();
}

/* Cria um campo de nome para cada acompanhante adulto e cada criança marcados,
   preservando o que já foi digitado. */
function _renderNomes() {
  const a  = Math.max(0, Math.min(parseInt(document.getElementById('cf-adultos').value)  || 0, 20));
  const cr = Math.max(0, Math.min(parseInt(document.getElementById('cf-criancas').value) || 0, 20));
  _renderNomesCampos('cf-nomes-adultos', 'cf-nome-adulto', a, 'Nome do acompanhante');
  _renderCriancas(cr);
}
function _renderNomesCampos(containerId, cls, count, label) {
  const box = document.getElementById(containerId);
  if (!box) return;
  const antigos = [];
  box.querySelectorAll('input').forEach(inp => antigos.push(inp.value));
  let html = '';
  for (let i = 0; i < count; i++) {
    const val = antigos[i] ? _escAttr(antigos[i]) : '';
    html += '<div class="cf-campo">'
      + '<label>' + label + ' ' + (i + 1) + '</label>'
      + '<input type="text" class="' + cls + '" value="' + val + '" placeholder="Nome e sobrenome"></div>';
  }
  box.innerHTML = html;
}
/* Crianças: nome + idade em cada uma (preserva o que já foi digitado) */
function _renderCriancas(count) {
  const box = document.getElementById('cf-nomes-criancas');
  if (!box) return;
  const nomes = [], idades = [];
  box.querySelectorAll('.cf-nome-crianca').forEach(i => nomes.push(i.value));
  box.querySelectorAll('.cf-idade-crianca').forEach(i => idades.push(i.value));
  let html = '';
  for (let i = 0; i < count; i++) {
    const n  = nomes[i]  ? _escAttr(nomes[i])  : '';
    const id = idades[i] ? _escAttr(idades[i]) : '';
    html += '<div class="cf-campo">'
      + '<label>Criança ' + (i + 1) + '</label>'
      + '<div class="cf-crianca-linha">'
      +   '<input type="text" class="cf-nome-crianca" value="' + n + '" placeholder="Nome">'
      +   '<input type="text" class="cf-idade-crianca" value="' + id + '" placeholder="Ex.: 8 meses">'
      + '</div></div>';
  }
  box.innerHTML = html;
}
function _coletarNomes(cls) {
  return Array.from(document.querySelectorAll('.' + cls))
    .map(i => i.value.trim()).filter(Boolean);
}
function _coletarCriancas() {
  const box = document.getElementById('cf-nomes-criancas');
  if (!box) return [];
  const nomes  = box.querySelectorAll('.cf-nome-crianca');
  const idades = box.querySelectorAll('.cf-idade-crianca');
  const res = [];
  for (let i = 0; i < nomes.length; i++) {
    const nome  = nomes[i].value.trim();
    const idade = idades[i] ? idades[i].value.trim() : '';
    if (nome || idade) res.push({ nome: nome, idade: idade });
  }
  return res;
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
  const nomesAdultos  = vai ? _coletarNomes('cf-nome-adulto') : [];
  const nomesCriancas = vai ? _coletarCriancas() : [];

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
    acompanhantes: { adultos: nomesAdultos, criancas: nomesCriancas },
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
