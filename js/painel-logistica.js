/* ============================================================
   painel-logistica.js — Área de Logística de eventos (global)
   Planejamento editável da operação da semana: eventos, equipe
   (quem faz o quê e em que horário), materiais (recolher nos
   fornecedores → levar → montar → desmontar → devolver) e um
   cronograma/observações livre. Salvo em `logistica` (sincroniza
   em todos os aparelhos). Só a Bruna (autenticada) acessa.
   ============================================================ */

let _log = { eventos: [], equipe: [], materiais: [], obs: '' };
let _logTimer = null;

function _le(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Navegação entre telas ─────────────────────────────── */
function abrirLogistica() {
  document.getElementById('tela-lista').classList.remove('active');
  document.getElementById('tela-evento').classList.remove('active');
  document.getElementById('tela-logistica').classList.add('active');
  window.scrollTo({ top: 0 });
  carregarLogistica();
}
function voltarDaLogistica() {
  _salvarLogistica();   // garante o último campo editado
  document.getElementById('tela-logistica').classList.remove('active');
  document.getElementById('tela-lista').classList.add('active');
  if (typeof carregarLista === 'function') carregarLista();
}

/* ── Modelo inicial (exemplo para visualizar) ──────────── */
function _logSeed() {
  return {
    eventos: [
      { nome: 'Festa da Clara (infantil)', data: '2026-11-12', local: '', h_montagem: '', h_evento: '', h_desmontagem: '' },
      { nome: 'Miriam — 60 anos',          data: '2026-11-13', local: '', h_montagem: '', h_evento: '', h_desmontagem: '' }
    ],
    equipe:    [ { nome: '', tarefa: '', evento: '', horario: '' } ],
    materiais: [ { material: '', fornecedor: '', destino: '', recolher: '', devolver: '', r: false, m: false, d: false, v: false } ],
    obs: ''
  };
}

/* ── Carregar / salvar ─────────────────────────────────── */
async function carregarLogistica() {
  const { data, error } = await sb.from('logistica').select('data').eq('id', 'geral').maybeSingle();
  if (!error && data && data.data && Object.keys(data.data).length) {
    _log = Object.assign({ eventos: [], equipe: [], materiais: [], obs: '' }, data.data);
  } else {
    _log = _logSeed();
    _salvarLogistica();   // grava o exemplo inicial
  }
  _renderLog();
}

function _logSaveSoon() {
  clearTimeout(_logTimer);
  _logTimer = setTimeout(_salvarLogistica, 700);
}
async function _salvarLogistica() {
  const obs = document.getElementById('log-obs');
  if (obs) _log.obs = obs.value;
  await sb.from('logistica').upsert({ id: 'geral', data: _log, updated_at: new Date().toISOString() });
}

/* ── Edição de campos ──────────────────────────────────── */
function logSet(secao, i, campo, valor) {
  if (_log[secao] && _log[secao][i]) { _log[secao][i][campo] = valor; _logSaveSoon(); }
}
function logChk(i, campo, marcado) {
  if (_log.materiais[i]) { _log.materiais[i][campo] = marcado; _logSaveSoon(); }
}
function logObsInput() { _logSaveSoon(); }

function logAddEvento()  { _log.eventos.push({ nome: '', data: '', local: '', h_montagem: '', h_evento: '', h_desmontagem: '' }); _renderEventos(); _logSaveSoon(); }
function logAddEquipe()  { _log.equipe.push({ nome: '', tarefa: '', evento: '', horario: '' }); _renderEquipe(); _logSaveSoon(); }
function logAddMaterial(){ _log.materiais.push({ material: '', fornecedor: '', destino: '', recolher: '', devolver: '', r: false, m: false, d: false, v: false }); _renderMateriais(); _logSaveSoon(); }

function logDel(secao, i) {
  const nomes = { eventos: 'este evento', equipe: 'esta pessoa', materiais: 'este material' };
  if (!confirm('Remover ' + (nomes[secao] || 'este item') + '?')) return;
  _log[secao].splice(i, 1);
  if (secao === 'eventos') _renderEventos();
  else if (secao === 'equipe') _renderEquipe();
  else _renderMateriais();
  _logSaveSoon();
}

/* ── Renderização ──────────────────────────────────────── */
function _renderLog() {
  _renderEventos();
  _renderEquipe();
  _renderMateriais();
  const obs = document.getElementById('log-obs');
  if (obs) obs.value = _log.obs || '';
}

function _renderEventos() {
  const box = document.getElementById('log-eventos');
  if (!box) return;
  box.innerHTML = _log.eventos.map((e, i) =>
    '<div class="log-ev">'
    + '<div class="log-ev-top">'
    +   '<input class="log-inp log-ev-nome" value="' + _le(e.nome) + '" placeholder="Nome do evento" onchange="logSet(\'eventos\',' + i + ',\'nome\',this.value)">'
    +   '<button class="log-del" title="Remover" onclick="logDel(\'eventos\',' + i + ')">🗑</button>'
    + '</div>'
    + '<div class="log-ev-grid">'
    +   _campoData('Data', e.data, i, 'data')
    +   _campoTexto('Local', e.local, i, 'local', 'Onde é a festa')
    +   _campoHora('Montagem', e.h_montagem, i, 'h_montagem')
    +   _campoHora('Início do evento', e.h_evento, i, 'h_evento')
    +   _campoHora('Desmontagem', e.h_desmontagem, i, 'h_desmontagem')
    + '</div>'
    + '</div>'
  ).join('');
}
function _campoTexto(rot, val, i, campo, ph) {
  return '<label class="log-f"><span>' + rot + '</span><input class="log-inp" value="' + _le(val) + '" placeholder="' + _le(ph || '') + '" onchange="logSet(\'eventos\',' + i + ',\'' + campo + '\',this.value)"></label>';
}
function _campoData(rot, val, i, campo) {
  return '<label class="log-f"><span>' + rot + '</span><input class="log-inp" type="date" value="' + _le(val) + '" onchange="logSet(\'eventos\',' + i + ',\'' + campo + '\',this.value)"></label>';
}
function _campoHora(rot, val, i, campo) {
  return '<label class="log-f"><span>' + rot + '</span><input class="log-inp" type="time" value="' + _le(val) + '" onchange="logSet(\'eventos\',' + i + ',\'' + campo + '\',this.value)"></label>';
}

function _renderEquipe() {
  const tab = document.getElementById('log-equipe');
  if (!tab) return;
  let h = '<thead><tr><th>Pessoa</th><th>O que faz</th><th>Evento</th><th>Horário</th><th></th></tr></thead><tbody>';
  _log.equipe.forEach((p, i) => {
    h += '<tr>'
      + _td(p.nome,    'equipe', i, 'nome',    'Nome')
      + _td(p.tarefa,  'equipe', i, 'tarefa',  'Função / tarefa')
      + _td(p.evento,  'equipe', i, 'evento',  'Clara / Miriam')
      + _td(p.horario, 'equipe', i, 'horario', 'Ex.: 7h–14h')
      + '<td class="log-c"><button class="log-del" title="Remover" onclick="logDel(\'equipe\',' + i + ')">🗑</button></td>'
      + '</tr>';
  });
  h += '</tbody>';
  tab.innerHTML = h;
}

function _renderMateriais() {
  const tab = document.getElementById('log-materiais');
  if (!tab) return;
  let h = '<thead><tr><th>Material</th><th>Fornecedor</th><th>Vai para</th><th>Recolher</th><th>Devolver</th><th>Status</th><th></th></tr></thead><tbody>';
  _log.materiais.forEach((m, i) => {
    h += '<tr>'
      + _td(m.material,   'materiais', i, 'material',   'O que é')
      + _td(m.fornecedor, 'materiais', i, 'fornecedor', 'De quem')
      + _td(m.destino,    'materiais', i, 'destino',    'Clara / Miriam')
      + _td(m.recolher,   'materiais', i, 'recolher',   'Quando/quem pega')
      + _td(m.devolver,   'materiais', i, 'devolver',   'Quando devolver')
      + '<td class="log-status">'
      +   _chk(m.r, i, 'r', 'Recolhido') + _chk(m.m, i, 'm', 'Montado')
      +   _chk(m.d, i, 'd', 'Desmontado') + _chk(m.v, i, 'v', 'Devolvido')
      + '</td>'
      + '<td class="log-c"><button class="log-del" title="Remover" onclick="logDel(\'materiais\',' + i + ')">🗑</button></td>'
      + '</tr>';
  });
  h += '</tbody>';
  tab.innerHTML = h;
}
function _td(val, secao, i, campo, ph) {
  return '<td><input class="log-inp" value="' + _le(val) + '" placeholder="' + _le(ph) + '" onchange="logSet(\'' + secao + '\',' + i + ',\'' + campo + '\',this.value)"></td>';
}
function _chk(marcado, i, campo, titulo) {
  return '<label class="log-chk" title="' + titulo + '"><input type="checkbox"' + (marcado ? ' checked' : '')
    + ' onchange="logChk(' + i + ',\'' + campo + '\',this.checked)"><span>' + campo.toUpperCase() + '</span></label>';
}

/* ── Imprimir / PDF ────────────────────────────────────── */
function imprimirLogistica() {
  if (document.getElementById('log-obs')) _log.obs = document.getElementById('log-obs').value;
  const statusTxt = (m) => [m.r && 'Recolhido', m.m && 'Montado', m.d && 'Desmontado', m.v && 'Devolvido'].filter(Boolean).join(' · ') || '—';
  const linha = (cells) => '<tr>' + cells.map(c => '<td>' + _le(c) + '</td>').join('') + '</tr>';

  let html = '<h1>Logística</h1>';
  _log.eventos.forEach(e => {
    html += '<div class="ev"><h2>' + _le(e.nome || 'Evento') + '</h2><p>'
      + [e.data ? _le(e.data.split('-').reverse().join('/')) : '', e.local ? _le(e.local) : ''].filter(Boolean).join(' · ') + '<br>'
      + [e.h_montagem && 'Montagem: ' + _le(e.h_montagem), e.h_evento && 'Evento: ' + _le(e.h_evento), e.h_desmontagem && 'Desmontagem: ' + _le(e.h_desmontagem)].filter(Boolean).join(' · ')
      + '</p></div>';
  });

  html += '<h2>Equipe</h2><table><thead><tr><th>Pessoa</th><th>O que faz</th><th>Evento</th><th>Horário</th></tr></thead><tbody>'
    + _log.equipe.map(p => linha([p.nome, p.tarefa, p.evento, p.horario])).join('') + '</tbody></table>';

  html += '<h2>Materiais</h2><table><thead><tr><th>Material</th><th>Fornecedor</th><th>Vai para</th><th>Recolher</th><th>Devolver</th><th>Status</th></tr></thead><tbody>'
    + _log.materiais.map(m => linha([m.material, m.fornecedor, m.destino, m.recolher, m.devolver, statusTxt(m)])).join('') + '</tbody></table>';

  if (_log.obs && _log.obs.trim()) html += '<h2>Cronograma e observações</h2><pre>' + _le(_log.obs) + '</pre>';

  const w = window.open('', '_blank');
  if (!w) { toast('Permita abrir a janela de impressão.', 'erro'); return; }
  w.document.write(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Logística</title><style>'
    + 'body{font-family:Arial,sans-serif;color:#2a2a2a;padding:24px;font-size:12px;}'
    + 'h1{color:#3d5a47;font-size:22px;margin:0 0 12px;} h2{color:#3d5a47;font-size:15px;margin:18px 0 6px;border-bottom:1px solid #ddd6cc;padding-bottom:3px;}'
    + '.ev{margin-bottom:8px;} .ev h2{border:none;margin:4px 0;} .ev p{margin:2px 0;}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:8px;} th,td{border:1px solid #ddd6cc;padding:5px 7px;text-align:left;vertical-align:top;} th{background:#f2ede4;}'
    + 'pre{white-space:pre-wrap;font-family:Arial,sans-serif;background:#faf7f2;padding:10px;border-radius:6px;}'
    + '</style></head><body>' + html + '</body></html>'
  );
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 350);
}
