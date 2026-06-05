/* ============================================================
   painel-lista.js — Lista de eventos com filtros
   ============================================================ */

let todosEventos = [];

async function carregarLista() {
  const container = document.getElementById('lista-eventos');
  container.innerHTML = '<p style="color:var(--texto2);padding:20px 0">Carregando eventos...</p>';

  const { data, error } = await sb
    .from('events')
    .select('id, nomes, tipo_evento, data_evento, status, created_at, num_convidados, local_evento')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<p style="color:var(--rosa)">Erro ao carregar eventos. Verifique a conexão.</p>';
    return;
  }

  todosEventos = data || [];
  renderLista(todosEventos);
}

function filtrar() {
  const busca  = document.getElementById('f-busca').value.toLowerCase();
  const status = document.getElementById('f-status').value;
  const tipo   = document.getElementById('f-tipo').value;

  const filtrados = todosEventos.filter(e => {
    const matchBusca  = !busca  || (e.nomes || '').toLowerCase().includes(busca);
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

    return `
      <div class="evento-card" onclick="abrirEvento('${e.id}')">
        <div class="evento-card-info">
          <div class="evento-card-nome">${e.nomes || '(sem nome)'}</div>
          <div class="evento-card-meta">
            <span class="evento-card-tipo">${labelTipo}</span>
            ${dataEvento ? `<span>${dataEvento}</span>` : ''}
            ${convidados ? `<span>${convidados}</span>` : ''}
            ${local ? `<span>${local}</span>` : ''}
            <span style="margin-left:auto;opacity:.6">${chegou}</span>
          </div>
        </div>
        <span class="badge ${badgeCls}">${labelStatus}</span>
      </div>`;
  }).join('');
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
