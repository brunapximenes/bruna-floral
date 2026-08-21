/* ============================================================
   painel-contrato.js — Aba "Contrato" do painel
   Documento editável, salvo na nuvem (events.contrato_html).
   Auto-preenche os dados que o sistema já tem.
   ============================================================ */

let _ctTimer = null;
let _ctDoc = null;
let _ctChave = null;

async function carregarContrato() {
  if (!eventoAtual) return;
  await _buscarDadosCliente();     // pega os dados que o cliente pode ter enviado pelo link
  renderDadosCliente();
  const CHAVE = 'contrato-v1-' + eventoAtual.id;
  const doc   = document.getElementById('contrato-doc');

  const daNuvem = eventoAtual.contrato_html;
  const local   = localStorage.getItem(CHAVE);

  if (daNuvem) {
    doc.innerHTML = daNuvem;
    _ctGuardarLocal(CHAVE, daNuvem);
  } else if (local) {
    doc.innerHTML = local;
    salvarContratoNuvem(local, true);
  } else {
    doc.innerHTML = templateContrato(eventoAtual);
    _ctGuardarLocal(CHAVE, doc.innerHTML);
  }

  _ctBind(doc, CHAVE);
  preencherCamposPagamento();

  if (!doc._hist && typeof criarHistorico === 'function') {
    doc._hist = criarHistorico(doc, _ctHtmlLimpo, (h) => { doc.innerHTML = h; _ctSalvar(); });
  }
  if (doc._hist) doc._hist.reset(_ctHtmlLimpo());
}

/* Busca no banco os dados que o cliente enviou pelo link (mantém atualizado) */
async function _buscarDadosCliente() {
  if (!eventoAtual) return;
  try {
    const { data } = await sb.from('events').select('dados_contrato').eq('id', eventoAtual.id).single();
    if (data) eventoAtual.dados_contrato = data.dados_contrato;
  } catch (e) { /* mantém o que já tem */ }
}

/* Botão de atualizar (caso o cliente preencha com a aba já aberta) */
async function atualizarDadosCliente() {
  await _buscarDadosCliente();
  renderDadosCliente();
  toast('Dados do cliente atualizados ✓');
}

const _CT_CLI_CAMPOS = [
  ['nome_completo', 'Nome completo'], ['cpf', 'CPF'], ['estado_civil', 'Estado civil'],
  ['nacionalidade', 'Nacionalidade'], ['endereco', 'Endereço'], ['celular', 'Celular'],
  ['insta', 'Instagram'], ['email', 'E-mail'],
  ['forn_fotografia', 'Fotografia'], ['forn_filmagem', 'Filmagem'],
  ['forn_assessoria', 'Assessoria'],
  ['forn_make', 'Make/cabelo'], ['forn_vestido', 'Vestido'],
  ['forn_bolo', 'Bolo'], ['forn_doces', 'Doces'],
  ['forn_buffet', 'Buffet'], ['forn_iluminacao', 'Iluminação'],
];

/* Mostra os dados do cliente — EDITÁVEIS: o cliente preenche pelo link e você completa aqui */
function renderDadosCliente() {
  const box = document.getElementById('ct-cliente-box');
  if (!box) return;
  const dc = (eventoAtual && eventoAtual.dados_contrato) || {};

  const linhas = _CT_CLI_CAMPOS.map(([k, rot]) =>
    '<div class="ct-cli-item"><span class="ct-cli-rot">' + rot + '</span>' +
    '<input class="ct-cli-input" data-k="' + k + '" value="' + _ctEscAttr(dc[k] || '') + '" ' +
    'placeholder="—" onchange="salvarDadosClienteEdit()"></div>').join('');

  box.innerHTML =
    '<div class="ct-cliente-tit">👤 Dados do cliente ' +
      '<button class="ct-cli-atualizar" onclick="atualizarDadosCliente()">↻ Buscar do link</button>' +
      '<span class="ct-cliente-obs">o cliente preenche pelo link; você pode completar/editar aqui. Depois clique em "↺ Preencher do sistema"</span></div>' +
    '<div class="ct-cli-grid">' + linhas + '</div>';
}

/* Salva as edições que você faz na caixa de dados do cliente */
async function salvarDadosClienteEdit() {
  if (!eventoAtual) return;
  const dc = Object.assign({}, eventoAtual.dados_contrato || {});
  document.querySelectorAll('#ct-cliente-box .ct-cli-input').forEach(inp => {
    dc[inp.dataset.k] = inp.value.trim();
  });
  eventoAtual.dados_contrato = dc;
  const { error } = await sb.from('events').update({ dados_contrato: dc }).eq('id', eventoAtual.id);
  if (!error) toast('Dados do cliente salvos ✓');
  else toast('Erro ao salvar os dados do cliente.', 'erro');
}

function _ctEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _ctEscAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

let _parcelas = [];   // lista estruturada de parcelas: { obs, data (ISO), valor }

/* Preenche os campos de forma de pagamento com o que está salvo no evento */
function preencherCamposPagamento() {
  if (!eventoAtual) return;
  const setv = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };
  setv('ct-valor', eventoAtual.contrato_valor);
  setv('ct-extenso', eventoAtual.contrato_valor_extenso);
  setv('ct-parcelas', eventoAtual.contrato_parcelas);
  _parcelas = Array.isArray(eventoAtual.pagamentos_previstos) ? eventoAtual.pagamentos_previstos : [];
  renderParcelas();
  const vEl = document.getElementById('ct-valor');
  if (vEl && typeof calcVenda === 'function' && calcVenda() > 0) {
    vEl.placeholder = 'Orçamento: ' + fmt(calcVenda());
  }
}

function renderParcelas() {
  const cont = document.getElementById('ct-parcelas-lista');
  if (!cont) return;
  cont.innerHTML = '';
  _parcelas.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.style.gridTemplateColumns = '1fr 150px 130px 28px';
    row.innerHTML =
      '<input type="text" placeholder="Entrada / 1ª parcela…" value="' + (p.obs || '') + '" ' +
        'oninput="_parcelas[' + i + '].obs=this.value" onchange="salvarPagamento()">' +
      '<input type="date" value="' + (p.data || '') + '" ' +
        'oninput="_parcelas[' + i + '].data=this.value" onchange="salvarPagamento()">' +
      '<input type="number" placeholder="0,00" value="' + (p.valor != null ? p.valor : '') + '" ' +
        'oninput="_parcelas[' + i + '].valor=this.value" onchange="salvarPagamento()">' +
      '<button class="rm-btn" onclick="removerParcelaContrato(' + i + ')">×</button>';
    cont.appendChild(row);
  });
}

function addParcelaContrato() {
  _parcelas.push({ obs: '', data: '', valor: '' });
  renderParcelas();
  salvarPagamento();
}
function removerParcelaContrato(i) {
  _parcelas.splice(i, 1);
  renderParcelas();
  salvarPagamento();
}

/* Monta o texto de "Vencimentos" (para a cláusula do contrato) a partir das parcelas */
function _vencsTexto(lista) {
  return (lista || [])
    .filter(p => p && (p.valor !== '' && p.valor != null || p.data))
    .map(p => {
      const lbl = p.obs ? p.obs + ': ' : '';
      const val = (p.valor !== '' && p.valor != null) ? fmt(parseFloat(p.valor) || 0) : '';
      const dt  = p.data ? _ctData(p.data) : '';
      return (lbl + val + (dt ? ' em ' + dt : '')).trim();
    })
    .filter(Boolean)
    .join(' · ');
}

/* Salva a forma de pagamento no evento (não regenera o contrato — isso é no "Preencher do sistema") */
async function salvarPagamento() {
  if (!eventoAtual) return;
  const g = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
  const upd = {
    contrato_valor:         g('ct-valor')    || null,
    contrato_valor_extenso: g('ct-extenso')  || null,
    contrato_parcelas:      g('ct-parcelas') || null,
    pagamentos_previstos:   _parcelas,
    contrato_vencimentos:   _vencsTexto(_parcelas) || null,   // texto derivado, p/ a cláusula do contrato
  };
  const { error } = await sb.from('events').update(upd).eq('id', eventoAtual.id);
  if (!error) { Object.assign(eventoAtual, upd); toast('Forma de pagamento salva ✓'); }
  else toast('Erro ao salvar a forma de pagamento.', 'erro');
}

/* Regenera o contrato com os dados atuais do sistema (mantém o Anexo se já houver) */
async function preencherContrato() {
  if (!eventoAtual) { toast('Nenhum evento aberto.', 'erro'); return; }
  if (!confirm('Preencher novamente com os dados do sistema? O texto que você editou à mão neste contrato será substituído (o Anexo é mantido).')) return;
  await _buscarDadosCliente();     // garante os dados mais recentes do cliente
  renderDadosCliente();
  const CHAVE = 'contrato-v1-' + eventoAtual.id;
  const doc   = document.getElementById('contrato-doc');

  // preserva o anexo atual, se houver
  const anexoAtual = doc.querySelector('#ct-anexo');
  doc.innerHTML = templateContrato(eventoAtual);
  if (anexoAtual) {
    const novoAnexo = doc.querySelector('#ct-anexo');
    if (novoAnexo) novoAnexo.innerHTML = anexoAtual.innerHTML;
  }
  _ctGuardarLocal(CHAVE, doc.innerHTML);
  salvarContratoNuvem(doc.innerHTML);
  _ctBind(doc, CHAVE);
  toast('Contrato preenchido do sistema ✓');
}

/* Anexa o Descritivo daquele evento no final do contrato */
function anexarDescritivo() {
  if (!eventoAtual) return;
  const doc   = document.getElementById('contrato-doc');
  const anexo = doc.querySelector('#ct-anexo');
  if (!anexo) { toast('Área de anexo não encontrada.', 'erro'); return; }

  // pega o descritivo salvo na nuvem; se não houver, gera do modelo
  let html = eventoAtual.descritivo_html
    || localStorage.getItem('desc-v1-' + eventoAtual.id)
    || (typeof templateDescritivo === 'function' ? templateDescritivo(eventoAtual) : '');
  if (!html) { toast('Nenhum descritivo encontrado para anexar.', 'erro'); return; }

  // envolve numa caixa com a MESMA geometria do descritivo (largura útil, padding e
  // position:relative), para as fotos flutuantes caírem exatamente no mesmo lugar
  anexo.innerHTML = '<div class="ds-anexo-doc">' + html + '</div>';
  _ctSalvar();
  toast('Descritivo anexado ✓');
}

function _ctBind(doc, CHAVE) {
  _ctDoc = doc;
  _ctChave = CHAVE;
  doc.oninput = _ctSalvar;
  ativarImagensArrastaveis(doc, _ctSalvar);   // imagens do anexo ficam móveis
}

/* HTML do contrato sem os controles temporários das imagens (alça e ×) */
function _ctHtmlLimpo() {
  const clone = _ctDoc.cloneNode(true);
  clone.querySelectorAll('.ds-ui').forEach(el => el.remove());
  clone.querySelectorAll('.ds-img-sel').forEach(el => el.classList.remove('ds-img-sel'));
  return clone.innerHTML;
}

function _ctSalvar() {
  if (!_ctDoc) return;
  const html = _ctHtmlLimpo();
  _ctGuardarLocal(_ctChave, html);
  clearTimeout(_ctTimer);
  _ctTimer = setTimeout(() => salvarContratoNuvem(html), 1000);
}

/* ── Torna as imagens (.ds-img-wrap) móveis/redimensionáveis dentro de um doc,
   salvando via callback. Suporta seleção de VÁRIAS (Ctrl/Shift+clique) e
   arrastar todas juntas. Funciona com mouse e toque. ── */
function ativarImagensArrastaveis(doc, onSave) {
  if (doc._imgArrastavelOn) return;
  doc._imgArrastavelOn = true;
  let sels = [];       // imagens selecionadas (.ds-img-wrap)
  let arr = null;

  const limparUI = (w) => w.querySelectorAll('.ds-ui').forEach(el => el.remove());

  function desselecionarTodos() {
    sels.forEach(w => { w.classList.remove('ds-img-sel'); limparUI(w); });
    sels = [];
  }
  function montarUI() {
    sels.forEach(limparUI);
    if (sels.length === 1) {
      const w = sels[0];
      const del = document.createElement('span'); del.className = 'ds-img-del ds-ui'; del.textContent = '×';
      const alca = document.createElement('span'); alca.className = 'ds-img-handle ds-ui'; alca.title = 'Redimensionar';
      w.appendChild(del); w.appendChild(alca);
    }
    // com várias selecionadas fica só o contorno — arrasta todas juntas
  }
  function selecionarUnico(w) {
    desselecionarTodos();
    sels = [w]; w.classList.add('ds-img-sel'); montarUI();
  }
  function alternar(w) {
    const i = sels.indexOf(w);
    if (i >= 0) { sels.splice(i, 1); w.classList.remove('ds-img-sel'); limparUI(w); }
    else { sels.push(w); w.classList.add('ds-img-sel'); }
    montarUI();
  }

  doc.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('ds-img-del')) {
      const w = e.target.closest('.ds-img-wrap');
      if (w) { const i = sels.indexOf(w); if (i >= 0) sels.splice(i, 1); w.remove(); onSave(); }
      return;
    }
    const wrap = e.target.closest ? e.target.closest('.ds-img-wrap') : null;
    if (!wrap) desselecionarTodos();
  });

  doc.addEventListener('pointerdown', (e) => {
    const wrap = e.target.closest ? e.target.closest('.ds-img-wrap') : null;
    if (!wrap) return;
    const cls = e.target.classList;
    if (cls.contains('ds-img-del')) return;   // × é tratado no clique
    e.preventDefault();
    const resize = cls.contains('ds-img-handle');
    const adicionar = e.ctrlKey || e.metaKey || e.shiftKey;

    if (adicionar && !resize) { alternar(wrap); return; }   // só soma/tira da seleção

    if (resize) {
      if (sels.indexOf(wrap) < 0) selecionarUnico(wrap);
      arr = { tipo: 'resize', wrap, x0: e.clientX, w0: parseFloat(wrap.style.width) || wrap.offsetWidth };
    } else {
      if (sels.indexOf(wrap) < 0) selecionarUnico(wrap);    // clicou numa fora da seleção
      const itens = sels.map(w => ({ w, left0: parseFloat(w.style.left) || 0, top0: parseFloat(w.style.top) || 0 }));
      arr = { tipo: 'mover', x0: e.clientX, y0: e.clientY, itens };
    }

    const mover = (ev) => {
      if (!arr) return;
      const dx = ev.clientX - arr.x0, dy = ev.clientY - arr.y0;
      if (arr.tipo === 'mover') {
        arr.itens.forEach(it => {
          it.w.style.left = (it.left0 + dx) + 'px';
          it.w.style.top  = (it.top0 + dy) + 'px';
        });
      } else {
        arr.wrap.style.width = Math.max(50, arr.w0 + dx) + 'px';
      }
    };
    const soltar = () => {
      document.removeEventListener('pointermove', mover);
      document.removeEventListener('pointerup', soltar);
      if (arr) { arr = null; onSave(); }
    };
    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
  });
}

function _ctGuardarLocal(chave, html) {
  try { localStorage.setItem(chave, html); } catch (e) { /* limite do navegador */ }
}

async function salvarContratoNuvem(html, silencioso) {
  if (!eventoAtual) return;
  const { error } = await sb.from('events').update({ contrato_html: html }).eq('id', eventoAtual.id);
  if (!error) {
    eventoAtual.contrato_html = html;
    if (!silencioso) toast('Contrato salvo na nuvem ✓');
  } else if (!silencioso) {
    toast('Erro ao salvar o contrato na nuvem.', 'erro');
  }
}

function imprimirContrato() {
  const nome = (eventoAtual && eventoAtual.nomes) ? eventoAtual.nomes : 'Contrato';
  const cssDesc = (typeof _dsCssImprimir === 'function') ? _dsCssImprimir() : '';
  const conteudo = _ctHtmlLimpo();   // sem alças/× das imagens
  const win  = window.open('', '_blank');
  win.document.write(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<title>Contrato — ' + nome + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">' +
    '<style>' + _ctCssImprimir() + cssDesc + '</style></head>' +
    '<body>' + conteudo + '</body></html>'
  );
  win.document.close();
  win.addEventListener('load', function () { win.focus(); win.print(); });
}

/* ── HELPERS ─────────────────────────────────────────────────── */
function _ctData(iso) {
  if (!iso) return '____/____/______';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

function _ctDataExtenso(d) {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return 'Recife, ' + d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear() + '.';
}

function _ctFornLinha(rotuloA, valA, rotuloB, valB) {
  const campo = (v) => '<span class="ct-fill">' + (v || '') + '</span>';
  let linha = '<div class="ct-forn-linha"><span>' + rotuloA + ': </span>' + campo(valA);
  if (rotuloB) linha += '<span>' + rotuloB + ': </span>' + campo(valB);
  else linha += '<span></span><span></span>';
  return linha + '</div>';
}

/* Copia o link do formulário de dados do cliente para este evento */
function copiarLinkDados() {
  if (!eventoAtual) { toast('Nenhum evento aberto.', 'erro'); return; }
  const url = 'https://bruna-floral.vercel.app/dados?id=' + eventoAtual.id;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(() => toast('Link copiado ✓ Envie ao cliente pelo WhatsApp.'))
      .catch(() => prompt('Copie o link e envie ao cliente:', url));
  } else {
    prompt('Copie o link e envie ao cliente:', url);
  }
}

/* Imagem da assinatura da Bruna (embutida em js/assinatura.js), se disponível */
function _assinaturaImg() {
  return (typeof ASSINATURA_DATA_URL !== 'undefined')
    ? '<img class="ct-assinatura-img" src="' + ASSINATURA_DATA_URL + '" alt="Assinatura">'
    : '';
}

/* ── FORMATAR A LINHA no estilo do contrato (1 clique) ─────── */
function aplicarEstiloContrato(tipo) {
  const doc = document.getElementById('contrato-doc');
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) { toast('Clique na linha que quer formatar.', 'erro'); return; }

  let node = sel.anchorNode;
  if (node && node.nodeType === 3) node = node.parentNode;
  let blk = node;
  while (blk && blk !== doc && blk.parentNode && blk.parentNode !== doc) {
    if (blk.tagName === 'LI') break;
    blk = blk.parentNode;
  }
  if (!blk || blk === doc) { toast('Clique dentro de uma linha do contrato.', 'erro'); return; }

  const texto = blk.textContent.trim();
  if (!texto) { toast('A linha está vazia.', 'erro'); return; }

  let novo;
  if (tipo === 'sec') {
    novo = document.createElement('div'); novo.className = 'ct-sec'; novo.textContent = texto;
  } else if (tipo === 'sub') {
    novo = document.createElement('div'); novo.className = 'ct-sub'; novo.textContent = texto;
  } else if (tipo === 'item') {
    novo = document.createElement('ul');
    const li = document.createElement('li'); li.textContent = texto; novo.appendChild(li);
  } else { // normal
    novo = document.createElement('p'); novo.textContent = texto;
  }

  if (blk.tagName === 'LI' && tipo !== 'item') {
    const ul = blk.closest('ul');
    blk.remove();
    if (ul) { ul.after(novo); if (!ul.querySelector('li')) ul.remove(); }
    else doc.appendChild(novo);
  } else {
    blk.replaceWith(novo);
  }

  _ctSalvar();
  toast('Formatação aplicada ✓');
}

/* ── TEMPLATE DO CONTRATO ────────────────────────────────────── */
function templateContrato(ev) {
  const dc    = ev.dados_contrato || {};   // dados que o cliente preencheu pelo link
  const nome  = dc.nome_completo || ev.nomes || '';
  const cel   = dc.celular || ev.telefone || '';
  const data  = _ctData(ev.data_evento);
  const local = ev.local_evento || '';
  const cerim = ev.cerimonial || '';
  const valorSis = (typeof calcVenda === 'function' && calcVenda() > 0) ? fmt(calcVenda()) : '';
  const valor    = ev.contrato_valor || valorSis || 'R$ __________';
  const extenso  = ev.contrato_valor_extenso || '';
  const parcelas = ev.contrato_parcelas || '';
  const vencs    = ev.contrato_vencimentos || '';
  const assin = _ctDataExtenso(new Date());
  const f = (v) => '<span class="ct-fill">' + (v || '') + '</span>';
  const _ph = '<span class="ct-fill"></span>';   // campo em branco pra preencher à mão

  return `
  <h1 class="ct-titulo">Contrato de Prestação de Serviços de Decoração Floral</h1>

  <div class="ct-sec">Das partes</div>

  <div class="ct-sub">CONTRATADA</div>
  <p>Bruna Ximenes Decoração, inscrita no CNPJ nº 23.667.854/0001-21, neste ato representada por Bruna Padilha Ximenes de Mendonça, inscrita no CPF nº 097.176.324-05, residente e domiciliada na Av. Rui Barbosa, 870, apto 602, Graças, Recife/PE.</p>
  <p>Celular: (81) 99272-6432 &nbsp; · &nbsp; E-mail: bruna.p.ximenes@gmail.com</p>

  <div class="ct-sub">CONTRATANTE</div>
  <p>Nome: ${f(nome)}</p>
  <p>CPF: ${f(dc.cpf)} &nbsp;&nbsp; Insta: ${f(dc.insta)}</p>
  <p>Estado civil: ${f(dc.estado_civil)}</p>
  <p>Nacionalidade: ${f(dc.nacionalidade)}</p>
  <p>Endereço: ${f(dc.endereco)}</p>
  <p>Celular: ${f(cel)}</p>
  <p>E-mail: ${f(dc.email)}</p>

  <div class="ct-sub">Fornecedores <span class="ct-obs">(preenchidos pelo cliente ou por você — pode deixar em branco)</span></div>
  <div class="ct-forn">
    ${_ctFornLinha('Fotografia', dc.forn_fotografia, 'Filmagem', dc.forn_filmagem)}
    ${_ctFornLinha('Assessoria', dc.forn_assessoria, 'Cerimonial', cerim)}
    ${_ctFornLinha('Make/cabelo', dc.forn_make, 'Vestido', dc.forn_vestido)}
    ${_ctFornLinha('Bolo', dc.forn_bolo, 'Doces', dc.forn_doces)}
    ${_ctFornLinha('Local', local, 'Buffet', dc.forn_buffet)}
    ${_ctFornLinha('Iluminação', dc.forn_iluminacao, '', null)}
  </div>

  <div class="ct-sec">Cláusula 1ª – Do objeto</div>
  <p>O presente contrato tem por objeto a prestação de serviços de <strong>decoração floral</strong> para o evento do CONTRATANTE, a ser executada conforme o DESCRITIVO em anexo.</p>
  <p>Data do evento: ${f(data)} &nbsp;&nbsp; Local: ${f(local)}</p>
  <p><strong>§1º</strong> O DESCRITIVO anexo é <strong>parte integrante e inseparável</strong> deste contrato, e todos os serviços serão executados exatamente conforme nele especificado (itens, quantidades, estilo e áreas contempladas).</p>
  <p><strong>§2º</strong> E-mails e mensagens trocados entre as partes passam a integrar este acordo.</p>
  <p><strong>§3º</strong> Qualquer alteração no escopo após o fechamento só terá validade por escrito, mediante aditivo ou novo orçamento, podendo implicar ajuste de valor.</p>

  <div class="ct-sec">Cláusula 2ª – Do preço e forma de pagamento</div>
  <p>Pelo serviço, o CONTRATANTE pagará à CONTRATADA o valor de <strong>${valor}</strong> ( ${extenso ? extenso : '<span class="ct-fill"></span>'} ).</p>
  <p><strong>Forma de pagamento</strong> — Qt. parcelas: ${parcelas ? parcelas : _ph}</p>
  <p>Vencimentos: ${vencs ? vencs.replace(/\n/g, '<br>') : _ph}</p>
  <p>Pagamento por PIX, depósito, DOC ou TED — Banco Inter (077), Ag. 0001, C/C 1916738-5, titular Bruna Padilha Ximenes, PIX CNPJ 23.667.854/0001-21.</p>
  <p><strong>§1º</strong> O atraso no pagamento de qualquer parcela implicará multa de 2% e juros de 1% ao mês, além de correção monetária.</p>
  <p><strong>§2º</strong> A montagem da decoração fica condicionada à quitação do saldo devedor conforme cronograma; salvo acordo em contrário, a decoração só será executada mediante pagamento antecipado do saldo.</p>

  <div class="ct-sec">Cláusula 3ª – Da produção e das características</div>
  <p>Após o fechamento, o CONTRATANTE não poderá alterar as características do que foi contratado (tamanho, cor, dimensões), salvo havendo disponibilidade da CONTRATADA e mediante pagamento do valor adicional, se houver diferença.</p>
  <p><em>Parágrafo único.</em> O processo é artesanal e ligado à natureza, podendo apresentar variações de tonalidade, tamanho e forma; ficam ressalvadas pequenas diferenças entre a referência apresentada e o resultado final.</p>

  <div class="ct-sec">Cláusula 4ª – Da indisponibilidade de flores</div>
  <p>Havendo indisponibilidade das flores escolhidas, a CONTRATADA fará a substituição preservando estilo, cores e qualidade previamente definidos.</p>
  <p><strong>§1º</strong> Fica garantido o mesmo padrão de qualidade, independentemente de pequenas diferenças de tonalidade, forma e textura.</p>
  <p><strong>§2º</strong> Em pedido com espécie específica determinada, havendo indisponibilidade, a CONTRATADA notificará o CONTRATANTE antes da compra; se o CONTRATANTE discordar da substituição, a CONTRATADA restituirá os valores pagos até então, sem multa; não sendo possível contato, a CONTRATADA prosseguirá com a substituição para não prejudicar o pedido.</p>

  <div class="ct-sec">Cláusula 5ª – Da montagem, finalização e desmontagem</div>
  <p>Os serviços serão montados e finalizados no local do evento, no dia, pela equipe da CONTRATADA.</p>
  <p><strong>§1º</strong> A CONTRATADA finalizará as principais áreas de 1 (uma) a 2 (duas) horas antes do horário do evento, para os registros de foto e vídeo. Arranjos sensíveis (fora da água ou expostos ao sol) podem ser posicionados mais próximo do horário, para preservar a qualidade.</p>
  <p><strong>§2º</strong> A desmontagem ocorrerá após o término, em horário acordado com o CONTRATANTE ou o local.</p>
  <p><strong>§3º</strong> Em decoração completa, os valores de fretes e deslocamentos já estão inclusos no bloco "operacional" do descritivo. Custos de solicitações posteriores serão tratados por aditivo.</p>

  <div class="ct-sec">Cláusula 6ª – Do acesso e condições no local</div>
  <p>O CONTRATANTE se responsabiliza por garantir que a CONTRATADA tenha acesso ao espaço no horário necessário para a montagem, com as condições adequadas (tempo hábil, energia e espaço).</p>
  <p><em>Parágrafo único.</em> Atrasos ou impedimentos causados pelo local, por terceiros ou pelo próprio CONTRATANTE não são de responsabilidade da CONTRATADA, não ensejam abatimento de valores, e eventuais custos extras daí decorrentes correm por conta do CONTRATANTE.</p>

  <div class="ct-sec">Cláusula 7ª – Das locações e danos</div>
  <p>A CONTRATADA se responsabiliza pela contratação de todo o material e equipe descritos no anexo.</p>
  <p><strong>§1º</strong> Em caso de dano ao material locado durante a montagem ou desmontagem pela equipe da CONTRATADA, esta arcará com o reparo ou reposição perante a empresa proprietária.</p>
  <p><strong>§2º</strong> Em caso de dano ao material locado durante a festa ou em momento no qual a equipe da CONTRATADA não esteja presente, o CONTRATANTE será responsável pelo reparo ou reposição.</p>

  <div class="ct-sec">Cláusula 8ª – Da responsabilidade</div>
  <p>A CONTRATADA não responde por atrasos, falhas ou prejuízos decorrentes de caso fortuito, força maior, atos de terceiros (outros fornecedores ou o local do evento) ou atos do próprio CONTRATANTE.</p>

  <div class="ct-sec">Cláusula 9ª – Da remarcação</div>
  <p>Caso o CONTRATANTE precise remarcar a data, deverá comunicar a CONTRATADA com a maior antecedência possível.</p>
  <p><strong>§1º</strong> A remarcação fica sujeita à disponibilidade de agenda da CONTRATADA.</p>
  <p><strong>§2º</strong> Os valores já pagos serão aproveitados para a nova data, podendo haver reajuste em razão da sazonalidade das flores, mudança de local ou aumento de custos.</p>

  <div class="ct-sec">Cláusula 10ª – Da força maior e caso fortuito</div>
  <p>Nenhuma das partes responderá pelo descumprimento decorrente de caso fortuito ou força maior (fenômenos climáticos severos, determinações de autoridades, pandemias, interdição do local, greves e situações análogas).</p>
  <p><em>Parágrafo único.</em> Nessas hipóteses, as partes buscarão a remarcação; não sendo possível, a CONTRATADA restituirá os valores ainda não comprometidos com custos já assumidos (flores, insumos e fornecedores), retendo apenas o necessário para cobrir tais custos, sem multa para nenhuma das partes.</p>

  <div class="ct-sec">Cláusula 11ª – Da rescisão e penalidades</div>
  <p>O contrato poderá ser rescindido: a) por mútuo acordo, sem prejuízo às partes; b) por inadimplência do CONTRATANTE, hipótese em que a CONTRATADA poderá deixar de executar o serviço.</p>
  <p><strong>§1º – Cancelamento pelo CONTRATANTE</strong> (ressalvada a força maior). O CONTRATANTE arcará com dois valores distintos:</p>
  <p>a) os CUSTOS já assumidos pela CONTRATADA até a data do cancelamento (flores, insumos, sinais e reservas a fornecedores e equipe, e elaboração do projeto); e</p>
  <p>b) MULTA compensatória, separada dos custos acima, pela indisponibilidade da data reservada e pela perda de oportunidade de outros eventos, no valor de:</p>
  <ul>
    <li>10% do valor total do contrato, se o cancelamento ocorrer com mais de 30 (trinta) dias de antecedência; ou</li>
    <li>20% do valor total do contrato, se ocorrer com 30 (trinta) dias ou menos de antecedência.</li>
  </ul>
  <p>Os valores já pagos serão usados primeiro para cobrir os custos (a) e depois a multa (b). Havendo saldo a favor do CONTRATANTE, será devolvido; sendo insuficiente, o CONTRATANTE pagará a diferença.</p>
  <p><strong>§2º – Cancelamento pela CONTRATADA</strong> (ressalvada a força maior). A CONTRATADA:</p>
  <p>a) restituirá integralmente todos os valores já pagos pelo CONTRATANTE; e</p>
  <p>b) pagará multa de 10% do valor total apenas se cancelar com 30 (trinta) dias ou menos de antecedência. Cancelando com mais de 30 dias, não haverá multa, por haver tempo hábil para o CONTRATANTE contratar outra empresa.</p>

  <div class="ct-sec">Cláusula 12ª – Da proteção de dados (LGPD) e da imagem</div>
  <p>Os dados pessoais fornecidos serão utilizados exclusivamente para a execução deste contrato, observada a Lei nº 13.709/2018 (LGPD).</p>
  <p><em>Parágrafo único.</em> A CONTRATADA detém os direitos sobre o trabalho floral e a decoração produzida, podendo registrá-los e utilizar suas imagens em portfólio, redes sociais, materiais de divulgação, matérias e concursos, para fins de divulgação do seu trabalho. Imagens que contenham pessoas dependem do consentimento destas.</p>

  <div class="ct-sec">Cláusula 13ª – Da assinatura e validade</div>
  <p>As partes reconhecem a validade da aceitação e assinatura por meios eletrônicos ou digitais (inclusive confirmação por WhatsApp, e-mail ou assinatura eletrônica), que produzem os mesmos efeitos da assinatura física.</p>

  <div class="ct-sec">Cláusula 14ª – Do foro</div>
  <p>Fica eleito o Foro da Comarca de Recife/PE, ressalvado ao CONTRATANTE, na condição de consumidor, o direito de demandar no foro de seu domicílio, nos termos do Código de Defesa do Consumidor.</p>
  <p>E por estarem justas e contratadas, as partes assinam o presente instrumento.</p>

  <p class="ct-cidade">${assin}</p>

  <div class="ct-assinaturas">
    <div class="ct-assina">${_assinaturaImg()}<div class="ct-linha-assina"></div>CONTRATADA:<br>Bruna Padilha Ximenes</div>
    <div class="ct-assina"><div class="ct-linha-assina"></div>CONTRATANTE:</div>
    <div class="ct-assina"><div class="ct-linha-assina"></div>Testemunha 1:</div>
    <div class="ct-assina"><div class="ct-linha-assina"></div>Testemunha 2:</div>
  </div>

  <div class="ct-sec">Anexo — Descritivo <span class="ct-obs">(parte integrante do contrato)</span></div>
  <div class="ct-anexo" id="ct-anexo">
    <p class="ct-anexo-vazio">Clique em <strong>"Anexar descritivo"</strong> na barra acima para incluir o descritivo deste evento aqui.</p>
  </div>
  `;
}

/* ── CSS PARA A JANELA DE IMPRESSÃO ─────────────────────────── */
function _ctCssImprimir() {
  return ':root{--verde:#3d5a47;--rosa:#c9847a;}' +
    '*{margin:0;padding:0;box-sizing:border-box;}' +
    'body{font-family:\'Jost\',sans-serif;font-size:12px;color:#2c2c2c;background:#fff;padding:40px 48px;max-width:820px;margin:0 auto;line-height:1.6;text-align:justify;}' +
    '.ct-titulo{font-family:\'Cormorant Garamond\',serif;font-size:24px;font-weight:700;color:var(--verde);text-align:center;margin-bottom:20px;}' +
    '.ct-sec{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--verde);border-bottom:1px solid #d5cfc7;padding-bottom:3px;margin:18px 0 8px;}' +
    '.ct-sub{font-weight:600;margin:10px 0 4px;}' +
    '.ct-obs{font-weight:400;font-size:10.5px;color:#999;text-transform:none;letter-spacing:0;}' +
    'p{margin-bottom:7px;}' +
    'ul{margin:0 0 7px 20px;}li{margin-bottom:3px;}' +
    '.ct-fill{border-bottom:1px solid #999;min-width:80px;display:inline-block;padding:0 4px;}' +
    '.ct-forn-linha{display:grid;grid-template-columns:92px 1fr 92px 1fr;gap:6px 10px;margin-bottom:5px;align-items:end;}' +
    '.ct-cidade{margin-top:26px;}' +
    '.ct-assinaturas{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:36px 40px;}' +
    '.ct-assina{font-size:11.5px;}' +
    '.ct-linha-assina{border-top:1px solid #333;margin-bottom:4px;height:28px;}' +
    '.ct-assinatura-img{display:block;max-height:58px;margin:0 auto -20px;position:relative;z-index:2;}' +
    '.ct-anexo{position:relative;}' +
    '.ct-anexo-vazio{color:#aaa;font-style:italic;}' +
    '.ds-anexo-doc{position:relative;margin:4px -48px 0;padding:36px 44px;font-size:12.5px;line-height:1.65;text-align:left;}' +
    '.ds-img-wrap{position:absolute;display:inline-block;}' +
    '.ds-img-wrap .ds-img{width:100%;height:auto;display:block;border-radius:2px;}' +
    '.ds-ui,.ds-img-handle,.ds-img-handle-esq,.ds-img-del,.ds-img-front{display:none!important;}';
}
