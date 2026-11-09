/* ============================================================
   painel-logistica.js — Área de Logística de eventos (global)
   Planejamento editável da operação da semana como uma AGENDA:
   - Eventos da semana (contexto: datas, horários de montagem/desmontagem)
   - Equipe da semana (lista de nomes cadastrada uma vez)
   - Agenda dia a dia: cada linha = horário · pessoa (escolhida da
     equipe) · o que ela faz · de qual evento é.
   - Observações gerais (materiais, telefones, lembretes).
   Salvo em `logistica` (sincroniza em todos os aparelhos).
   Só a Bruna (autenticada) acessa.
   ============================================================ */

let _log = { eventos: [], equipe: [], dias: [], obs: '' };
let _logTimer = null;

function _le(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _diaSemana(d) {
  const p = (d || '').split('-');
  if (p.length !== 3) return '';
  const dt = new Date(+p[0], +p[1] - 1, +p[2]);
  const nomes = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return nomes[dt.getDay()] || '';
}
function _dataBR(d) {
  const p = (d || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (d || '');
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
    equipe: [ { nome: '' }, { nome: '' }, { nome: '' } ],
    dias: [
      { data: '2026-11-12', itens: [ { hora: '', pessoa: '', atividade: '', evento: 'Festa da Clara (infantil)' } ] },
      { data: '2026-11-13', itens: [ { hora: '', pessoa: '', atividade: '', evento: 'Miriam — 60 anos' } ] }
    ],
    obs: ''
  };
}

/* ── Migração do formato antigo (equipe/materiais em tabela) ──
   Se os dados salvos ainda não têm "dias", converte o que já
   existia numa agenda, sem perder nada que a Bruna tenha digitado. */
function _migra() {
  if (Array.isArray(_log.dias) && _log.dias.length) {
    if (!Array.isArray(_log.equipe)) _log.equipe = [];
    // garante que a equipe seja lista de nomes { nome }
    _log.equipe = _log.equipe.map(p => (p && typeof p === 'object') ? { nome: p.nome || '' } : { nome: String(p || '') });
    return;
  }
  const dias = [];
  const diaDe = (data) => {
    let d = dias.find(x => x.data === (data || ''));
    if (!d) { d = { data: data || '', itens: [] }; dias.push(d); }
    return d;
  };
  [...new Set((_log.eventos || []).map(e => e.data).filter(Boolean))].sort().forEach(diaDe);
  const primeiro = () => dias[0] || diaDe('');
  const roster = [];
  (_log.equipe || []).forEach(p => {
    if (p && typeof p === 'object') {
      if (p.nome) roster.push({ nome: p.nome });
      if (p.nome || p.tarefa || p.horario || p.evento) {
        primeiro().itens.push({ hora: p.horario || '', pessoa: p.nome || '', atividade: p.tarefa || '', evento: p.evento || '' });
      }
    }
  });
  (_log.materiais || []).forEach(m => {
    if (m && (m.material || m.fornecedor || m.recolher || m.devolver)) {
      const at = ['Recolher ' + (m.material || ''),
                  m.fornecedor ? ('— fornecedor: ' + m.fornecedor) : '',
                  m.devolver ? ('· devolver: ' + m.devolver) : ''].join(' ').trim();
      primeiro().itens.push({ hora: m.recolher || '', pessoa: '', atividade: at, evento: m.destino || '' });
    }
  });
  if (!dias.length) dias.push({ data: '', itens: [] });
  dias.forEach(d => { if (!d.itens.length) d.itens.push({ hora: '', pessoa: '', atividade: '', evento: '' }); });
  _log.dias = dias;
  const vistos = {};
  _log.equipe = roster.filter(p => { const k = (p.nome || '').trim(); if (!k || vistos[k]) return false; vistos[k] = 1; return true; });
  if (!_log.equipe.length) _log.equipe = [ { nome: '' }, { nome: '' } ];
  delete _log.materiais;
}

/* ── Carregar / salvar ─────────────────────────────────── */
async function carregarLogistica() {
  const { data, error } = await sb.from('logistica').select('data').eq('id', 'geral').maybeSingle();
  if (!error && data && data.data && Object.keys(data.data).length) {
    _log = Object.assign({ eventos: [], equipe: [], dias: [], obs: '' }, data.data);
    _migra();
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
function logObsInput() { _logSaveSoon(); }

/* ── Eventos da semana ─────────────────────────────────── */
function logSet(secao, i, campo, valor) {
  if (_log[secao] && _log[secao][i]) {
    _log[secao][i][campo] = valor;
    if (secao === 'eventos') _renderDias();   // atualiza as opções de evento na agenda
    _logSaveSoon();
  }
}
function logAddEvento() {
  _log.eventos.push({ nome: '', data: '', local: '', h_montagem: '', h_evento: '', h_desmontagem: '' });
  _renderEventos(); _renderDias(); _logSaveSoon();
}
function logDel(secao, i) {
  if (!confirm('Remover este evento?')) return;
  _log[secao].splice(i, 1);
  if (secao === 'eventos') { _renderEventos(); _renderDias(); }
  _logSaveSoon();
}

/* ── Equipe (lista de nomes) ───────────────────────────── */
function logAddPessoa() { _log.equipe.push({ nome: '' }); _renderEquipe(); _logSaveSoon(); }
function logDelPessoa(i) {
  if (!confirm('Remover esta pessoa da equipe?')) return;
  _log.equipe.splice(i, 1); _renderEquipe(); _renderDias(); _logSaveSoon();
}
function logSetPessoa(i, valor) {
  if (_log.equipe[i]) { _log.equipe[i].nome = valor; _renderDias(); _logSaveSoon(); }
}

/* ── Agenda (dias e linhas) ────────────────────────────── */
function logAddDia() {
  _log.dias.push({ data: '', itens: [ { hora: '', pessoa: '', atividade: '', evento: '' } ] });
  _renderDias(); _logSaveSoon();
}
function logDelDia(di) {
  if (!confirm('Remover este dia inteiro da agenda?')) return;
  _log.dias.splice(di, 1); _renderDias(); _logSaveSoon();
}
function logSetDia(di, campo, valor) {
  if (_log.dias[di]) { _log.dias[di][campo] = valor; _renderDias(); _logSaveSoon(); }
}
function logSetDiaObs(di, valor) {   // nota do dia: salva sem re-render (não perde o foco)
  if (_log.dias[di]) { _log.dias[di].obs = valor; _logSaveSoon(); }
}
function logAddItem(di) {
  if (_log.dias[di]) {
    (_log.dias[di].itens = _log.dias[di].itens || []).push({ hora: '', pessoa: '', atividade: '', evento: '' });
    _renderDias(); _logSaveSoon();
  }
}
function logDelItem(di, ii) {
  if (_log.dias[di] && _log.dias[di].itens) { _log.dias[di].itens.splice(ii, 1); _renderDias(); _logSaveSoon(); }
}
function logSetItem(di, ii, campo, valor) {
  const it = _log.dias[di] && _log.dias[di].itens && _log.dias[di].itens[ii];
  if (it) { it[campo] = valor; _logSaveSoon(); }   // sem re-render: não perde o foco
}

/* ── Renderização ──────────────────────────────────────── */
function _renderLog() {
  _renderEventos();
  _renderEquipe();
  _renderExportSelect();
  _renderDias();
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
  const box = document.getElementById('log-equipe-lista');
  if (!box) return;
  box.innerHTML = (_log.equipe || []).map((p, i) =>
    '<div class="log-pessoa-row">'
    + '<span class="log-pessoa-ic">👤</span>'
    + '<input class="log-inp" value="' + _le(p.nome) + '" placeholder="Nome da pessoa" onchange="logSetPessoa(' + i + ',this.value)">'
    + '<button class="log-del" title="Remover" onclick="logDelPessoa(' + i + ')">🗑</button>'
    + '</div>'
  ).join('');
  _renderExportSelect();   // mantém a lista de exportação em sincronia
}

function _optsPessoas(sel) {
  const nomes = (_log.equipe || []).map(p => p.nome).filter(n => n && n.trim());
  let html = '<option value="">— escolher pessoa —</option>';
  let achou = false;
  nomes.forEach(n => { const s = (n === sel); if (s) achou = true; html += '<option' + (s ? ' selected' : '') + ' value="' + _le(n) + '">' + _le(n) + '</option>'; });
  if (sel && !achou) html += '<option selected value="' + _le(sel) + '">' + _le(sel) + '</option>';
  return html;
}
function _optsEventos(sel) {
  const nomes = (_log.eventos || []).map(e => e.nome).filter(n => n && n.trim());
  let html = '<option value="">— evento —</option>';
  let achou = false;
  nomes.forEach(n => { const s = (n === sel); if (s) achou = true; html += '<option' + (s ? ' selected' : '') + ' value="' + _le(n) + '">' + _le(n) + '</option>'; });
  if (sel && !achou) html += '<option selected value="' + _le(sel) + '">' + _le(sel) + '</option>';
  return html;
}

function _itemHTML(di, ii, it) {
  return '<div class="log-item">'
    + '<div class="log-item-top">'
    +   '<input class="log-inp log-item-hora" type="text" value="' + _le(it.hora) + '" placeholder="Ex.: 8h" onchange="logSetItem(' + di + ',' + ii + ',\'hora\',this.value)">'
    +   '<button class="log-del" title="Remover linha" onclick="logDelItem(' + di + ',' + ii + ')">🗑</button>'
    + '</div>'
    + '<select class="log-inp log-item-pessoa" onchange="logSetItem(' + di + ',' + ii + ',\'pessoa\',this.value)">' + _optsPessoas(it.pessoa) + '</select>'
    + '<input class="log-inp log-item-desc" value="' + _le(it.atividade) + '" placeholder="O que essa pessoa vai fazer (ex.: recolher arranjos, montar mesa do bolo, entregar flores...)" onchange="logSetItem(' + di + ',' + ii + ',\'atividade\',this.value)">'
    + '<select class="log-inp log-item-evento" onchange="logSetItem(' + di + ',' + ii + ',\'evento\',this.value)">' + _optsEventos(it.evento) + '</select>'
    + '</div>';
}

function _renderDias() {
  const box = document.getElementById('log-dias');
  if (!box) return;
  // ordena por data (dias sem data vão para o fim); índices seguem a ordem exibida
  _log.dias.sort((a, b) => {
    if (!a.data && !b.data) return 0;
    if (!a.data) return 1;
    if (!b.data) return -1;
    return a.data < b.data ? -1 : a.data > b.data ? 1 : 0;
  });
  box.innerHTML = _log.dias.map((d, di) => {
    const itens = (d.itens || []).map((it, ii) => _itemHTML(di, ii, it)).join('');
    const semana = _diaSemana(d.data);
    return '<div class="log-dia">'
      + '<div class="log-dia-cab">'
      +   '<div class="log-dia-cab-top">'
      +     '<span class="log-dia-semana">' + _le(semana || 'escolha a data') + '</span>'
      +     '<button class="log-del log-dia-del" title="Remover dia" onclick="logDelDia(' + di + ')">🗑</button>'
      +   '</div>'
      +   '<input class="log-inp log-dia-data" type="date" value="' + _le(d.data) + '" onchange="logSetDia(' + di + ',\'data\',this.value)">'
      + '</div>'
      + '<div class="log-dia-itens">' + itens + '</div>'
      + '<button class="log-add-min" onclick="logAddItem(' + di + ')">+ Adicionar linha</button>'
      + '<textarea class="log-dia-obs" placeholder="📝 Observações do dia" onchange="logSetDiaObs(' + di + ',this.value)">' + _le(d.obs || '') + '</textarea>'
      + '</div>';
  }).join('');
}

/* ── Exportar a logística de UMA pessoa (para mandar para ela) ── */
function _renderExportSelect() {
  const sel = document.getElementById('log-export-pessoa');
  if (!sel) return;
  const atual = sel.value;
  const nomes = (_log.equipe || []).map(p => p.nome).filter(n => n && n.trim());
  sel.innerHTML = '<option value="">— escolher pessoa —</option>' +
    nomes.map(n => '<option value="' + _le(n) + '">' + _le(n) + '</option>').join('');
  if (atual) sel.value = atual;
}

function _itensDaPessoa(nome) {
  const res = [];
  (_log.dias || []).forEach(dia => {
    const its = (dia.itens || []).filter(it => (it.pessoa || '') === nome);
    if (its.length) res.push({ data: dia.data, itens: its });
  });
  return res;
}

function _textoPessoa(nome) {
  const blocos = _itensDaPessoa(nome);
  let txt = '📋 Logística — ' + nome + '\n';
  if (!blocos.length) return txt + '\n(Sem atividades registradas.)';
  blocos.forEach(b => {
    const semana = _diaSemana(b.data);
    txt += '\n' + (semana ? semana + ', ' : '') + _dataBR(b.data) + '\n';
    b.itens.forEach(it => {
      const h = it.hora ? it.hora + ' — ' : '';
      const ev = it.evento ? ' (' + it.evento + ')' : '';
      txt += '• ' + h + it.atividade + ev + '\n';
    });
  });
  return txt;
}

function _pessoaSelecionada() {
  const sel = document.getElementById('log-export-pessoa');
  const nome = sel ? sel.value : '';
  if (!nome) { if (typeof toast === 'function') toast('Escolha uma pessoa na lista.', 'erro'); return ''; }
  return nome;
}

function exportarPessoaSelecionada() {
  const nome = _pessoaSelecionada();
  if (!nome) return;
  const blocos = _itensDaPessoa(nome);
  let html = '<h1>Logística — ' + _le(nome) + '</h1>';
  if (!blocos.length) html += '<p>Sem atividades registradas para esta pessoa.</p>';
  blocos.forEach(b => {
    const titulo = [_diaSemana(b.data), _dataBR(b.data)].filter(Boolean).join(' — ');
    html += '<h2>' + _le(titulo) + '</h2><table><tbody>';
    b.itens.forEach(it => {
      html += '<tr><td class="h">' + _le(it.hora || '') + '</td><td>' + _le(it.atividade || '')
        + (it.evento ? ' <span class="ev">(' + _le(it.evento) + ')</span>' : '') + '</td></tr>';
    });
    html += '</tbody></table>';
  });
  const w = window.open('', '_blank');
  if (!w) { if (typeof toast === 'function') toast('Permita abrir a janela de impressão.', 'erro'); return; }
  w.document.write(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Logística — ' + _le(nome) + '</title><style>'
    + 'body{font-family:Arial,sans-serif;color:#2a2a2a;padding:24px;font-size:13px;}'
    + 'h1{color:#3d5a47;font-size:20px;margin:0 0 12px;} h2{color:#3d5a47;font-size:14px;margin:16px 0 6px;border-bottom:1px solid #ddd6cc;padding-bottom:3px;}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:6px;} td{border-bottom:1px solid #eee;padding:6px 8px;vertical-align:top;} td.h{white-space:nowrap;font-weight:bold;color:#3d5a47;width:90px;}'
    + '.ev{color:#c9847a;font-size:11px;}'
    + '</style></head><body>' + html + '</body></html>'
  );
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 350);
}

async function copiarPessoaSelecionada() {
  const nome = _pessoaSelecionada();
  if (!nome) return;
  const txt = _textoPessoa(nome);
  try {
    await navigator.clipboard.writeText(txt);
    if (typeof toast === 'function') toast('Logística de ' + nome + ' copiada! É só colar no WhatsApp.', 'ok');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); if (typeof toast === 'function') toast('Logística de ' + nome + ' copiada!', 'ok'); }
    catch (_) { if (typeof toast === 'function') toast('Não consegui copiar automaticamente.', 'erro'); }
    document.body.removeChild(ta);
  }
}

/* ── Imprimir / PDF ────────────────────────────────────── */
function imprimirLogistica() {
  if (document.getElementById('log-obs')) _log.obs = document.getElementById('log-obs').value;

  let html = '<h1>Logística da semana</h1>';

  if ((_log.eventos || []).length) {
    html += '<h2>Eventos</h2>';
    _log.eventos.forEach(e => {
      const linhaTop = [e.data ? _dataBR(e.data) : '', e.local].filter(Boolean).map(_le).join(' · ');
      const linhaH = [e.h_montagem && 'Montagem ' + _le(e.h_montagem), e.h_evento && 'Início ' + _le(e.h_evento), e.h_desmontagem && 'Desmontagem ' + _le(e.h_desmontagem)].filter(Boolean).join(' · ');
      html += '<div class="ev"><b>' + _le(e.nome || 'Evento') + '</b>' + (linhaTop ? ' — ' + linhaTop : '')
        + (linhaH ? '<br><span class="sub">' + linhaH + '</span>' : '') + '</div>';
    });
  }

  const roster = (_log.equipe || []).map(p => p.nome).filter(n => n && n.trim());
  if (roster.length) html += '<h2>Equipe</h2><p>' + roster.map(_le).join(' · ') + '</p>';

  html += '<h2>Agenda</h2>';
  (_log.dias || []).forEach(d => {
    const titulo = [_diaSemana(d.data), _dataBR(d.data)].filter(Boolean).join(' — ') || 'Sem data';
    html += '<h3>' + _le(titulo) + '</h3>';
    html += '<table><thead><tr><th>Horário</th><th>Pessoa</th><th>O que faz</th><th>Evento</th></tr></thead><tbody>';
    (d.itens || []).forEach(it => {
      html += '<tr><td>' + _le(it.hora || '') + '</td><td>' + _le(it.pessoa || '') + '</td><td>' + _le(it.atividade || '') + '</td><td>' + _le(it.evento || '') + '</td></tr>';
    });
    html += '</tbody></table>';
    if (d.obs && d.obs.trim()) html += '<p class="diaobs">📝 ' + _le(d.obs) + '</p>';
  });

  if (_log.obs && _log.obs.trim()) html += '<h2>Observações gerais</h2><pre>' + _le(_log.obs) + '</pre>';

  const w = window.open('', '_blank');
  if (!w) { if (typeof toast === 'function') toast('Permita abrir a janela de impressão.', 'erro'); return; }
  w.document.write(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Logística</title><style>'
    + 'body{font-family:Arial,sans-serif;color:#2a2a2a;padding:24px;font-size:12px;}'
    + 'h1{color:#3d5a47;font-size:22px;margin:0 0 12px;} h2{color:#3d5a47;font-size:15px;margin:18px 0 6px;border-bottom:1px solid #ddd6cc;padding-bottom:3px;}'
    + 'h3{color:#3d5a47;font-size:13px;margin:14px 0 4px;}'
    + '.ev{margin-bottom:8px;} .ev .sub{color:#6b6b6b;font-size:11px;}'
    + '.diaobs{background:#faf7f2;border-left:3px solid #c9847a;padding:6px 10px;margin:0 0 10px;font-size:11px;color:#6b6b6b;}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:8px;} th,td{border:1px solid #ddd6cc;padding:5px 7px;text-align:left;vertical-align:top;} th{background:#f2ede4;}'
    + 'pre{white-space:pre-wrap;font-family:Arial,sans-serif;background:#faf7f2;padding:10px;border-radius:6px;}'
    + '</style></head><body>' + html + '</body></html>'
  );
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 350);
}
