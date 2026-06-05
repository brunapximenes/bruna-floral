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
  updateTotais();
}

function renderForn(tipo) {
  const container = document.getElementById('items-' + tipo);
  if (!container) return;
  container.innerHTML = '';

  internoItems[tipo].forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.gridTemplateColumns = '1fr 100px 28px';
    row.innerHTML = `
      <input type="text" placeholder="Nome do fornecedor" value="${item.nome || ''}"
        style="width:100%" oninput="internoItems['${tipo}'][${idx}].nome=this.value"
        onblur="salvarItemInterno('${tipo}',${idx})">
      <input type="number" placeholder="0,00" value="${item.valor || ''}"
        style="width:100%" oninput="internoItems['${tipo}'][${idx}].valor=parseFloat(this.value)||0;updateTotais()"
        onblur="salvarItemInterno('${tipo}',${idx})">
      <button class="rm-btn" onclick="removerItemInterno('${tipo}',${idx})">×</button>`;
    container.appendChild(row);
  });
}

function renderEquipe() {
  const container = document.getElementById('items-equipe');
  if (!container) return;
  container.innerHTML = '';

  internoItems.equipe.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.gridTemplateColumns = '1fr 1fr 100px 28px';
    row.innerHTML = `
      <input type="text" placeholder="Nome" value="${item.nome || ''}"
        style="width:100%" oninput="internoItems.equipe[${idx}].nome=this.value"
        onblur="salvarItemInterno('equipe',${idx})">
      <input type="text" placeholder="Função / dia" value="${item.funcao || ''}"
        style="width:100%" oninput="internoItems.equipe[${idx}].funcao=this.value"
        onblur="salvarItemInterno('equipe',${idx})">
      <input type="number" placeholder="0,00" value="${item.valor || ''}"
        style="width:100%" oninput="internoItems.equipe[${idx}].valor=parseFloat(this.value)||0;updateTotais()"
        onblur="salvarItemInterno('equipe',${idx})">
      <button class="rm-btn" onclick="removerItemInterno('equipe',${idx})">×</button>`;
    container.appendChild(row);
  });
}

/* ── ADICIONAR ──────────────────────────────────────────────── */
async function addForn(tipo) {
  if (!eventoAtual) return;
  const ordem = internoItems[tipo].length;
  const { data, error } = await sb
    .from('internal_costs')
    .insert([{ event_id: eventoAtual.id, tipo, nome: '', valor: 0, ordem }])
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
    .insert([{ event_id: eventoAtual.id, tipo: 'equipe', nome: '', funcao: '', valor: 0, ordem }])
    .select().single();
  if (error) { toast('Erro ao adicionar.', 'erro'); return; }
  internoItems.equipe.push(data);
  renderInterno();
}

/* ── SALVAR ─────────────────────────────────────────────────── */
async function salvarItemInterno(tipo, idx) {
  const item = internoItems[tipo][idx];
  if (!item || !item.id) return;

  const update = { nome: item.nome || '', valor: item.valor || 0 };
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
    internoItems[tipo].forEach(i => { total += parseFloat(i.valor) || 0; });
  });
  return total;
}
