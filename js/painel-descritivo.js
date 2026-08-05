/* ============================================================
   painel-descritivo.js — Aba "Descritivo" do painel
   ============================================================ */

let _descTimer = null;

/* ============================================================
   Histórico de desfazer/refazer (Ctrl+Z / Ctrl+Y) confiável.
   Guarda snapshots do HTML e restaura exatamente como estava —
   necessário porque as edições por JS quebram o "desfazer" nativo.
   ============================================================ */
function criarHistorico(doc, getHtml, setHtml) {
  let undo = [getHtml()];
  let redo = [];
  let timer = null;
  let restaurando = false;

  function snap() {
    if (restaurando) return;
    const atual = getHtml();
    if (atual === undo[undo.length - 1]) return;   // nada mudou
    undo.push(atual);
    if (undo.length > 60) undo.shift();
    redo = [];
  }

  // Observa qualquer mudança no documento (digitação, botões, imagens) e
  // agenda um snapshot pouco depois de a pessoa parar de mexer.
  const obs = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(snap, 500);
  });
  obs.observe(doc, { childList: true, subtree: true, characterData: true, attributes: true });

  function restaura(html) {
    restaurando = true;
    setHtml(html);
    setTimeout(() => { restaurando = false; }, 80);   // ignora as mutações da restauração
  }

  const api = {
    reset(html) { clearTimeout(timer); undo = [html != null ? html : getHtml()]; redo = []; },
    desfazer() {
      clearTimeout(timer); snap();
      if (undo.length <= 1) return;
      redo.push(undo.pop());
      restaura(undo[undo.length - 1]);
    },
    refazer() {
      if (!redo.length) return;
      const h = redo.pop(); undo.push(h); restaura(h);
    },
  };

  doc.addEventListener('keydown', (e) => {
    const z = (e.key === 'z' || e.key === 'Z');
    const y = (e.key === 'y' || e.key === 'Y');
    if ((e.ctrlKey || e.metaKey) && z && !e.shiftKey) { e.preventDefault(); api.desfazer(); }
    else if ((e.ctrlKey || e.metaKey) && (y || (z && e.shiftKey))) { e.preventDefault(); api.refazer(); }
  });

  return api;
}

function carregarDescritivo() {
  if (!eventoAtual) return;
  const CHAVE = 'desc-v1-' + eventoAtual.id;
  const doc   = document.getElementById('descritivo-doc');

  const daNuvem = eventoAtual.descritivo_html;          // salvo no banco (vale para todos os aparelhos)
  const local   = localStorage.getItem(CHAVE);          // salvo só neste aparelho

  if (daNuvem) {
    // A nuvem é a fonte da verdade — vale em qualquer aparelho
    doc.innerHTML = daNuvem;
    _guardarLocal(CHAVE, daNuvem);
  } else if (local) {
    // Ainda não está na nuvem, mas este aparelho tem uma edição local
    // (ex.: o que foi editado no tablet) → usa e migra para a nuvem
    doc.innerHTML = local;
    salvarDescritivoNuvem(local, true);
  } else {
    // Nada salvo ainda → gera o modelo. NÃO salva na nuvem até a Bruna editar,
    // para não sobrescrever uma edição feita em outro aparelho.
    doc.innerHTML = templateDescritivo(eventoAtual);
    _guardarLocal(CHAVE, doc.innerHTML);
  }

  _bindDescInput(doc, CHAVE);

  if (!doc._hist) {
    doc._hist = criarHistorico(doc, _htmlDescritivoLimpo, (h) => { doc.innerHTML = h; _salvarDescritivo(); });
  }
  doc._hist.reset(_htmlDescritivoLimpo());
}

function preencherDescritivo() {
  if (!eventoAtual) { toast('Nenhum evento aberto.', 'erro'); return; }
  if (!confirm('Substituir o descritivo atual pelos dados do formulário?')) return;
  const CHAVE = 'desc-v1-' + eventoAtual.id;
  const doc   = document.getElementById('descritivo-doc');
  doc.innerHTML = templateDescritivo(eventoAtual);
  _guardarLocal(CHAVE, doc.innerHTML);
  salvarDescritivoNuvem(doc.innerHTML);
  _bindDescInput(doc, CHAVE);
}

let _descDoc = null;
let _descChave = null;
let _imgSel = null;      // wrapper de imagem selecionado
let _arrasto = null;     // estado de arraste/redimensionamento

/* Liga o salvamento automático + colar/arrastar/redimensionar imagens */
function _bindDescInput(doc, CHAVE) {
  _descDoc = doc;
  _descChave = CHAVE;
  _imgSel = null;
  doc.oninput       = _salvarDescritivo;
  doc.onpaste       = _colarNoDescritivo;
  doc.onpointerdown = _descPointerDown;
  doc.onclick       = _descClick;
}

/* ── FORMATAR A LINHA no estilo do documento (1 clique) ─────── */
function aplicarEstiloDesc(tipo) {
  const doc = document.getElementById('descritivo-doc');
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) { toast('Clique na linha que quer formatar.', 'erro'); return; }

  // Sobe do cursor até o "bloco/linha" (filho direto do doc, de uma seção, ou um item de lista)
  let node = sel.anchorNode;
  if (node && node.nodeType === 3) node = node.parentNode;   // texto → elemento
  let blk = node;
  while (blk && blk !== doc) {
    const p = blk.parentNode;
    if (!p || p === doc) break;
    if (p.classList && (p.classList.contains('ds-secao') || p.classList.contains('ds-subsecao'))) break;
    if (blk.tagName === 'LI') break;
    blk = p;
  }
  if (!blk || blk === doc) { toast('Clique dentro de uma linha do documento.', 'erro'); return; }

  const texto = blk.textContent.trim();
  if (!texto) { toast('A linha está vazia.', 'erro'); return; }

  // Monta o novo elemento no estilo escolhido
  let novo;
  if (tipo === 'secao') {
    novo = document.createElement('div'); novo.className = 'ds-secao-titulo'; novo.textContent = texto;
  } else if (tipo === 'sub') {
    novo = document.createElement('div'); novo.className = 'ds-sub-titulo'; novo.textContent = texto;
  } else if (tipo === 'item') {
    novo = document.createElement('ul');
    const li = document.createElement('li'); li.textContent = texto; novo.appendChild(li);
  } else { // normal
    novo = document.createElement('div'); novo.textContent = texto;
  }

  // Substitui a linha antiga pela nova, tratando o caso de item de lista
  if (blk.tagName === 'LI' && tipo !== 'item') {
    const ul = blk.closest('ul');
    blk.remove();
    if (ul) { ul.after(novo); if (!ul.querySelector('li')) ul.remove(); }
    else doc.appendChild(novo);
  } else if (blk.tagName === 'LI' && tipo === 'item') {
    blk.textContent = texto;   // já é item, nada a trocar
    novo = blk;
  } else {
    blk.replaceWith(novo);
  }

  _salvarDescritivo();
  toast('Formatação aplicada ✓');
}

/* HTML do descritivo sem os controles temporários (alça e botão de excluir) */
function _htmlDescritivoLimpo() {
  const clone = _descDoc.cloneNode(true);
  clone.querySelectorAll('.ds-ui').forEach(el => el.remove());
  clone.querySelectorAll('.ds-img-sel').forEach(el => el.classList.remove('ds-img-sel'));
  return clone.innerHTML;
}

/* Guarda no aparelho, sem quebrar se estourar o limite (imagens pesam) */
function _guardarLocal(chave, html) {
  try { localStorage.setItem(chave, html); }
  catch (e) { /* limite do navegador atingido — a nuvem continua salvando */ }
}

/* Salva local (na hora) + nuvem (com pequeno atraso) */
function _salvarDescritivo() {
  if (!_descDoc) return;
  const html = _htmlDescritivoLimpo();
  _guardarLocal(_descChave, html);
  clearTimeout(_descTimer);
  _descTimer = setTimeout(() => salvarDescritivoNuvem(html), 1000);
}

/* ── COLAR IMAGEM (Ctrl+V) ─────────────────────────────────── */
function _colarNoDescritivo(e) {
  const dt = e.clipboardData;
  if (!dt) return;

  // 1) Imagem copiada como arquivo (print de tela, foto da galeria, arquivo)
  const itens = dt.items || [];
  for (let i = 0; i < itens.length; i++) {
    if (itens[i].type && itens[i].type.indexOf('image') === 0) {
      e.preventDefault();
      const file = itens[i].getAsFile();
      _redimensionarImagem(file, 1100, 0.82).then((dataUrl) => {
        _inserirImagemNoDoc(dataUrl);
        _salvarDescritivo();
      });
      return;
    }
  }

  // 2) Imagem copiada de uma página da web (vem como HTML com <img src="...">)
  const html = dt.getData ? dt.getData('text/html') : '';
  if (html && /<img[^>]+src=/i.test(html)) {
    const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m && m[1]) {
      e.preventDefault();
      _imagemDeUrl(m[1]);
      return;
    }
  }
  // caso contrário, deixa o colar normal de texto acontecer
}

/* Baixa a imagem de uma URL, comprime e insere como flutuante.
   Se o site bloquear (CORS), usa a URL direta como último recurso. */
function _imagemDeUrl(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      let w = img.width, h = img.height;
      if (w > 1100) { h = Math.round(h * 1100 / w); w = 1100; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      _inserirImagemNoDoc(c.toDataURL('image/jpeg', 0.82));
    } catch (err) {
      _inserirImagemNoDoc(url);   // CORS: mantém a URL original
    }
    _salvarDescritivo();
  };
  img.onerror = () => { _inserirImagemNoDoc(url); _salvarDescritivo(); };
  img.src = url;
}

/* Reduz a imagem (max largura) e comprime, para não pesar no banco */
function _redimensionarImagem(file, maxLarg, qualidade) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxLarg) { h = Math.round(h * maxLarg / w); w = maxLarg; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', qualidade));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* Cria a imagem flutuante (posição livre por cima do texto) */
function _inserirImagemNoDoc(dataUrl) {
  const wrap = document.createElement('span');
  wrap.className = 'ds-img-wrap';
  wrap.setAttribute('contenteditable', 'false');
  wrap.style.left  = '32px';
  wrap.style.top   = '32px';
  wrap.style.width = '260px';
  const img = document.createElement('img');
  img.className = 'ds-img';
  img.src = dataUrl;
  wrap.appendChild(img);
  _descDoc.appendChild(wrap);
  _selecionarImagem(wrap);
}

/* ── SELEÇÃO ───────────────────────────────────────────────── */
function _selecionarImagem(wrap) {
  _desselecionarImagem();
  _imgSel = wrap;
  wrap.classList.add('ds-img-sel');
  const del = document.createElement('span');
  del.className = 'ds-img-del ds-ui';
  del.textContent = '×';
  const alca = document.createElement('span');
  alca.className = 'ds-img-handle ds-ui';
  wrap.appendChild(del);
  wrap.appendChild(alca);
}

function _desselecionarImagem() {
  if (!_imgSel) return;
  _imgSel.classList.remove('ds-img-sel');
  _imgSel.querySelectorAll('.ds-ui').forEach(el => el.remove());
  _imgSel = null;
}

/* ── CLIQUE: seleciona, exclui ou desmarca ─────────────────── */
function _descClick(e) {
  if (e.target.classList && e.target.classList.contains('ds-img-del')) {
    const w = e.target.closest('.ds-img-wrap');
    if (w) { w.remove(); _imgSel = null; _salvarDescritivo(); }
    return;
  }
  const wrap = e.target.closest ? e.target.closest('.ds-img-wrap') : null;
  if (wrap) _selecionarImagem(wrap);
  else _desselecionarImagem();
}

/* ── ARRASTAR (mover) e REDIMENSIONAR (alça) — mouse e toque ─ */
function _descPointerDown(e) {
  const wrap = e.target.closest ? e.target.closest('.ds-img-wrap') : null;
  if (!wrap) return;
  if (e.target.classList.contains('ds-img-del')) return;   // deixa o clique excluir
  e.preventDefault();
  _selecionarImagem(wrap);
  const resize = e.target.classList.contains('ds-img-handle');
  _arrasto = {
    tipo: resize ? 'resize' : 'mover',
    wrap,
    x0: e.clientX, y0: e.clientY,
    left0: parseFloat(wrap.style.left) || 0,
    top0:  parseFloat(wrap.style.top)  || 0,
    w0:    parseFloat(wrap.style.width) || wrap.offsetWidth,
  };
  document.addEventListener('pointermove', _descPointerMove);
  document.addEventListener('pointerup', _descPointerUp);
}

function _descPointerMove(e) {
  if (!_arrasto) return;
  const dx = e.clientX - _arrasto.x0;
  const dy = e.clientY - _arrasto.y0;
  if (_arrasto.tipo === 'mover') {
    _arrasto.wrap.style.left = (_arrasto.left0 + dx) + 'px';
    _arrasto.wrap.style.top  = (_arrasto.top0 + dy) + 'px';
  } else {
    _arrasto.wrap.style.width = Math.max(50, _arrasto.w0 + dx) + 'px';
  }
}

function _descPointerUp() {
  if (_arrasto) { _arrasto = null; _salvarDescritivo(); }
  document.removeEventListener('pointermove', _descPointerMove);
  document.removeEventListener('pointerup', _descPointerUp);
}

/* Salva o descritivo na nuvem (banco) — assim aparece em qualquer aparelho */
async function salvarDescritivoNuvem(html, silencioso) {
  if (!eventoAtual) return;
  const { error } = await sb
    .from('events')
    .update({ descritivo_html: html })
    .eq('id', eventoAtual.id);
  if (!error) {
    eventoAtual.descritivo_html = html;
    if (!silencioso) toast('Descritivo salvo na nuvem ✓');
  } else if (!silencioso) {
    toast('Erro ao salvar o descritivo na nuvem.', 'erro');
  }
}

function imprimirDescritivo() {
  _desselecionarImagem();
  const doc  = document.getElementById('descritivo-doc');
  const nome = (eventoAtual && eventoAtual.nomes) ? eventoAtual.nomes : 'Descritivo';
  const largura  = doc.offsetWidth;                 // mesma largura da edição
  const conteudo = _htmlDescritivoLimpo();           // sem alças/botões temporários
  const cssImg =
    ' body{padding:0;}' +
    ' .ds-print-wrap{position:relative;box-sizing:border-box;margin:0 auto;padding:36px 44px;}' +
    ' .ds-img-wrap{position:absolute;display:inline-block;}' +
    ' .ds-img-wrap .ds-img{width:100%;height:auto;display:block;}' +
    ' .ds-img-handle,.ds-img-del{display:none!important;}';
  const win  = window.open('', '_blank');
  win.document.write(
    '<!DOCTYPE html><html lang="pt-BR">' +
    '<head><meta charset="UTF-8"><title>Descritivo — ' + nome + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">' +
    '<style>' + _dsCssImprimir() + cssImg + '</style></head>' +
    '<body><div class="ds-print-wrap" style="width:' + largura + 'px">' + conteudo + '</div></body></html>'
  );
  win.document.close();
  win.addEventListener('load', function () { win.focus(); win.print(); });
}

/* ── HELPERS ──────────────────────────────────────────────── */

function _tipoLabel(t) {
  var m = { casamento: 'Casamento', casamento_civil: 'Casamento Civil',
    aniversario: 'Aniversário', corporativo: 'Corporativo',
    batizado: 'Batizado', debutante: 'Debutante' };
  return m[t] || 'Evento';
}

function _fmtData(iso) {
  if (!iso) return '—';
  var d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function _li(txt) { return txt ? '<li>' + txt + '</li>' : ''; }

/* ── TEMPLATE DO DOCUMENTO ───────────────────────────────── */

function templateDescritivo(ev) {
  var eCasamento = !ev.tipo_evento || ev.tipo_evento === 'casamento' || ev.tipo_evento === 'casamento_civil';
  var temBuque   = ev.buque && ev.buque.toLowerCase().indexOf('sim') >= 0;

  /* ── CERIMÔNIA ── */
  var cerimHtml = '';
  if (eCasamento) {
    var altarItens = '';
    if (ev.altar_estrutura && !ev.altar_estrutura.toLowerCase().startsWith('não')) {
      altarItens += _li('Estrutura: ' + ev.altar_estrutura);
    } else {
      altarItens += _li('Estrutura floral — volume a definir');
    }
    altarItens += ev.altar_estilo
      ? _li('Estilo: ' + ev.altar_estilo)
      : _li('Aparador para celebrante + arranjo');

    var cortejoItens = ev.loc_cadeiras
      ? _li('Locação de cadeiras: ' + ev.loc_cadeiras)
      : _li('Passadeira — decoração a definir');
    if (ev.flores_caminho) cortejoItens += _li('Flores no caminho: ' + ev.flores_caminho);

    var welcomeItem = ev.welcome
      ? _li(ev.welcome)
      : _li('Arranjo para mesa de welcome drinks');

    var obsC = ev.obs_cerimonia ? '<p class="ds-nota">' + ev.obs_cerimonia + '</p>' : '';

    cerimHtml =
      '<div class="ds-secao">' +
        '<div class="ds-secao-titulo">Cerimônia</div>' +
        '<div class="ds-subsecao"><div class="ds-sub-titulo">Altar</div><ul>' + altarItens + '</ul></div>' +
        '<div class="ds-subsecao"><div class="ds-sub-titulo">Cortejo</div><ul>' + cortejoItens + '</ul></div>' +
        '<div class="ds-subsecao"><div class="ds-sub-titulo">Welcome drinks</div><ul>' + welcomeItem + '</ul></div>' +
        obsC +
      '</div>';
  }

  /* ── RECEPÇÃO ── */
  var mesasItens = '';
  if (ev.loc_mesas) mesasItens += _li('Locação de mesas: ' + ev.loc_mesas);
  else              mesasItens += _li('Locação de mesas — quantidade a confirmar');
  if (ev.mesa_posta)   mesasItens += _li('Mesa posta: ' + ev.mesa_posta);
  if (ev.arranjo_conv) mesasItens += _li('Arranjo dos convidados: ' + ev.arranjo_conv);
  else                 mesasItens += _li('Arranjos para as mesas — modelo a definir');

  var mesaFam = ev.mesa_familia
    ? '<div class="ds-subsecao"><div class="ds-sub-titulo">Mesa da família / casal</div><ul>' +
        _li(ev.arranjo_familia || 'Arranjo especial — a definir') + '</ul></div>'
    : '';

  var boloItens = ev.bolo_tam
    ? _li('Tamanho do bolo: ' + ev.bolo_tam)
    : _li('Composição decorativa — tamanho a confirmar');
  if (ev.qtd_doces) boloItens += _li('Docinhos: ' + ev.qtd_doces);
  if (ev.lembranca) boloItens += _li('Lembranças: ' + ev.lembranca);
  var obsD = ev.obs_doces ? '<p class="ds-nota">' + ev.obs_doces + '</p>' : '';

  var buffetItens = '';
  if (ev.buffet_tipo)  buffetItens += _li(ev.buffet_tipo);
  if (ev.buffet_mesas) buffetItens += _li('Mesas: ' + ev.buffet_mesas);
  if (ev.bar)          buffetItens += _li('Bar: ' + ev.bar);
  if (!buffetItens)    buffetItens = _li('Composição para mesas do buffet');
  var obsB = ev.obs_buffet ? '<p class="ds-nota">' + ev.obs_buffet + '</p>' : '';

  var loungeHtml = (ev.lounge && !ev.lounge.toLowerCase().startsWith('não'))
    ? '<div class="ds-subsecao"><div class="ds-sub-titulo">Lounge</div><ul>' + _li(ev.lounge) + '</ul></div>'
    : '';

  var recepHtml =
    '<div class="ds-secao">' +
      '<div class="ds-secao-titulo">Recepção</div>' +
      '<div class="ds-subsecao"><div class="ds-sub-titulo">Mesas dos convidados</div><ul>' + mesasItens + '</ul></div>' +
      mesaFam +
      '<div class="ds-subsecao"><div class="ds-sub-titulo">Mesa de bolo e doces</div><ul>' + boloItens + '</ul>' + obsD + '</div>' +
      '<div class="ds-subsecao"><div class="ds-sub-titulo">Buffet</div><ul>' + buffetItens + '</ul>' + obsB + '</div>' +
      loungeHtml +
    '</div>';

  /* ── BUQUÊ ── */
  var buqueHtml = temBuque
    ? '<div class="ds-secao"><div class="ds-secao-titulo">Buquê da noiva</div><ul>' +
        _li(ev.buque.indexOf('escolhido') >= 0 ? 'Modelo escolhido — a confirmar' : 'Modelo a definir') +
      '</ul></div>'
    : '';

  /* ── CENÁRIO ── */
  var cenarioHtml = ev.cenario
    ? '<div class="ds-secao"><div class="ds-secao-titulo">Cenário / fotos</div><ul>' + _li(ev.cenario) + '</ul></div>'
    : '';

  /* ── OPERACIONAL ── */
  var opHtml =
    '<div class="ds-secao">' +
      '<div class="ds-secao-titulo">Operacional</div>' +
      '<ul>' +
        '<li>Taxa de serviço / elaboração</li>' +
        '<li>Equipe de floristas</li>' +
        '<li>Equipe de montagem e desmontagem</li>' +
        '<li>Alimentação e deslocamento da equipe</li>' +
        '<li>Frete de flores, peças e estruturas</li>' +
      '</ul>' +
    '</div>';

  /* ── MONTAGEM FINAL ── */
  return '' +
    '<div class="ds-cabecalho">' +
      '<div>' +
        '<h2 class="ds-nomes">' + (ev.nomes || 'Nome do casal') + '</h2>' +
        '<div class="ds-tipo-data">' + _tipoLabel(ev.tipo_evento) + ' · ' + _fmtData(ev.data_evento) + '</div>' +
      '</div>' +
      '<div class="ds-contato">' +
        '<div class="ds-logo">Bruna Ximenes</div>' +
        '<div>Decoração floral para eventos</div>' +
        '<div>bruna.p.ximenes@gmail.com</div>' +
        '<div>(81) 99272-6432</div>' +
      '</div>' +
    '</div>' +

    '<div class="ds-ficha">' +
      '<div class="ds-ficha-grid">' +
        '<div><strong>Local:</strong> ' + (ev.local_evento || '—') + '</div>' +
        '<div><strong>Horário:</strong> ' + (ev.horario || '—') + '</div>' +
        '<div><strong>Estilo:</strong> ' + (ev.estilo || '—') + '</div>' +
        '<div><strong>Cerimonial:</strong> ' + (ev.cerimonial || '—') + '</div>' +
        '<div><strong>Paleta:</strong> ' + (ev.paleta || '—') + '</div>' +
        '<div><strong>Convidados:</strong> ' + (ev.num_convidados ? ev.num_convidados + ' pessoas' : '—') + '</div>' +
      '</div>' +
    '</div>' +

    '<div class="ds-titulo-orc">Orçamento</div>' +

    cerimHtml +
    recepHtml +
    buqueHtml +
    cenarioHtml +
    opHtml +

    '<div class="ds-bloco-total">' +
      '<div class="ds-total-linha">' +
        '<span class="ds-total-label">Total geral</span>' +
        '<span class="ds-total-valor">' +
          '<span class="ds-rs">R$</span>' +
          '<span class="ds-editavel ds-ev-total" contenteditable="true" data-placeholder="__________"></span>' +
        '</span>' +
      '</div>' +
      '<div class="ds-grid-desc">' +
        '<div class="ds-desc-col">' +
          '<h4>Descritivo</h4>' +
          '<div class="ds-item"><span>Decoração floral</span><span class="ds-editavel ds-ev-val" contenteditable="true" data-placeholder="R$ ______"></span></div>' +
          '<div class="ds-item"><span>Locação de peças e estruturas</span><span class="ds-editavel ds-ev-val" contenteditable="true" data-placeholder="R$ ______"></span></div>' +
          '<div class="ds-item"><span>Locação de mobiliário</span><span class="ds-editavel ds-ev-val" contenteditable="true" data-placeholder="R$ ______"></span></div>' +
          '<div class="ds-item"><span>Operacional</span><span class="ds-editavel ds-ev-val" contenteditable="true" data-placeholder="R$ ______"></span></div>' +
        '</div>' +
        '<div class="ds-pgto-col">' +
          '<h4>Forma de pagamento</h4>' +
          '<p>Pix<br><strong>30%</strong> no fechamento<br><strong>70%</strong> até 10 dias antes do evento</p>' +
          '<br>' +
          '<h4>Chave Pix</h4>' +
          '<p>CNPJ: 23.667.854/0001-21</p>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="ds-condicoes">' +
      '<div>' +
        '<h4>Montagem e desmontagem</h4>' +
        '<p>A montagem é feita dentro do horário permitido pela casa e entregamos até 1h antes do início. A desmontagem ocorre logo após o término, em horário acordado com a cliente.</p>' +
      '</div>' +
      '<div>' +
        '<h4>Observações</h4>' +
        '<p>Orçamento baseado nas informações do questionário. Sujeito a ajustes após visita ao local e alinhamento final.</p>' +
      '</div>' +
    '</div>' +

    '<div class="ds-validade">' +
      'Orçamento válido por 15 dias · Bruna Ximenes · bruna.p.ximenes@gmail.com' +
    '</div>';
}

/* ── CSS PARA A JANELA DE IMPRESSÃO ─────────────────────── */

function _dsCssImprimir() {
  return ':root{--verde:#3d5a47;--rosa:#c9847a;--creme:#faf7f2;}' +
    '*{margin:0;padding:0;box-sizing:border-box;}' +
    'body{font-family:\'Jost\',sans-serif;font-size:12.5px;color:#2c2c2c;background:#fff;padding:40px 48px;max-width:960px;margin:0 auto;line-height:1.65;}' +
    '.ds-cabecalho{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--verde);padding-bottom:16px;margin-bottom:20px;}' +
    '.ds-nomes{font-family:\'Cormorant Garamond\',serif;font-size:26px;font-weight:600;color:var(--verde);letter-spacing:.03em;}' +
    '.ds-tipo-data{font-size:11.5px;color:#888;margin-top:3px;font-style:italic;}' +
    '.ds-contato{text-align:right;font-size:11px;color:#888;line-height:1.8;}' +
    '.ds-logo{font-family:\'Cormorant Garamond\',serif;font-size:15px;font-weight:600;color:var(--rosa);letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px;}' +
    '.ds-ficha{background:var(--creme);border-left:3px solid var(--rosa);padding:10px 14px;margin-bottom:20px;font-size:12px;}' +
    '.ds-ficha-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px 20px;}' +
    '.ds-ficha strong{color:var(--verde);font-weight:500;}' +
    '.ds-titulo-orc{font-family:\'Cormorant Garamond\',serif;font-size:17px;font-weight:700;color:#2c2c2c;text-transform:uppercase;letter-spacing:.14em;margin-bottom:18px;}' +
    '.ds-secao{margin-bottom:18px;}' +
    '.ds-secao-titulo{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.18em;color:var(--verde);border-bottom:1px solid #d5cfc7;padding-bottom:4px;margin-bottom:10px;}' +
    '.ds-subsecao{margin-bottom:10px;}' +
    '.ds-sub-titulo{font-weight:500;margin-bottom:3px;font-size:12.5px;}' +
    'ul{list-style:none;padding-left:0;}' +
    'ul li{padding-left:14px;position:relative;margin-bottom:1px;font-size:12px;}' +
    'ul li::before{content:"\\2013";position:absolute;left:0;color:var(--rosa);}' +
    '.ds-nota{font-style:italic;color:#888;font-size:11.5px;margin-top:4px;padding-left:14px;}' +
    '.ds-bloco-total{margin-top:20px;border-top:2px solid var(--verde);padding-top:12px;}' +
    '.ds-total-linha{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}' +
    '.ds-total-label{font-family:\'Cormorant Garamond\',serif;font-size:17px;font-weight:700;color:var(--verde);text-transform:uppercase;letter-spacing:.06em;}' +
    '.ds-total-valor{display:flex;align-items:center;gap:6px;}' +
    '.ds-rs{font-family:\'Cormorant Garamond\',serif;font-size:20px;font-weight:700;color:var(--verde);}' +
    '.ds-ev-total{border-bottom:2px dashed var(--verde);min-width:140px;display:inline-block;font-family:\'Cormorant Garamond\',serif;font-size:20px;font-weight:700;color:var(--verde);text-align:right;}' +
    '.ds-ev-total:empty::before{content:attr(data-placeholder);color:#bbb;}' +
    '.ds-grid-desc{display:grid;grid-template-columns:1fr 240px;gap:16px 24px;margin-bottom:16px;}' +
    '.ds-desc-col{display:grid;grid-template-columns:max-content 1fr;column-gap:12px;align-content:start;}' +
    '.ds-desc-col h4{grid-column:1/-1;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.15em;color:#888;margin-bottom:6px;}' +
    '.ds-item{display:contents;}' +
    '.ds-item>span{padding:3px 0;border-bottom:1px dotted #e0dbd4;font-size:12px;}' +
    '.ds-ev-val{padding:3px 0;border-bottom:1px dashed #bbb;font-family:\'Jost\',sans-serif;font-size:12px;color:var(--verde);font-weight:500;min-width:80px;display:inline-block;}' +
    '.ds-ev-val:empty::before{content:attr(data-placeholder);color:#bbb;}' +
    '.ds-pgto-col h4{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.15em;color:#888;margin-bottom:6px;}' +
    '.ds-pgto-col p{font-size:12px;line-height:2;}' +
    '.ds-condicoes{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px;padding-top:10px;border-top:1px solid #e0dbd4;font-size:11.5px;}' +
    '.ds-condicoes h4{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:6px;}' +
    '.ds-condicoes p{color:#666;line-height:1.6;}' +
    '.ds-validade{text-align:center;font-size:10.5px;color:#aaa;margin-top:24px;padding-top:10px;border-top:1px solid #eee;}' +
    '@media print{.ds-ev-total:empty::before,.ds-ev-val:empty::before{display:none;}.ds-ev-total,.ds-ev-val{border-bottom:none;}}';
}
