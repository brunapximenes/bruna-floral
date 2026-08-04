/* ============================================================
   painel-orcamento.js — Itens de orçamento (budget_items)
   ============================================================ */

let budgetItems = { cerimonia: [], recepcao: [], operacional: [], frete_locacao: [], locacoes_internas: [], locacoes: [], extras: [] };

/* ── CARREGAR ───────────────────────────────────────────────── */
async function carregarItensOrcamento() {
  if (!eventoAtual) return;

  const { data, error } = await sb
    .from('budget_items')
    .select('*')
    .eq('event_id', eventoAtual.id)
    .order('secao').order('ordem');

  if (error) return;

  budgetItems = { cerimonia: [], recepcao: [], operacional: [], frete_locacao: [], locacoes_internas: [], locacoes: [], extras: [] };
  (data || []).forEach(item => {
    if (budgetItems[item.secao]) budgetItems[item.secao].push(item);
  });

  renderOrcamento();
}

/* ── RENDERIZAR ─────────────────────────────────────────────── */
const _ORC_SECS = ['cerimonia', 'recepcao', 'operacional', 'frete_locacao', 'locacoes_internas', 'locacoes', 'extras'];

function renderOrcamento() {
  _ORC_SECS.forEach(sec => renderSecao(sec));
  aplicarOrdemBlocos();
  initOrcSortable();
  updateTotais();
}

function renderSecao(sec) {
  const container = document.getElementById('items-' + sec);
  if (!container) return;
  container.innerHTML = '';

  budgetItems[sec].forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.dataset.id = item.id;
    row.style.gridTemplateColumns = '22px 1fr 70px 90px 90px 28px';
    const subtotal = (parseFloat(item.valor_venda) || 0) * (parseFloat(item.qtd) || 1);
    row.innerHTML = `
      <span class="item-drag" title="Arraste para mover">⠿</span>
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

/* Decoração = tudo, menos as locações extras e o frete de locação (cobrados "por fora").
   Locações internas fazem parte da decoração e entram no valor dela. */
function calcDecoracao()      { return _somaSecoes(['cerimonia', 'recepcao', 'operacional', 'locacoes_internas', 'extras']); }
function calcLocacoesExtras() { return _somaSecoes(['locacoes']); }
function calcFreteLocacao()   { return _somaSecoes(['frete_locacao']); }
function calcVenda()          { return calcDecoracao() + calcLocacoesExtras() + calcFreteLocacao(); }

function updateTotais() {
  const decoracao = calcDecoracao();
  const locExtras = calcLocacoesExtras();
  const freteLoc  = calcFreteLocacao();
  const venda     = decoracao + locExtras + freteLoc;   // total geral
  const custo     = calcCusto();
  const lucro     = venda - custo;
  const budgetRaw = parseFloat((val('budget-cliente') || '0').replace(/[^\d,\.]/g, '').replace(',', '.')) || 0;
  const diff      = venda - budgetRaw;

  const mOrc = document.getElementById('metrics-orc');
  if (mOrc) {
    mOrc.innerHTML =
      metricHTML('Orçamento decoração', fmt(decoracao), '') +
      metricHTML('Locações extras', fmt(locExtras), '') +
      metricHTML('Frete de locação', fmt(freteLoc), '') +
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

/* ============================================================
   Reordenar por arraste (⠿) — funciona com mouse e toque.
   Itens podem ser movidos dentro do bloco E entre blocos.
   ============================================================ */
function initOrcSortable() {
  const wrap = document.getElementById('orc-blocos');
  if (!wrap || wrap._sortOn) return;
  wrap._sortOn = true;
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.item-drag'))        _iniciarArrasteItem(e);
    else if (e.target.closest('.bloco-handle')) _iniciarArrasteBloco(e);
  });
}

/* ── ITENS (inclusive trocando de bloco) ─────────────────────── */
function _iniciarArrasteItem(e) {
  const row = e.target.closest('.item-row');
  if (!row) return;
  e.preventDefault();
  row.classList.add('arrastando');

  const mover = (ev) => {
    row.style.pointerEvents = 'none';
    const sob = document.elementFromPoint(ev.clientX, ev.clientY);
    row.style.pointerEvents = '';
    if (!sob) return;
    const cont = sob.closest('.orc-items');
    if (!cont) return;
    const irmaos = Array.from(cont.querySelectorAll('.item-row')).filter(r => r !== row);
    let alvo = null;
    for (const r of irmaos) {
      const rect = r.getBoundingClientRect();
      if (ev.clientY < rect.top + rect.height / 2) { alvo = r; break; }
    }
    if (alvo) cont.insertBefore(row, alvo);
    else cont.appendChild(row);
  };
  const soltar = () => {
    document.removeEventListener('pointermove', mover);
    document.removeEventListener('pointerup', soltar);
    row.classList.remove('arrastando');
    _commitOrdemItens();
  };
  document.addEventListener('pointermove', mover);
  document.addEventListener('pointerup', soltar);
}

/* Reconstrói as seções a partir da ordem no DOM, salva e recalcula os totais */
function _commitOrdemItens() {
  const mapa = {};
  Object.keys(budgetItems).forEach(sec => budgetItems[sec].forEach(it => { mapa[it.id] = it; }));

  const novo = {};
  _ORC_SECS.forEach(s => { novo[s] = []; });
  const mudados = [];

  _ORC_SECS.forEach(sec => {
    const cont = document.getElementById('items-' + sec);
    if (!cont) return;
    Array.from(cont.querySelectorAll('.item-row')).forEach((row, idx) => {
      const it = mapa[row.dataset.id];
      if (!it) return;
      if (it.secao !== sec || it.ordem !== idx) mudados.push({ id: it.id, sec, idx });
      it.secao = sec;
      it.ordem = idx;
      novo[sec].push(it);
    });
  });

  budgetItems = novo;
  mudados.forEach(m => {
    sb.from('budget_items').update({ secao: m.sec, ordem: m.idx }).eq('id', m.id);
  });
  renderOrcamento();   // reconstrói índices + recalcula (locações extras já entram certas)
}

/* ── BLOCOS ──────────────────────────────────────────────────── */
function _iniciarArrasteBloco(e) {
  const wrap = document.getElementById('orc-blocos');
  const card = e.target.closest('.card');
  if (!card || card.parentElement !== wrap) return;
  e.preventDefault();
  card.classList.add('arrastando-bloco');

  const mover = (ev) => {
    const cards = Array.from(wrap.children).filter(c => c !== card && c.style.display !== 'none');
    let alvo = null;
    for (const c of cards) {
      const rect = c.getBoundingClientRect();
      if (ev.clientY < rect.top + rect.height / 2) { alvo = c; break; }
    }
    if (alvo) wrap.insertBefore(card, alvo);
    else wrap.appendChild(card);
  };
  const soltar = () => {
    document.removeEventListener('pointermove', mover);
    document.removeEventListener('pointerup', soltar);
    card.classList.remove('arrastando-bloco');
    _commitOrdemBlocos();
  };
  document.addEventListener('pointermove', mover);
  document.addEventListener('pointerup', soltar);
}

function _commitOrdemBlocos() {
  if (!eventoAtual) return;
  const wrap = document.getElementById('orc-blocos');
  const ordem = Array.from(wrap.children).map(c => c.dataset.sec).filter(Boolean);
  eventoAtual.orcamento_ordem_blocos = JSON.stringify(ordem);
  sb.from('events').update({ orcamento_ordem_blocos: eventoAtual.orcamento_ordem_blocos }).eq('id', eventoAtual.id);
}

/* Aplica a ordem de blocos salva (reancora os cards na ordem do banco) */
function aplicarOrdemBlocos() {
  const wrap = document.getElementById('orc-blocos');
  if (!wrap || !eventoAtual || !eventoAtual.orcamento_ordem_blocos) return;
  let ordem;
  try { ordem = JSON.parse(eventoAtual.orcamento_ordem_blocos); } catch (e) { return; }
  if (!Array.isArray(ordem)) return;
  ordem.forEach(sec => {
    const card = wrap.querySelector('.card[data-sec="' + sec + '"]');
    if (card) wrap.appendChild(card);
  });
}
