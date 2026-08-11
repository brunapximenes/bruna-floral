/* ============================================================
   painel-pagamento.js — Aba "Pagamento": recebimentos do cliente
   Guarda em events.pagamentos_recebidos (lista de {data, valor}).
   ============================================================ */

let pagamentosRecebidos = [];

function carregarPagamentos() {
  if (!eventoAtual) return;
  if (!Array.isArray(eventoAtual.pagamentos_recebidos)) eventoAtual.pagamentos_recebidos = [];
  pagamentosRecebidos = eventoAtual.pagamentos_recebidos;
  renderPagamentos();
}

function renderPagamentos() {
  const cont = document.getElementById('items-pagrec');
  if (!cont) return;
  cont.innerHTML = '';
  pagamentosRecebidos.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.gridTemplateColumns = '1fr 150px 28px';
    row.innerHTML =
      '<input type="date" value="' + (p.data || '') + '" style="width:100%" ' +
        'oninput="pagamentosRecebidos[' + idx + '].data=this.value" onchange="salvarPagamentosRecebidos()">' +
      '<input type="number" placeholder="0,00" value="' + (p.valor || '') + '" style="width:100%" ' +
        'oninput="pagamentosRecebidos[' + idx + '].valor=parseFloat(this.value)||0;atualizarMetricasPag()" onchange="salvarPagamentosRecebidos()">' +
      '<button class="rm-btn" onclick="removerPagamentoRecebido(' + idx + ')">×</button>';
    cont.appendChild(row);
  });
  atualizarMetricasPag();
}

function atualizarMetricasPag() {
  const el = document.getElementById('metrics-pag');
  if (!el) return;
  const recebido = calcTotalRecebido();
  const total = (typeof calcVenda === 'function') ? calcVenda() : 0;
  const falta = total - recebido;
  el.innerHTML =
    _mPag('Total recebido', fmt(recebido), 'ok') +
    _mPag('Total do orçamento', total > 0 ? fmt(total) : '—', '') +
    _mPag('Falta receber', total > 0 ? fmt(falta) : '—', falta > 0.005 ? 'bad' : 'ok');
  if (typeof atualizarTotaisInterno === 'function') atualizarTotaisInterno();
}

function _mPag(label, valor, cls) {
  return '<div class="metric"><div class="metric-label">' + label + '</div><div class="metric-value ' + cls + '">' + valor + '</div></div>';
}

/* Total já recebido do cliente (lido direto do evento, mesmo sem abrir a aba) */
function calcTotalRecebido() {
  const arr = (eventoAtual && eventoAtual.pagamentos_recebidos) || [];
  return arr.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
}

async function addPagamentoRecebido() {
  if (!eventoAtual) return;
  pagamentosRecebidos.push({ data: new Date().toISOString().slice(0, 10), valor: 0 });
  await salvarPagamentosRecebidos();
  renderPagamentos();
}

async function removerPagamentoRecebido(idx) {
  pagamentosRecebidos.splice(idx, 1);
  await salvarPagamentosRecebidos();
  renderPagamentos();
}

async function salvarPagamentosRecebidos() {
  if (!eventoAtual) return;
  eventoAtual.pagamentos_recebidos = pagamentosRecebidos;
  const { error } = await sb.from('events')
    .update({ pagamentos_recebidos: pagamentosRecebidos })
    .eq('id', eventoAtual.id);
  if (error) toast('Erro ao salvar o recebimento.', 'erro');
  else { toast('Recebimento salvo ✓'); if (typeof atualizarTotaisInterno === 'function') atualizarTotaisInterno(); }
}
