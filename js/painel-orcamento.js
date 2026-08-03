/* ============================================================
   painel-orcamento.js — Itens de orçamento (budget_items)
   ============================================================ */

let budgetItems = { cerimonia: [], recepcao: [], operacional: [], locacoes: [], extras: [] };

/* ── CARREGAR ───────────────────────────────────────────────── */
async function carregarItensOrcamento() {
  if (!eventoAtual) return;

  const { data, error } = await sb
    .from('budget_items')
    .select('*')
    .eq('event_id', eventoAtual.id)
    .order('secao').order('ordem');

  if (error) return;

  budgetItems = { cerimonia: [], recepcao: [], operacional: [], locacoes: [], extras: [] };
  (data || []).forEach(item => {
    if (budgetItems[item.secao]) budgetItems[item.secao].push(item);
  });

  renderOrcamento();
}

/* ── RENDERIZAR ─────────────────────────────────────────────── */
function renderOrcamento() {
  ['cerimonia', 'recepcao', 'operacional', 'locacoes', 'extras'].forEach(sec => renderSecao(sec));
  updateTotais();
}

function renderSecao(sec) {
  const container = document.getElementById('items-' + sec);
  if (!container) return;
  container.innerHTML = '';

  budgetItems[sec].forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.gridTemplateColumns = '1fr 70px 90px 28px';
    row.innerHTML = `
      <input type="text" placeholder="Descrição do item" value="${item.descricao || ''}"
        style="width:100%" oninput="budgetItems['${sec}'][${idx}].descricao=this.value"
        onblur="salvarItemOrc('${sec}',${idx})">
      <input type="number" min="1" value="${item.qtd || 1}"
        style="width:100%" oninput="budgetItems['${sec}'][${idx}].qtd=parseFloat(this.value)||1;updateTotais()"
        onblur="salvarItemOrc('${sec}',${idx})">
      <input type="number" placeholder="0,00" value="${item.valor_venda || ''}"
        style="width:100%" oninput="budgetItems['${sec}'][${idx}].valor_venda=parseFloat(this.value)||0;updateTotais()"
        onblur="salvarItemOrc('${sec}',${idx})">
      <button class="rm-btn" onclick="removerItemOrc('${sec}',${idx})">×</button>`;
    container.appendChild(row);
  });
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
function calcVenda() {
  let total = 0;
  ['cerimonia', 'recepcao', 'operacional', 'locacoes', 'extras'].forEach(sec => {
    budgetItems[sec].forEach(i => {
      total += (parseFloat(i.valor_venda) || 0) * (parseFloat(i.qtd) || 1);
    });
  });
  return total;
}

function updateTotais() {
  const venda     = calcVenda();
  const custo     = calcCusto();
  const lucro     = venda - custo;
  const budgetRaw = parseFloat((val('budget-cliente') || '0').replace(/[^\d,\.]/g, '').replace(',', '.')) || 0;
  const diff      = venda - budgetRaw;

  const mOrc = document.getElementById('metrics-orc');
  if (mOrc) {
    mOrc.innerHTML =
      metricHTML('Total de venda', fmt(venda), '') +
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
