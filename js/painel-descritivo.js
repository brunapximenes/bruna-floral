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
  _initNudge();
  _carregarNotasDesc();

  if (!doc._hist) {
    doc._hist = criarHistorico(doc, _htmlDescritivoLimpo, (h) => { doc.innerHTML = h; _salvarDescritivo(); });
  }
  doc._hist.reset(_htmlDescritivoLimpo());
}

/* Ajuste fino da posição das imagens com as setas do teclado
   (1px por seta, 10px com Shift). Move todas as selecionadas. */
function _initNudge() {
  if (document._descNudgeOn) return;
  document._descNudgeOn = true;
  document.addEventListener('keydown', (e) => {
    if (!_imgSel || !_imgSel.length) return;
    const pag = document.getElementById('pag-descritivo');
    if (!pag || !pag.classList.contains('active')) return;
    const ae = document.activeElement;
    const tag = (ae && ae.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (ae && ae.id === 'desc-notas-txt') return;   // digitando nas anotações
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -1;
    else if (e.key === 'ArrowRight') dx = 1;
    else if (e.key === 'ArrowUp') dy = -1;
    else if (e.key === 'ArrowDown') dy = 1;
    else return;
    e.preventDefault();
    const passo = e.shiftKey ? 10 : 1;
    _imgSel.forEach(w => {
      w.style.left = ((parseFloat(w.style.left) || 0) + dx * passo) + 'px';
      w.style.top  = ((parseFloat(w.style.top) || 0) + dy * passo) + 'px';
    });
    _salvarDescritivo();
  });
}

/* ── BLOCO DE ANOTAÇÕES PARTICULARES (ao lado do descritivo) ──────
   Campo rico (contenteditable): aceita negrito, cor, grifo etc.
   Salvo em events.descritivo_notas — NÃO entra no descritivo do cliente.
   Calcula estilo OneNote: "2+2=" + espaço → insere o resultado. ── */
let _notasDescTimer = null;

function _carregarNotasDesc() {
  const el = document.getElementById('desc-notas-txt');
  if (!el || !eventoAtual) return;
  const val = eventoAtual.descritivo_notas || '';
  el.innerHTML = _pareceHtml(val) ? val : _textoParaHtml(val);
  _padNotasCE(el);
  if (el._notasOn) return;
  el._notasOn = true;
  el.addEventListener('input', () => {
    _padNotasCE(el);
    clearTimeout(_notasDescTimer);
    _notasDescTimer = setTimeout(_salvarNotasDesc, 800);
  });
  el.addEventListener('keydown', _notasCalcKeydownCE);
  // clicar em qualquer linha (mesmo em branco) precisa das linhas já existirem:
  // preenche a altura ANTES de o clique posicionar o cursor
  el.addEventListener('pointerdown', () => _padNotasCE(el));
  if (window.ResizeObserver) new ResizeObserver(() => _padNotasCE(el)).observe(el);
}

const _pareceHtml = (v) => /<[a-z][\s\S]*>/i.test(v);
const _escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const _textoParaHtml = (v) =>
  (v || '').split('\n').map(l => '<div>' + (l ? _escHtml(l) : '<br>') + '</div>').join('') || '<div><br></div>';
const _linhaVazia = () => { const d = document.createElement('div'); d.appendChild(document.createElement('br')); return d; };

/* Preenche o fim do bloco com linhas em branco até encher a altura visível,
   para dar pra clicar e escrever em qualquer linha ao lado do descritivo. */
function _padNotasCE(el) {
  let guarda = 0;
  while (el.scrollHeight < el.clientHeight && guarda++ < 400) {
    el.appendChild(_linhaVazia());
  }
}

/* HTML sem as linhas em branco do FIM (as do meio, antes de um texto, ficam) */
function _notasHtmlLimpo(el) {
  const c = el.cloneNode(true);
  let last;
  while ((last = c.lastChild)) {
    const vazio = ((last.textContent || '').replace(/ /g, '').trim() === '');
    if (vazio) c.removeChild(last); else break;
  }
  return c.innerHTML;
}

async function _salvarNotasDesc() {
  const el = document.getElementById('desc-notas-txt');
  if (!el || !eventoAtual) return;
  const limpo = _notasHtmlLimpo(el);
  eventoAtual.descritivo_notas = limpo;
  await sb.from('events').update({ descritivo_notas: limpo }).eq('id', eventoAtual.id);
}

/* Texto da linha atual até o cursor (não cruza para outras linhas) */
function _textoLinhaAteCursor(range, root) {
  let bloco = range.startContainer;
  if (bloco.nodeType === 3) bloco = bloco.parentElement;
  while (bloco && bloco !== root && getComputedStyle(bloco).display !== 'block') bloco = bloco.parentElement;
  if (!bloco || bloco === root) {
    return (range.startContainer.textContent || '').slice(0, range.startOffset);
  }
  const rr = document.createRange();
  rr.selectNodeContents(bloco);
  rr.setEnd(range.startContainer, range.startOffset);
  return rr.toString();
}

/* Ao dar Espaço (ou Enter) logo depois de um "=", calcula a conta daquela linha */
function _notasCalcKeydownCE(e) {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const antes = _textoLinhaAteCursor(range, e.currentTarget);
  if (antes.slice(-1) !== '=') return;                  // só age logo após o "="

  // pega a expressão SÓ na linha atual (não cruza linhas → não junta números de cima)
  const m = antes.slice(0, -1).match(/[-+*/×÷^().,%\d \t]*$/);
  if (!m) return;
  const expr = m[0].trim();
  if (!expr || !/\d/.test(expr)) return;

  const conv = expr
    .replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/\^/g, '**').replace(/%/g, '/100');
  if (!/^[\d+\-*/.()\s]+$/.test(conv)) return;          // segurança: só matemática

  let r;
  try { r = Function('"use strict";return (' + conv + ')')(); } catch (_) { return; }
  if (typeof r !== 'number' || !isFinite(r)) return;
  r = Math.round((r + Number.EPSILON) * 1e6) / 1e6;
  const out = r.toLocaleString('pt-BR', { maximumFractionDigits: 6 });

  e.preventDefault();
  document.execCommand('insertText', false, out + (e.key === ' ' ? ' ' : ''));
  if (e.key === 'Enter') document.execCommand('insertParagraph');
  clearTimeout(_notasDescTimer);
  _notasDescTimer = setTimeout(_salvarNotasDesc, 600);
}

/* ── FORMATAÇÃO DE TEXTO (vale para o descritivo E para as anotações) ──
   Age sobre o campo editável que está com a seleção/foco. ── */
function _editavelAtivo() {
  const a = document.activeElement;
  if (a && (a.id === 'descritivo-doc' || a.id === 'desc-notas-txt')) return a;
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    let n = sel.anchorNode;
    if (n && n.nodeType === 3) n = n.parentElement;
    const doc = n && n.closest ? n.closest('#descritivo-doc,#desc-notas-txt') : null;
    if (doc) return doc;
  }
  return document.getElementById('descritivo-doc');
}
function _salvarEditavel(el) {
  if (el && el.id === 'desc-notas-txt') { _padNotasCE(el); _salvarNotasDesc(); }
  else if (typeof _salvarDescritivo === 'function') _salvarDescritivo();
}
function fmtDesc(cmd, val) {
  const alvo = _editavelAtivo();
  try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
  document.execCommand(cmd, false, val || null);
  _salvarEditavel(alvo);
}
function grifarDesc(cor) {
  const alvo = _editavelAtivo();
  try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
  if (!document.execCommand('hiliteColor', false, cor)) document.execCommand('backColor', false, cor);
  _salvarEditavel(alvo);
}
function limparFormatoDesc() {
  const alvo = _editavelAtivo();
  try { document.execCommand('styleWithCSS', false, true); } catch (e) {}
  document.execCommand('removeFormat', false, null);
  document.execCommand('hiliteColor', false, 'transparent');
  _salvarEditavel(alvo);
}

/* Guarda a última seleção feita dentro do descritivo/anotações, porque abrir o
   seletor de tamanho tira o foco do campo e apagaria a seleção. */
let _selRange = null, _selDoc = null;
document.addEventListener('selectionchange', () => {
  const s = window.getSelection();
  if (!s || !s.rangeCount) return;
  let n = s.anchorNode;
  if (n && n.nodeType === 3) n = n.parentElement;
  const doc = n && n.closest ? n.closest('#descritivo-doc,#desc-notas-txt') : null;
  if (doc) { _selRange = s.getRangeAt(0).cloneRange(); _selDoc = doc; }
});

/* Aplica um tamanho de fonte EXATO em px ao texto selecionado.
   Usa o truque font size=7 → span com o px desejado (px de verdade, não a escala 1–7). */
function fmtTamanhoPx(px) {
  if (!px) return;
  const alvo = _selDoc || _editavelAtivo();
  if (!alvo) return;
  alvo.focus();
  if (_selRange) {
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(_selRange);
  }
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) { toast('Selecione o texto primeiro.', 'erro'); return; }
  document.execCommand('styleWithCSS', false, false);
  document.execCommand('fontSize', false, '7');
  alvo.querySelectorAll('font[size="7"]').forEach(f => {
    const span = document.createElement('span');
    span.style.fontSize = px;
    while (f.firstChild) span.appendChild(f.firstChild);
    f.replaceWith(span);
  });
  _salvarEditavel(alvo);
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
let _imgSel = [];        // imagens selecionadas (permite várias)
let _arrasto = null;     // estado de arraste/redimensionamento
let _multiSel = false;   // modo "selecionar várias" (útil no toque)
let _guias = [];         // linhas-guia de alinhamento (estilo Canva)
const _SNAP = 6;         // tolerância em px para alinhar posição
const _SNAPH = 24;       // tolerância em px para igualar a ALTURA da foto vizinha

/* Liga o salvamento automático + colar/arrastar/redimensionar imagens */
function _bindDescInput(doc, CHAVE) {
  _descDoc = doc;
  _descChave = CHAVE;
  _imgSel = [];
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

  // 1) Imagem copiada como arquivo (print, foto, arquivo) → envia pro armazenamento
  const itens = dt.items || [];
  for (let i = 0; i < itens.length; i++) {
    if (itens[i].type && itens[i].type.indexOf('image') === 0) {
      e.preventDefault();
      const file = itens[i].getAsFile();
      _redimensionarBlob(file, 900, 0.72).then(async (blob) => {
        try {
          const url = await _uploadImagem(blob);
          _inserirImagemNoDoc(url);
          _salvarDescritivo();
        } catch (err) {
          console.error('upload imagem', err);
          toast('Não foi possível enviar a imagem. Tente novamente.', 'erro');
        }
      });
      return;
    }
  }

  // 2) Imagem copiada de uma página da web (HTML com <img src="...">)
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

/* Imagem vinda de URL. data: → envia pro armazenamento; http → usa o link direto (leve). */
function _imagemDeUrl(url) {
  if (url.indexOf('data:') === 0) {
    fetch(url).then(r => r.blob()).then(async (blob) => {
      try { const u = await _uploadImagem(blob); _inserirImagemNoDoc(u); }
      catch (e) { _inserirImagemNoDoc(url); }
      _salvarDescritivo();
    }).catch(() => { _inserirImagemNoDoc(url); _salvarDescritivo(); });
  } else {
    _inserirImagemNoDoc(url);
    _salvarDescritivo();
  }
}

/* Redimensiona o arquivo e devolve um Blob JPEG (para enviar ao armazenamento) */
function _redimensionarBlob(file, maxLarg, qualidade) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxLarg) { h = Math.round(h * maxLarg / w); w = maxLarg; }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob((b) => resolve(b), 'image/jpeg', qualidade);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* Envia o blob para o armazenamento (bucket "descritivos") e devolve a URL pública */
async function _uploadImagem(blob) {
  const nome = (eventoAtual ? eventoAtual.id : 'geral') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
  const { error } = await sb.storage.from('descritivos').upload(nome, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return sb.storage.from('descritivos').getPublicUrl(nome).data.publicUrl;
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

/* ── COMPACTAR todas as imagens do descritivo (1 clique) ───── */
async function compactarImagensDescritivo() {
  if (!_descDoc) return;
  const imgs = Array.from(_descDoc.querySelectorAll('img.ds-img'));
  if (!imgs.length) { toast('Não há imagens para compactar.'); return; }
  toast('Compactando ' + imgs.length + ' imagem(ns)...');
  for (const img of imgs) {
    try { img.src = await _recompactarSrc(img.src, 640, 0.5); } catch (e) { /* ignora a que falhar */ }
  }
  _salvarDescritivo();
  toast('Imagens compactadas ✓');
}

function _recompactarSrc(src, maxLarg, qualidade) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      try {
        let w = im.width, h = im.height;
        if (w > maxLarg) { h = Math.round(h * maxLarg / w); w = maxLarg; }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(im, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', qualidade));
      } catch (e) { reject(e); }
    };
    im.onerror = reject;
    im.src = src;
  });
}

/* ── SELEÇÃO (uma ou várias) ───────────────────────────────── */
function _desselecionarImagem() {
  _imgSel.forEach(w => {
    w.classList.remove('ds-img-sel');
    w.querySelectorAll('.ds-ui').forEach(el => el.remove());
  });
  _imgSel = [];
}

/* Controles (×, trazer pra frente, alças de redimensionar dos 2 lados)
   só quando há exatamente 1 imagem selecionada */
function _atualizarHandles() {
  _imgSel.forEach(w => w.querySelectorAll('.ds-ui').forEach(el => el.remove()));
  if (_imgSel.length === 1) {
    const w = _imgSel[0];
    const mk = (cls, txt, tit) => {
      const s = document.createElement('span');
      s.className = cls + ' ds-ui';
      if (txt) s.textContent = txt;
      if (tit) s.title = tit;
      w.appendChild(s);
    };
    mk('ds-img-del', '×', 'Remover');
    mk('ds-img-front', '⬆', 'Trazer para frente');
    mk('ds-img-handle', '', 'Redimensionar');          // canto direito
    mk('ds-img-handle-esq', '', 'Redimensionar');       // canto esquerdo
  } else if (_imgSel.length > 1) {
    // várias selecionadas: alças dos dois lados em cada uma, para redimensionar todas juntas
    _imgSel.forEach(w => {
      const alcaD = document.createElement('span');
      alcaD.className = 'ds-img-handle ds-ui';
      alcaD.title = 'Redimensionar todas juntas';
      const alcaE = document.createElement('span');
      alcaE.className = 'ds-img-handle-esq ds-ui';
      alcaE.title = 'Redimensionar todas juntas';
      w.appendChild(alcaD);
      w.appendChild(alcaE);
    });
  }
}

function _selecionarImagem(wrap, adicionar) {
  if (adicionar) {
    const i = _imgSel.indexOf(wrap);
    if (i >= 0) { _imgSel.splice(i, 1); wrap.classList.remove('ds-img-sel'); }
    else { _imgSel.push(wrap); wrap.classList.add('ds-img-sel'); }
  } else {
    _desselecionarImagem();
    _imgSel = [wrap];
    wrap.classList.add('ds-img-sel');
  }
  _atualizarHandles();
}

/* Botão "Selecionar várias" (bom para toque) */
function toggleMultiSel(btn) {
  _multiSel = !_multiSel;
  if (btn) btn.classList.toggle('ativo', _multiSel);
  toast(_multiSel ? 'Modo várias: toque nas imagens para somar à seleção.' : 'Modo várias desligado.');
}

/* ── CLIQUE: excluir (×), trazer pra frente (⬆) ou desmarcar ─ */
function _descClick(e) {
  const cls = e.target.classList;
  if (cls && cls.contains('ds-img-del')) {
    const w = e.target.closest('.ds-img-wrap');
    if (w) { const i = _imgSel.indexOf(w); if (i >= 0) _imgSel.splice(i, 1); w.remove(); _salvarDescritivo(); }
    return;
  }
  if (cls && cls.contains('ds-img-front')) {
    const w = e.target.closest('.ds-img-wrap');
    if (w) { _trazerPraFrente(w); _salvarDescritivo(); toast('Imagem trazida para frente ✓'); }
    return;
  }
  const wrap = e.target.closest ? e.target.closest('.ds-img-wrap') : null;
  if (!wrap) _desselecionarImagem();
}

/* Coloca a imagem na frente das outras (maior z-index) */
function _trazerPraFrente(wrap) {
  let max = 5;
  _descDoc.querySelectorAll('.ds-img-wrap').forEach(w => {
    if (w === wrap) return;
    const z = parseInt(w.style.zIndex) || 5;
    if (z > max) max = z;
  });
  wrap.style.zIndex = max + 1;
}

/* ── ARRASTAR (grupo) e REDIMENSIONAR — mouse e toque ──────── */
function _descPointerDown(e) {
  const wrap = e.target.closest ? e.target.closest('.ds-img-wrap') : null;
  if (!wrap) return;
  const cls = e.target.classList;
  if (cls.contains('ds-img-del') || cls.contains('ds-img-front')) return;   // esses são clique
  e.preventDefault();
  const resizeDir = cls.contains('ds-img-handle');
  const resizeEsq = cls.contains('ds-img-handle-esq');
  const adicionar = e.ctrlKey || e.metaKey || e.shiftKey || _multiSel;

  if (adicionar && !resizeDir && !resizeEsq) {   // só alterna a seleção, sem arrastar
    _selecionarImagem(wrap, true);
    return;
  }
  if (resizeDir || resizeEsq) {
    const emGrupo = _imgSel.length > 1 && _imgSel.indexOf(wrap) >= 0;
    if (!emGrupo) _selecionarImagem(wrap, false);
    _arrasto = {
      tipo: 'resize', lado: resizeEsq ? 'esq' : 'dir', wrap,
      x0: e.clientX, y0: e.clientY,
      left0: parseFloat(wrap.style.left) || 0,
      w0: wrap.offsetWidth,                     // largura REAL em px (corrige o bug de %)
      h0: wrap.offsetHeight,                    // altura REAL, para trabalhar por altura
      grupo: emGrupo ? _imgSel.map(w => ({ w, aspect: w.offsetWidth / (w.offsetHeight || 1) })) : null,
    };
  } else {
    if (_imgSel.indexOf(wrap) < 0) _selecionarImagem(wrap, false);   // clicou numa não-selecionada
    const itens = _imgSel.map(w => ({ w, left0: parseFloat(w.style.left) || 0, top0: parseFloat(w.style.top) || 0 }));
    _arrasto = { tipo: 'mover', primary: wrap, x0: e.clientX, y0: e.clientY, itens };
  }
  document.addEventListener('pointermove', _descPointerMove);
  document.addEventListener('pointerup', _descPointerUp);
}

function _descPointerMove(e) {
  if (!_arrasto) return;
  const dx = e.clientX - _arrasto.x0;
  const dy = e.clientY - _arrasto.y0;
  _limparGuias();

  if (_arrasto.tipo === 'mover') {
    const prim = _arrasto.itens.find(it => it.w === _arrasto.primary) || _arrasto.itens[0];
    const propLeft = prim.left0 + dx, propTop = prim.top0 + dy;
    const s = _snapMover(_arrasto.primary, propLeft, propTop);
    const ajDx = s.left - prim.left0, ajDy = s.top - prim.top0;
    _arrasto.itens.forEach(it => {
      it.w.style.left = (it.left0 + ajDx) + 'px';
      it.w.style.top  = (it.top0 + ajDy) + 'px';
    });
    if (s.guiaX != null) _guiaV(s.guiaX);
    if (s.guiaY != null) _guiaH(s.guiaY);
  } else {
    const esq = _arrasto.lado === 'esq';
    const aspect = _arrasto.w0 / (_arrasto.h0 || 1);       // largura ÷ altura (constante)
    let propW = Math.max(40, esq ? (_arrasto.w0 - dx) : (_arrasto.w0 + dx));
    let propH = propW / aspect;                            // altura correspondente

    // imã: igualar a ALTURA de uma foto vizinha
    const excluir = _arrasto.grupo ? _arrasto.grupo.map(g => g.w) : [_arrasto.wrap];
    let mH = null;
    _outrasImgs(excluir).forEach(o => {
      const d = o.alt - propH;
      if (Math.abs(d) <= _SNAPH && (!mH || Math.abs(d) < Math.abs(mH.d))) mH = { d, h: o.alt, el: o.el };
    });
    if (mH) { propH = mH.h; propW = propH * aspect; mH.el.classList.add('ds-img-ref'); }

    if (_arrasto.grupo) {
      // várias → todas ficam com a MESMA ALTURA (cada uma acha sua largura pelo próprio aspecto)
      _arrasto.grupo.forEach(g => {
        g.w.style.width = (propH * g.aspect) + 'px';
        if (mH) g.w.classList.add('ds-img-ref');
      });
      _labelResize(_arrasto.wrap, propH, !!mH);
    } else {
      const wrap = _arrasto.wrap;
      if (esq) wrap.style.left = (_arrasto.left0 + _arrasto.w0 - propW) + 'px';   // fixa a borda direita
      wrap.style.width = propW + 'px';
      if (mH) wrap.classList.add('ds-img-ref');
      _labelResize(wrap, propH, !!mH);
    }
  }
}

function _descPointerUp() {
  _limparGuias();
  if (_arrasto) { _arrasto = null; _salvarDescritivo(); }
  document.removeEventListener('pointermove', _descPointerMove);
  document.removeEventListener('pointerup', _descPointerUp);
}

/* ── LINHAS-GUIA / SNAP (alinhar com as imagens vizinhas) ──── */
function _outrasImgs(excluir) {
  const arr = [];
  _descDoc.querySelectorAll('.ds-img-wrap').forEach(w => {
    if (excluir && excluir.indexOf(w) >= 0) return;
    const left = parseFloat(w.style.left) || 0, top = parseFloat(w.style.top) || 0;
    const ww = w.offsetWidth, hh = w.offsetHeight;
    arr.push({ el: w, larg: ww, alt: hh, left, top, right: left + ww, cx: left + ww / 2, bottom: top + hh, cy: top + hh / 2 });
  });
  return arr;
}
function _linhasV(exclWrap) {
  const v = [];
  _outrasImgs([exclWrap]).forEach(o => { v.push(o.left, o.cx, o.right); });
  return v;
}
function _snapMover(prim, propLeft, propTop) {
  const w = prim.offsetWidth, h = prim.offsetHeight;
  const outras = _outrasImgs(_arrasto.itens.map(it => it.w));
  const alvoV = [propLeft, propLeft + w / 2, propLeft + w];
  const alvoH = [propTop, propTop + h / 2, propTop + h];
  let mV = null, mH = null;
  outras.forEach(o => {
    [o.left, o.cx, o.right].forEach(lv => alvoV.forEach(av => {
      const d = lv - av;
      if (Math.abs(d) <= _SNAP && (!mV || Math.abs(d) < Math.abs(mV.d))) mV = { d, linha: lv };
    }));
    [o.top, o.cy, o.bottom].forEach(lh => alvoH.forEach(ah => {
      const d = lh - ah;
      if (Math.abs(d) <= _SNAP && (!mH || Math.abs(d) < Math.abs(mH.d))) mH = { d, linha: lh };
    }));
  });
  return {
    left: mV ? propLeft + mV.d : propLeft,
    top:  mH ? propTop + mH.d : propTop,
    guiaX: mV ? mV.linha : null,
    guiaY: mH ? mH.linha : null,
  };
}
function _limparGuias() {
  _guias.forEach(g => g.remove()); _guias = [];
  if (_descDoc) _descDoc.querySelectorAll('.ds-img-ref').forEach(el => el.classList.remove('ds-img-ref'));
}
function _guiaV(x) {
  const g = document.createElement('div');
  g.className = 'ds-guia ds-ui';
  g.style.cssText = 'position:absolute;left:' + x + 'px;top:0;height:' + _descDoc.scrollHeight + 'px;border-left:1px dashed #c9847a;z-index:20;pointer-events:none;';
  _descDoc.appendChild(g); _guias.push(g);
}
function _guiaH(y) {
  const g = document.createElement('div');
  g.className = 'ds-guia ds-ui';
  g.style.cssText = 'position:absolute;top:' + y + 'px;left:0;width:' + _descDoc.scrollWidth + 'px;border-top:1px dashed #c9847a;z-index:20;pointer-events:none;';
  _descDoc.appendChild(g); _guias.push(g);
}

/* Rótulo com a altura enquanto redimensiona (ajuda a igualar a foto vizinha) */
function _labelResize(wrap, altura, casou) {
  const g = document.createElement('div');
  g.className = 'ds-guia ds-ui';
  const left = parseFloat(wrap.style.left) || 0;
  const top = parseFloat(wrap.style.top) || 0;
  g.style.cssText = 'position:absolute;left:' + left + 'px;top:' + Math.max(0, top - 24) + 'px;' +
    'background:' + (casou ? '#3d5a47' : '#c9847a') + ';color:#fff;font-size:11px;padding:2px 8px;' +
    'border-radius:6px;z-index:25;pointer-events:none;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.25);';
  g.textContent = 'altura ' + Math.round(altura) + 'px' + (casou ? ' · igual à vizinha ✓' : '');
  _descDoc.appendChild(g);
  _guias.push(g);
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
  } else {
    console.error('Erro ao salvar descritivo:', error);
    if (!silencioso) {
      const pesado = html && html.length > 3800000;
      toast(pesado
        ? 'Não salvou: descritivo muito pesado (imagens grandes/demais). Remova ou reduza imagens.'
        : 'Erro ao salvar o descritivo na nuvem.', 'erro');
    }
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
