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
  renderProximos();
}

/* Próximos pagamentos: lê SEMPRE do sistema (Forma de pagamento do Contrato),
   assim acompanha qualquer alteração feita no contrato. */
function renderProximos() {
  const cont = document.getElementById('items-prox');
  if (!cont) return;

  const resumoEl = document.getElementById('prox-resumo');
  if (resumoEl) {
    const partes = [];
    if (eventoAtual.contrato_valor)    partes.push('Valor do contrato: <strong>' + eventoAtual.contrato_valor + '</strong>');
    if (eventoAtual.contrato_parcelas) {
      const pc = String(eventoAtual.contrato_parcelas);
      partes.push(/^\d+$/.test(pc) ? pc + (pc === '1' ? ' parcela' : ' parcelas') : pc);
    }
    resumoEl.innerHTML = partes.join(' · ');
  }

  // 1) Fonte principal: lista estruturada de parcelas (Forma de pagamento do contrato)
  const lista = Array.isArray(eventoAtual.pagamentos_previstos) ? eventoAtual.pagamentos_previstos : [];
  const validas = lista.filter(p => p && ((p.valor !== '' && p.valor != null) || p.data || p.obs));
  if (validas.length) {
    cont.innerHTML = validas.map(p => {
      const quando = [p.obs, p.data ? _dataBR(p.data) : ''].filter(Boolean).join(' — ') || '—';
      const val = (p.valor !== '' && p.valor != null) ? fmt(parseFloat(p.valor) || 0) : '';
      return '<div class="item-row" style="grid-template-columns:1fr 150px">' +
        '<div>' + quando + '</div>' +
        '<div style="text-align:right;color:var(--verde);font-weight:500">' + val + '</div>' +
        '</div>';
    }).join('');
    return;
  }

  // 2) Fallback (contratos antigos): texto livre de "Vencimentos"
  const venc = (eventoAtual.contrato_vencimentos || '').trim();
  const itens = venc.split(/[·•\n;]+/).map(s => s.trim()).filter(Boolean);
  if (!itens.length) {
    cont.innerHTML = '<div class="pag-vazio">Preencha as <strong>Parcelas</strong> na aba Contrato (Forma de pagamento) para os próximos pagamentos aparecerem aqui.</div>';
    return;
  }
  cont.innerHTML = itens.map(p => {
    const m = p.match(/^\s*(R?\$?\s*[\d][\d.,]*)\s*(.*)$/);
    const valor  = m ? m[1].replace(/^R?\$?\s*/, '') : '';
    const quando = m ? (m[2] || '—') : p;
    return '<div class="item-row" style="grid-template-columns:1fr 150px">' +
      '<div>' + quando + '</div>' +
      '<div style="text-align:right;color:var(--verde);font-weight:500">' + (valor ? 'R$ ' + valor : p) + '</div>' +
      '</div>';
  }).join('');
}

function _dataBR(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('pt-BR');
}

/* ════════ RECIBO EM IMAGEM (para mandar no WhatsApp) ════════ */
async function gerarReciboRecebimento(idx) {
  const p = pagamentosRecebidos[idx];
  if (!p) return;
  const valorNum = parseFloat(p.valor) || 0;
  if (!valorNum) { toast('Preencha o valor do recebimento primeiro.', 'erro'); return; }

  const dc      = eventoAtual.dados_contrato || {};
  const cliente = dc.nome_completo || eventoAtual.nomes || 'Cliente';
  const evento  = eventoAtual.nomes || '';
  const dataEv  = eventoAtual.data_evento ? _dataBR(eventoAtual.data_evento) : '';
  const valorTxt = fmt(valorNum);
  const extenso  = _valorExtenso(valorNum);
  const cidadeData = 'Recife, ' + _dataExtenso(p.data || new Date().toISOString().slice(0, 10));

  const corpo = 'Recebi de ' + cliente + (dc.cpf ? ', inscrito(a) no CPF nº ' + dc.cpf : '') +
    ', a importância de ' + valorTxt + ' (' + extenso + '), referente ao pagamento dos serviços de ' +
    'decoração floral' + (evento ? ' do evento ' + evento : '') + (dataEv ? ', previsto para ' + dataEv : '') +
    '. Para clareza, firmo o presente recibo.';

  toast('Gerando recibo…');
  const canvas = await _desenharRecibo({ numero: idx + 1, corpo, cidadeData, valorTxt });
  canvas.toBlob(async (blob) => {
    if (!blob) { toast('Falha ao gerar o recibo.', 'erro'); return; }
    const nome = 'recibo-' + _slug(evento || cliente) + '.png';
    const file = new File([blob], nome, { type: 'image/png' });
    const msg  = 'Olá! Segue o recibo do pagamento de ' + valorTxt + '. Muito obrigada! 🌸';

    // 1) Tablet/celular: compartilhar direto (abre o WhatsApp já com o recibo anexado, sem salvar)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: msg, title: 'Recibo' }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }

    // 2) Computador: baixa a imagem e abre a conversa do cliente no WhatsApp
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    const tel = _telWhats(eventoAtual.telefone || dc.celular);
    if (tel) window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank');
    toast('Recibo baixado. No WhatsApp que abri, arraste/anexe a imagem na conversa.');
  }, 'image/png');
}

/* Desenha o recibo num canvas e devolve o canvas pronto */
async function _desenharRecibo(d) {
  const W = 1000, padX = 80, maxW = W - padX * 2;
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = '24px Georgia, serif';
  const linhas = _wrapTexto(medir, d.corpo, maxW);
  const H = 900 + linhas.length * 40;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#3d5a47'; ctx.fillRect(0, 0, W, 10);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c9847a'; ctx.font = '28px Georgia, serif';
  ctx.fillText('BRUNA XIMENES', W / 2, 60);
  ctx.fillStyle = '#888'; ctx.font = '16px Arial';
  ctx.fillText('Decoração floral para eventos', W / 2, 100);

  ctx.fillStyle = '#3d5a47'; ctx.font = 'bold 54px Georgia, serif';
  ctx.fillText('RECIBO', W / 2, 180);
  ctx.fillStyle = '#888'; ctx.font = '16px Arial';
  ctx.fillText('Nº ' + d.numero, W / 2, 248);

  ctx.fillStyle = '#faf7f2'; _roundRect(ctx, W / 2 - 190, 292, 380, 70, 12);
  ctx.fillStyle = '#3d5a47'; ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText(d.valorTxt, W / 2, 308);

  ctx.textAlign = 'left'; ctx.fillStyle = '#2c2c2c'; ctx.font = '24px Georgia, serif';
  let y = 420;
  linhas.forEach(ln => { ctx.fillText(ln, padX, y); y += 40; });
  y += 26;
  ctx.fillText(d.cidadeData, padX, y);
  y += 80;

  if (typeof ASSINATURA_DATA_URL !== 'undefined') {
    try {
      const img = await _carregarImg(ASSINATURA_DATA_URL);
      const iw = 250, ih = iw * img.height / img.width;
      ctx.drawImage(img, W / 2 - iw / 2, y - 10, iw, ih);
    } catch (e) { /* sem assinatura */ }
  }
  y += 96;
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 180, y); ctx.lineTo(W / 2 + 180, y); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#2c2c2c'; ctx.font = '18px Georgia, serif';
  ctx.fillText('Bruna Ximenes Decoração', W / 2, y + 12);
  ctx.fillStyle = '#888'; ctx.font = '14px Arial';
  ctx.fillText('CNPJ 23.667.854/0001-21', W / 2, y + 40);
  return canvas;
}

function _wrapTexto(ctx, texto, maxW) {
  const palavras = texto.split(' ');
  const linhas = []; let linha = '';
  palavras.forEach(w => {
    const t = linha ? linha + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && linha) { linhas.push(linha); linha = w; }
    else linha = t;
  });
  if (linha) linhas.push(linha);
  return linhas;
}
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath(); ctx.fill();
}
function _carregarImg(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
function _telWhats(tel) {
  if (!tel) return '';
  let dgs = ('' + tel).replace(/\D/g, '');
  if (!dgs) return '';
  if (dgs.length <= 11) dgs = '55' + dgs;
  return dgs;
}
function _slug(s) {
  return (s || 'recibo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recibo';
}
function _dataExtenso(iso) {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dt = new Date(iso + 'T12:00:00');
  if (isNaN(dt)) return iso;
  return dt.getDate() + ' de ' + meses[dt.getMonth()] + ' de ' + dt.getFullYear();
}

/* Valor por extenso (reais e centavos) */
function _valorExtenso(v) {
  const reais = Math.floor(v);
  const cent = Math.round((v - reais) * 100);
  let s = reais === 0 ? 'zero reais' : _numExtenso(reais) + (reais === 1 ? ' real' : ' reais');
  if (cent > 0) s += ' e ' + _numExtenso(cent) + (cent === 1 ? ' centavo' : ' centavos');
  return s;
}
function _numExtenso(n) {
  if (n === 0) return 'zero';
  const u = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dez = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const cem = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (x) => {
    if (x === 0) return '';
    if (x === 100) return 'cem';
    const c = Math.floor(x / 100), resto = x % 100, dd = Math.floor(resto / 10), un = resto % 10;
    const partes = [];
    if (c) partes.push(cem[c]);
    if (resto) partes.push(resto < 20 ? u[resto] : dez[dd] + (un ? ' e ' + u[un] : ''));
    return partes.join(' e ');
  };
  const milhoes = Math.floor(n / 1000000);
  const milhares = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  const grupos = [];
  if (milhoes) grupos.push([milhoes, ate999(milhoes) + (milhoes === 1 ? ' milhão' : ' milhões')]);
  if (milhares) grupos.push([milhares * 1000, milhares === 1 ? 'mil' : ate999(milhares) + ' mil']);
  if (resto) grupos.push([resto, ate999(resto)]);
  let out = '';
  grupos.forEach((g, i) => {
    if (i > 0) out += (g[0] < 100 || g[0] % 100 === 0) ? ' e ' : ', ';
    out += g[1];
  });
  return out;
}

function renderPagamentos() {
  const cont = document.getElementById('items-pagrec');
  if (!cont) return;
  cont.innerHTML = '';
  pagamentosRecebidos.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.gridTemplateColumns = '1fr 150px 96px 28px';
    row.innerHTML =
      '<input type="date" value="' + (p.data || '') + '" style="width:100%" ' +
        'oninput="pagamentosRecebidos[' + idx + '].data=this.value" onchange="salvarPagamentosRecebidos()">' +
      '<input type="number" placeholder="0,00" value="' + (p.valor || '') + '" style="width:100%" ' +
        'oninput="pagamentosRecebidos[' + idx + '].valor=parseFloat(this.value)||0;atualizarMetricasPag()" onchange="salvarPagamentosRecebidos()">' +
      '<button class="recibo-btn" title="Gerar recibo em PDF para o cliente" onclick="gerarReciboRecebimento(' + idx + ')">🧾 Recibo</button>' +
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
