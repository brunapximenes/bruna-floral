/* ============================================================
   painel-lista.js — Lista de eventos com filtros
   ============================================================ */

let todosEventos = [];

/* Copia o link público do questionário para enviar aos clientes */
function copiarLinkQuestionario() {
  const url = 'https://bruna-floral.vercel.app/questionario';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => toast('Link do questionário copiado ✓ Envie ao cliente pelo WhatsApp.'))
      .catch(() => prompt('Copie o link do questionário:', url));
  } else {
    prompt('Copie o link do questionário:', url);
  }
}

async function carregarLista() {
  const container = document.getElementById('lista-eventos');
  container.innerHTML = '<p style="color:var(--texto2);padding:20px 0">Carregando eventos...</p>';

  const { data, error } = await sb
    .from('events')
    .select('id, nomes, telefone, tipo_evento, data_evento, status, created_at, num_convidados, local_evento')
    .neq('status', 'arquivado')
    .order('created_at', { ascending: false });

  if (error || !data) {
    container.innerHTML = `
      <div style="background:#fff;border:1px solid #f3d0cd;border-radius:10px;padding:24px 20px;max-width:480px;">
        <p style="font-weight:500;color:#b8706a;margin-bottom:8px;">Não foi possível carregar os eventos</p>
        <p style="font-size:13px;color:#888;line-height:1.6;margin-bottom:16px;">
          O banco de dados provavelmente está <strong>pausado</strong> por inatividade.<br>
          Acesse <a href="https://supabase.com" target="_blank" style="color:#3d5a47;">supabase.com</a>,
          abra o projeto e clique em <strong>Restore project</strong>.<br>
          Após restaurar, clique em "Tentar novamente" abaixo.
        </p>
        <button onclick="carregarLista()"
          style="background:#3d5a47;color:#fff;border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-family:'Jost',sans-serif;font-size:13px;">
          Tentar novamente
        </button>
      </div>`;
    return;
  }

  todosEventos = data || [];
  renderLista(todosEventos);
  renderAgenda();
}

/* tira acentos e deixa minúsculo, para a busca ignorar acentuação */
function _semAcento(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function filtrar() {
  const busca  = _semAcento(document.getElementById('f-busca').value);
  const status = document.getElementById('f-status').value;
  const tipo   = document.getElementById('f-tipo').value;

  const filtrados = todosEventos.filter(e => {
    const matchBusca  = !busca  || _semAcento(e.nomes).includes(busca);
    const matchStatus = !status || e.status === status;
    const matchTipo   = !tipo   || e.tipo_evento === tipo;
    return matchBusca && matchStatus && matchTipo;
  });

  renderLista(filtrados);
}

function renderLista(eventos) {
  const container = document.getElementById('lista-eventos');

  if (!eventos.length) {
    container.innerHTML = `
      <div class="lista-vazia">
        <div class="icon">🌸</div>
        <p>Nenhum evento encontrado.</p>
      </div>`;
    return;
  }

  container.innerHTML = eventos.map(e => {
    const badgeCls   = STATUS_BADGE[e.status]  || 'badge-novo';
    const labelStatus = STATUS_LABELS[e.status] || e.status;
    const labelTipo   = TIPO_LABELS[e.tipo_evento] || e.tipo_evento;
    const dataEvento  = e.data_evento ? `📅 ${fmtData(e.data_evento)}` : '';
    const convidados  = e.num_convidados ? `👥 ${e.num_convidados} pessoas` : '';
    const local       = e.local_evento ? `📍 ${e.local_evento}` : '';
    const chegou      = `Recebido em ${fmtData(e.created_at.split('T')[0])}`;
    const telDig      = (e.telefone || '').replace(/\D/g, '');
    const telefone    = (telDig.length === 10 || telDig.length === 11)
      ? `<a href="https://wa.me/55${telDig}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:#25a15a;text-decoration:none;">📱 ${e.telefone}</a>`
      : (e.telefone ? `📱 ${e.telefone}` : '');

    return `
      <div class="evento-card" onclick="abrirEvento('${e.id}')">
        <div class="evento-card-info">
          <div class="evento-card-nome">${e.nomes || '(sem nome)'}</div>
          <div class="evento-card-meta">
            <span class="evento-card-tipo">${labelTipo}</span>
            ${telefone ? `<span>${telefone}</span>` : ''}
            ${dataEvento ? `<span>${dataEvento}</span>` : ''}
            ${convidados ? `<span>${convidados}</span>` : ''}
            ${local ? `<span>${local}</span>` : ''}
            <span style="margin-left:auto;opacity:.6">${chegou}</span>
          </div>
        </div>
        ${_selectStatus(e)}
      </div>`;
  }).join('');
}

/* Selo de status como seletor — muda direto na lista */
function _selectStatus(e) {
  const badgeCls = STATUS_BADGE[e.status] || 'badge-novo';
  const opts = Object.keys(STATUS_LABELS).map(k =>
    `<option value="${k}" ${e.status === k ? 'selected' : ''}>${STATUS_LABELS[k]}</option>`).join('');
  return `<select class="badge-select ${badgeCls}" title="Mudar status"
    onclick="event.stopPropagation()"
    onchange="event.stopPropagation();mudarStatusLista('${e.id}',this.value,this)">${opts}</select>`;
}

async function mudarStatusLista(id, novo, el) {
  const { error } = await sb.from('events').update({ status: novo }).eq('id', id);
  if (error) { toast('Erro ao mudar status.', 'erro'); return; }
  const ev = todosEventos.find(x => x.id === id);
  if (ev) ev.status = novo;
  el.className = 'badge-select ' + (STATUS_BADGE[novo] || 'badge-novo');
  renderAgenda();   // atualiza o calendário se virou/deixou de ser "fechado"
  toast('Status atualizado ✓');
}

/* ── CALENDÁRIO ANUAL (agenda) — marca os pedidos fechados ──── */
let _agendaAno = new Date().getFullYear();
let _agendaFechados = {};

function renderAgenda() {
  const cont = document.getElementById('agenda-cal');
  if (!cont) return;
  const anoEl = document.getElementById('agenda-ano');
  if (anoEl) anoEl.textContent = _agendaAno;

  _agendaFechados = {};
  (todosEventos || []).forEach(e => {
    if (e.status === 'fechado' && e.data_evento) {
      const p = e.data_evento.split('-').map(Number);
      if (p[0] === _agendaAno) {
        const k = p[1] + '-' + p[2];
        (_agendaFechados[k] = _agendaFechados[k] || []).push({ id: e.id, nomes: e.nomes || 'Evento' });
      }
    }
  });

  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  let html = '';
  for (let mes = 1; mes <= 12; mes++) {
    const primeiro = new Date(_agendaAno, mes - 1, 1).getDay();
    const nDias = new Date(_agendaAno, mes, 0).getDate();
    let dias = '';
    for (let i = 0; i < primeiro; i++) dias += '<span class="mini-dia"></span>';
    for (let d = 1; d <= nDias; d++) {
      const k = mes + '-' + d;
      if (_agendaFechados[k]) {
        const nomes = _agendaFechados[k].map(x => x.nomes).join(', ').replace(/"/g, "'");
        dias += `<span class="mini-dia fechado" title="${nomes}" onclick="abrirDiaAgenda('${k}')">${d}</span>`;
      } else {
        dias += `<span class="mini-dia">${d}</span>`;
      }
    }
    html += `<div class="mini-mes"><div class="mini-mes-tit">${meses[mes - 1]}</div><div class="mini-dias">${dias}</div></div>`;
  }
  cont.innerHTML = html;
}

function mudarAnoAgenda(delta) { _agendaAno += delta; renderAgenda(); }

function abrirDiaAgenda(key) {
  const lista = _agendaFechados[key] || [];
  if (!lista.length) return;
  const [m, d] = key.split('-');
  document.getElementById('agenda-pop-tit').textContent = 'Pedidos em ' + d + '/' + m + '/' + _agendaAno;
  document.getElementById('agenda-pop-lista').innerHTML = lista.map(ev =>
    `<div class="agenda-pop-item"><span>${ev.nomes}</span>` +
    `<button onclick="fecharAgendaPop();abrirEvento('${ev.id}')">Abrir</button></div>`).join('');
  document.getElementById('agenda-pop').style.display = 'flex';
}

function fecharAgendaPop() {
  const p = document.getElementById('agenda-pop');
  if (p) p.style.display = 'none';
}

async function novoEvento() {
  const { data, error } = await sb
    .from('events')
    .insert([{ tipo_evento: 'casamento', status: 'novo', nomes: 'Novo evento' }])
    .select()
    .single();

  if (error) { toast('Erro ao criar evento.', 'erro'); return; }
  await carregarLista();
  abrirEvento(data.id);
}
