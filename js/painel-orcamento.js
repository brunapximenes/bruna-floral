/* ============================================================
   painel-orcamento.js — Itens de orçamento (budget_items)
   ============================================================ */

let budgetItems = { cerimonia: [], recepcao: [], operacional: [], locacoes_internas: [], locacoes: [], extras: [] };

/* ── CARREGAR ───────────────────────────────────────────────── */
async function carregarItensOrcamento() {
  if (!eventoAtual) return;

  const { data, error } = await sb
    .from('budget_items')
    .select('*')
    .eq('event_id', eventoAtual.id)
    .order('secao').order('ordem');

  if (error) return;

  budgetItems = { cerimonia: [], recepcao: [], operacional: [], locacoes_internas: [], locacoes: [], extras: [] };
  (data || []).forEach(item => {
    if (budgetItems[item.secao]) budgetItems[item.secao].push(item);
  });

  renderOrcamento();
}

/* ── RENDERIZAR ─────────────────────────────────────────────── */
function renderOrcamento() {
  ['cerimonia', 'recepcao', 'operacional', 'locacoes_internas', 'locacoes', 'extras'].forEach(sec => renderSecao(sec));
  updateTotais();
}

function renderSecao(sec) {
  const container = document.getElementById('items-' + sec);
  if (!container) return;
  container.innerHTML = '';

  budgetItems[sec].forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.gridTemplateColumns = '1fr 70px 90px 90px 28px';
    const subtotal = (parseFloat(item.valor_venda) || 0) * (parseFloat(item.qtd) || 1);
    row.innerHTML = `
      <input type="text" placeholder="Descrição do item" value="${item.descricao || ''}"
        style="width:100%" oninput="budgetItems['${sec}'][${idx}].descricao=this.value"
        onblur="salvarItemOrc('${sec}',${idx})">
      <input type="number" min="1" value="${item.qtd || 1}"
        style="width:100%" oninput="budgetItems['${sec}'][${idx}].qtd=parseFloat(this.value)||1;updateLinhaOrc('${sec}',${idx});updateTotais()"
        onblur="salvarItemOrc('${sec}',${idx})">
      <input type="number" placeholder="0,00" value="${item.valor_venda || ''}"
        style="width:100%" oninput="budgetItems['${sec}'][${idx}].valor_venda=parseFloat(this.value)||0;updateLinhaOrc('${sec}',${idx});updateTotais()"
        onblur="salvarItemOrc('${sec}',${idx})">
      <div class="item-total" id="tot-${sec}-${idx}" style="align-self:center;text-align:right;font-size:13px;font-weight:500;color:var(--verde);padding-right:2px">${fmt(subtotal)}</div>
      <button class="rm-btn" onclick="removerItemOrc('${sec}',${idx})">×</button>`;
    container.appendChild(row);
  });
}

/* Atualiza só o total (Qtd × Valor) da linha editada, sem redesenhar tudo */
function updateLinhaOrc(sec, idx) {
  const item = budgetItems[sec] && budgetItems[sec][idx];
  const cell = document.getElementById(`tot-${sec}-${idx}`);
  if (item && cell) {
    cell.textContent = fmt((parseFloat(item.valor_venda) || 0) * (parseFloat(item.qtd) || 1));
  }
}

/* ── ADICIONAR ──────────────────────────────────────────────── */
async function addItem(sec) {
  if (!eventoAtual) return;
  const ordem = budgetItems[sec].length;

  const { data, error } = await sb
    .from('budget_items')
    .insert([{ event_id: eventoAtual.id, secao: sec, descricao: '', qtd: 1, valor_venda: 0, ordem }])
    .select()
    .single();

  if (error) { toast('Erro ao adicionar item.', 'erro'); return; }
  budgetItems[sec].push(data);
  renderOrcamento();
}

/* ── SALVAR ITEM ────────────────────────────────────────────── */
async function salvarItemOrc(sec, idx) {
  const item = budgetItems[sec][idx];
  if (!item || !item.id) return;

  await sb.from('budget_items').update({
    descricao:   item.descricao   || '',
    qtd:         item.qtd         || 1,
    valor_venda: item.valor_venda || 0,
  }).eq('id', item.id);
}

/* ── REMOVER ITEM ───────────────────────────────────────────── */
async function removerItemOrc(sec, idx) {
  const item = budgetItems[sec][idx];
  if (item && item.id) {
    await sb.from('budget_items').delete().eq('id', item.id);
  }
  budgetItems[sec].splice(idx, 1);
  renderOrcamento();
}

/* ── CÁLCULOS ───────────────────────────────────────────────── */
function _somaSecoes(secs) {
  let total = 0;
  secs.forEach(sec => {
    (budgetItems[sec] || []).forEach(i => {
      total += (parseFloat(i.valor_venda) || 0) * (parseFloat(i.qtd) || 1);
    });
  });
  return total;
}

/* Decoração = tudo, menos as locações extras (que são cobradas "por fora").
   Locações internas fazem parte da decoração e entram no valor dela. */
function calcDecoracao()      { return _somaSecoes(['cerimonia', 'recepcao', 'operacional', 'locacoes_internas', 'extras']); }
function calcLocacoesExtras() { return _somaSecoes(['locacoes']); }
function calcVenda()          { return calcDecoracao() + calcLocacoesExtras(); }

function updateTotais() {
  const decoracao = calcDecoracao();
  const locExtras = calcLocacoesExtras();
  const venda     = decoracao + locExtras;   // total geral
  const custo     = calcCusto();
  const lucro     = venda - custo;
  const budgetRaw = parseFloat((val('budget-cliente') || '0').replace(/[^\d,\.]/g, '').replace(',', '.')) || 0;
  const diff      = venda - budgetRaw;

  const mOrc = document.getElementById('metrics-orc');
  if (mOrc) {
    mOrc.innerHTML =
      metricHTML('Orçamento decoração', fmt(decoracao), '') +
      metricHTML('Locações extras', fmt(locExtras), '') +
      metricHTML('Total geral', fmt(venda), 'ok') +
      metricHTML('Budget cliente', budgetRaw > 0 ? fmt(budgetRaw) : '—', '') +
      metricHTML('Diferença', budgetRaw > 0 ? (diff >= 0 ? '+' : '') + fmt(diff) : '—', budgetRaw > 0 ? (diff >= 0 ? 'ok' : 'bad') : '');
  }

  const mInt = document.getElementById('metrics-int');
  if (mInt) {
    mInt.innerHTML =
      metricHTML('Total de venda', fmt(venda), '') +
      metricHTML('Total de custo', fmt(custo), 'bad') +
      metricHTML('Lucro do evento', fmt(lucro), lucro >= 0 ? 'ok' : 'bad');
  }
}

function metricHTML(label, valor, cls) {
  return `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value ${cls}">${valor}</div></div>`;
}
