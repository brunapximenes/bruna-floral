/* ============================================================
   painel-interno.js — Controle interno de custos (internal_costs)
   ============================================================ */

let internoItems = { flores: [], mobilia: [], equipe: [] };

/* ── CARREGAR ───────────────────────────────────────────────── */
async function carregarItensInterno() {
  if (!eventoAtual) return;

  const { data, error } = await sb
    .from('internal_costs')
    .select('*')
    .eq('event_id', eventoAtual.id)
    .order('tipo').order('ordem');

  if (error) return;

  internoItems = { flores: [], mobilia: [], equipe: [] };
  (data || []).forEach(item => {
    if (internoItems[item.tipo]) internoItems[item.tipo].push(item);
  });

  renderInterno();
  updateTotais();
}

/* ── RENDERIZAR ─────────────────────────────────────────────── */
function renderInterno() {
  renderForn('flores');
  renderForn('mobilia');
  renderEquipe();
  atualizarTotaisInterno();
  updateTotais();
}

function renderForn(tipo) {
  const container = document.getElementById('items-' + tipo);
  if (!container) return;
  container.innerHTML = '';

  internoItems[tipo].forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.gridTemplateColumns = '1fr 70px 100px 90px 28px';
    const subtotal = (parseFloat(item.valor) || 0) * (parseFloat(item.qtd) || 1);
    row.innerHTML = `
      <input type="text" placeholder="Nome do fornecedor" value="${item.nome || ''}"
        style="width:100%" oninput="internoItems['${tipo}'][${idx}].nome=this.value"
        onblur="salvarItemInterno('${tipo}',${idx})">
      <input type="number" min="1" value="${item.qtd || 1}"
        style="width:100%" oninput="internoItems['${tipo}'][${idx}].qtd=parseFloat(this.value)||1;updateLinhaInterno('${tipo}',${idx});updateTotais()"
        onblur="salvarItemInterno('${tipo}',${idx})">
      <input type="number" placeholder="0,00" value="${item.valor || ''}"
        style="width:100%" oninput="internoItems['${tipo}'][${idx}].valor=parseFloat(this.value)||0;updateLinhaInterno('${tipo}',${idx});updateTotais()"
        onblur="salvarItemInterno('${tipo}',${idx})">
      <div class="item-total" id="toti-${tipo}-${idx}" style="align-self:center;text-align:right;font-size:13px;font-weight:500;color:var(--verde);padding-right:2px">${fmt(subtotal)}</div>
      <button class="rm-btn" onclick="removerItemInterno('${tipo}',${idx})">×</button>`;
    container.appendChild(row);
    container.appendChild(_blocoPagForn(tipo, idx, item));
  });
}

function renderEquipe() {
  const container = document.getElementById('items-equipe');
  if (!container) return;
  container.innerHTML = '';

  internoItems.equipe.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.gridTemplateColumns = '1fr 1fr 70px 100px 90px 28px';
    const subtotal = (parseFloat(item.valor) || 0) * (parseFloat(item.qtd) || 1);
    row.innerHTML = `
      <input type="text" placeholder="Nome" value="${item.nome || ''}"
        style="width:100%" oninput="internoItems.equipe[${idx}].nome=this.value"
        onblur="salvarItemInterno('equipe',${idx})">
      <input type="text" placeholder="Função / dia" value="${item.funcao || ''}"
        style="width:100%" oninput="internoItems.equipe[${idx}].funcao=this.value"
        onblur="salvarItemInterno('equipe',${idx})">
      <input type="number" min="1" value="${item.qtd || 1}"
        style="width:100%" oninput="internoItems.equipe[${idx}].qtd=parseFloat(this.value)||1;updateLinhaInterno('equipe',${idx});updateTotais()"
        onblur="salvarItemInterno('equipe',${idx})">
      <input type="number" placeholder="0,00" value="${item.valor || ''}"
        style="width:100%" oninput="internoItems.equipe[${idx}].valor=parseFloat(this.value)||0;updateLinhaInterno('equipe',${idx});updateTotais()"
        onblur="salvarItemInterno('equipe',${idx})">
      <div class="item-total" id="toti-equipe-${idx}" style="align-self:center;text-align:right;font-size:13px;font-weight:500;color:var(--verde);padding-right:2px">${fmt(subtotal)}</div>
      <button class="rm-btn" onclick="removerItemInterno('equipe',${idx})">×</button>`;
    container.appendChild(row);
    container.appendChild(_blocoPagForn('equipe', idx, item));
  });
}

/* Atualiza só o total (Qtd × Valor) da linha editada */
function updateLinhaInterno(tipo, idx) {
  const item = internoItems[tipo] && internoItems[tipo][idx];
  const cell = document.getElementById(`toti-${tipo}-${idx}`);
  if (item && cell) {
    cell.textContent = fmt((parseFloat(item.valor) || 0) * (parseFloat(item.qtd) || 1));
  }
}

/* ── ADICIONAR ──────────────────────────────────────────────── */
async function addForn(tipo) {
  if (!eventoAtual) return;
  const ordem = internoItems[tipo].length;
  const { data, error } = await sb
    .from('internal_costs')
    .insert([{ event_id: eventoAtual.id, tipo, nome: '', qtd: 1, valor: 0, ordem }])
    .select().single();
  if (error) { toast('Erro ao adicionar.', 'erro'); return; }
  internoItems[tipo].push(data);
  renderInterno();
}

async function addEquipe() {
  if (!eventoAtual) return;
  const ordem = internoItems.equipe.length;
  const { data, error } = await sb
    .from('internal_costs')
    .insert([{ event_id: eventoAtual.id, tipo: 'equipe', nome: '', funcao: '', qtd: 1, valor: 0, ordem }])
    .select().single();
  if (error) { toast('Erro ao adicionar.', 'erro'); return; }
  internoItems.equipe.push(data);
  renderInterno();
}

/* ── SALVAR ─────────────────────────────────────────────────── */
async function salvarItemInterno(tipo, idx) {
  const item = internoItems[tipo][idx];
  if (!item || !item.id) return;

  const update = { nome: item.nome || '', qtd: item.qtd || 1, valor: item.valor || 0 };
  if (tipo === 'equipe') update.funcao = item.funcao || '';

  await sb.from('internal_costs').update(update).eq('id', item.id);
}

/* ── REMOVER ────────────────────────────────────────────────── */
async function removerItemInterno(tipo, idx) {
  const item = internoItems[tipo][idx];
  if (item && item.id) {
    await sb.from('internal_costs').delete().eq('id', item.id);
  }
  internoItems[tipo].splice(idx, 1);
  renderInterno();
}

/* ── CÁLCULO CUSTO TOTAL ────────────────────────────────────── */
function calcCusto() {
  let total = 0;
  ['flores', 'mobilia', 'equipe'].forEach(tipo => {
    internoItems[tipo].forEach(i => { total += (parseFloat(i.valor) || 0) * (parseFloat(i.qtd) || 1); });
  });
  return total;
}

/* ── PAGAMENTOS AOS FORNECEDORES ────────────────────────────── */
function _blocoPagForn(tipo, idx, item) {
  const div = document.createElement('div');
  div.className = 'forn-pgtos';
  const pgs = item.pagamentos || [];
  let html = '';
  if (pgs.length) {
    html += '<div class="forn-pgtos-tit">Pagamentos a este fornecedor</div>';
    html += pgs.map((p, j) =>
      '<div class="pgto-linha">' +
        '<input type="date" value="' + (p.data || '') + '" ' +
          'oninput="internoItems[\'' + tipo + '\'][' + idx + '].pagamentos[' + j + '].data=this.value" ' +
          'onchange="salvarPagForn(\'' + tipo + '\',' + idx + ')">' +
        '<input type="number" placeholder="0,00" value="' + (p.valor || '') + '" ' +
          'oninput="internoItems[\'' + tipo + '\'][' + idx + '].pagamentos[' + j + '].valor=parseFloat(this.value)||0;atualizarTotaisInterno()" ' +
          'onchange="salvarPagForn(\'' + tipo + '\',' + idx + ')">' +
        '<button class="rm-btn" onclick="removerPagForn(\'' + tipo + '\',' + idx + ',' + j + ')">×</button>' +
      '</div>').join('');
  }
  html += '<button class="add-pgto" onclick="addPagForn(\'' + tipo + '\',' + idx + ')">+ pagamento</button>';
  div.innerHTML = html;
  return div;
}

async function addPagForn(tipo, idx) {
  const item = internoItems[tipo] && internoItems[tipo][idx];
  if (!item) return;
  if (!Array.isArray(item.pagamentos)) item.pagamentos = [];
  item.pagamentos.push({ data: new Date().toISOString().slice(0, 10), valor: 0 });
  await salvarPagForn(tipo, idx);
  renderInterno();
}

async function removerPagForn(tipo, idx, j) {
  const item = internoItems[tipo] && internoItems[tipo][idx];
  if (!item || !item.pagamentos) return;
  item.pagamentos.splice(j, 1);
  await salvarPagForn(tipo, idx);
  renderInterno();
}

async function salvarPagForn(tipo, idx) {
  const item = internoItems[tipo] && internoItems[tipo][idx];
  if (!item || !item.id) return;
  const { error } = await sb.from('internal_costs')
    .update({ pagamentos: item.pagamentos || [] }).eq('id', item.id);
  if (error) toast('Erro ao salvar pagamento.', 'erro');
  else atualizarTotaisInterno();
}

function calcTotalPagoFornecedores() {
  let total = 0;
  ['flores', 'mobilia', 'equipe'].forEach(tipo => {
    (internoItems[tipo] || []).forEach(i => {
      (i.pagamentos || []).forEach(p => { total += parseFloat(p.valor) || 0; });
    });
  });
  return total;
}

/* Totais no topo do Controle interno: recebido do cliente e pago a fornecedores */
function atualizarTotaisInterno() {
  const el = document.getElementById('metrics-int-topo');
  if (!el) return;
  const rec  = (typeof calcTotalRecebido === 'function') ? calcTotalRecebido() : 0;
  const pago = calcTotalPagoFornecedores();
  el.innerHTML =
    metricHTML('Total recebido do cliente', fmt(rec), 'ok') +
    metricHTML('Total pago a fornecedores', fmt(pago), 'bad');
}
