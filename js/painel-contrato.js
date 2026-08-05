/* ============================================================
   painel-contrato.js — Aba "Contrato" do painel
   Documento editável, salvo na nuvem (events.contrato_html).
   Auto-preenche os dados que o sistema já tem.
   ============================================================ */

let _ctTimer = null;
let _ctDoc = null;
let _ctChave = null;

function carregarContrato() {
  if (!eventoAtual) return;
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
}

/* Preenche os campos de forma de pagamento com o que está salvo no evento */
function preencherCamposPagamento() {
  if (!eventoAtual) return;
  const setv = (id, v) => { const e = document.getElementById(id); if (e) e.value = v || ''; };
  setv('ct-valor', eventoAtual.contrato_valor);
  setv('ct-extenso', eventoAtual.contrato_valor_extenso);
  setv('ct-parcelas', eventoAtual.contrato_parcelas);
  setv('ct-vencimentos', eventoAtual.contrato_vencimentos);
  const vEl = document.getElementById('ct-valor');
  if (vEl && typeof calcVenda === 'function' && calcVenda() > 0) {
    vEl.placeholder = 'Orçamento: ' + fmt(calcVenda());
  }
}

/* Salva a forma de pagamento no evento (não regenera o contrato — isso é no "Preencher do sistema") */
async function salvarPagamento() {
  if (!eventoAtual) return;
  const g = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
  const upd = {
    contrato_valor:         g('ct-valor')       || null,
    contrato_valor_extenso: g('ct-extenso')     || null,
    contrato_parcelas:      g('ct-parcelas')    || null,
    contrato_vencimentos:   g('ct-vencimentos') || null,
  };
  const { error } = await sb.from('events').update(upd).eq('id', eventoAtual.id);
  if (!error) { Object.assign(eventoAtual, upd); toast('Forma de pagamento salva ✓'); }
  else toast('Erro ao salvar a forma de pagamento.', 'erro');
}

/* Regenera o contrato com os dados atuais do sistema (mantém o Anexo se já houver) */
function preencherContrato() {
  if (!eventoAtual) { toast('Nenhum evento aberto.', 'erro'); return; }
  if (!confirm('Preencher novamente com os dados do sistema? O texto que você editou à mão neste contrato será substituído (o Anexo é mantido).')) return;
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

  anexo.innerHTML = html;
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
   salvando via callback. Funciona com mouse e toque. ── */
function ativarImagensArrastaveis(doc, onSave) {
  if (doc._imgArrastavelOn) return;
  doc._imgArrastavelOn = true;
  let sel = null, arr = null;

  function desselecionar() {
    if (!sel) return;
    sel.classList.remove('ds-img-sel');
    sel.querySelectorAll('.ds-ui').forEach(el => el.remove());
    sel = null;
  }
  function selecionar(wrap) {
    desselecionar();
    sel = wrap;
    wrap.classList.add('ds-img-sel');
    const del = document.createElement('span'); del.className = 'ds-img-del ds-ui'; del.textContent = '×';
    const alca = document.createElement('span'); alca.className = 'ds-img-handle ds-ui';
    wrap.appendChild(del); wrap.appendChild(alca);
  }

  doc.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('ds-img-del')) {
      const w = e.target.closest('.ds-img-wrap');
      if (w) { w.remove(); sel = null; onSave(); }
      return;
    }
    const wrap = e.target.closest ? e.target.closest('.ds-img-wrap') : null;
    if (wrap) selecionar(wrap); else desselecionar();
  });

  doc.addEventListener('pointerdown', (e) => {
    const wrap = e.target.closest ? e.target.closest('.ds-img-wrap') : null;
    if (!wrap) return;
    if (e.target.classList.contains('ds-img-del')) return;
    e.preventDefault();
    selecionar(wrap);
    const resize = e.target.classList.contains('ds-img-handle');
    arr = {
      tipo: resize ? 'resize' : 'mover', wrap,
      x0: e.clientX, y0: e.clientY,
      left0: parseFloat(wrap.style.left) || 0,
      top0:  parseFloat(wrap.style.top)  || 0,
      w0:    parseFloat(wrap.style.width) || wrap.offsetWidth,
    };
    const mover = (ev) => {
      if (!arr) return;
      const dx = ev.clientX - arr.x0, dy = ev.clientY - arr.y0;
      if (arr.tipo === 'mover') {
        arr.wrap.style.left = (arr.left0 + dx) + 'px';
        arr.wrap.style.top  = (arr.top0 + dy) + 'px';
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
  <h1 class="ct-titulo">Contrato Design Floral</h1>

  <div class="ct-sec">Das partes</div>

  <div class="ct-sub">CONTRATADA</div>
  <p>Canga Fulô, inscrita no CNPJ nº 23.667.854/0001-21. Neste ato, representada por Bruna Padilha Ximenes de Mendonça, inscrita sob CPF nº 097.176.324-05, residente e domiciliada na Rua Adalberto Camargo, 58, apto 701, Graças, Recife/PE.</p>
  <p>Celular: (81) 98136-4921. &nbsp; Email: bruna@cangafulo.com.br</p>

  <div class="ct-sub">CONTRATANTE</div>
  <p>Nome: ${f(nome)}</p>
  <p>CPF: ${f(dc.cpf)} &nbsp;&nbsp; Insta: ${f(dc.insta)}</p>
  <p>Estado civil: ${f(dc.estado_civil)}</p>
  <p>Nacionalidade: ${f(dc.nacionalidade)}</p>
  <p>Endereço: ${f(dc.endereco)}</p>
  <p>Celular: ${f(cel)}</p>
  <p>Email: ${f(dc.email)}</p>

  <div class="ct-sub">Fornecedores <span class="ct-obs">(preenchidos pelo cliente ou por você — pode deixar em branco)</span></div>
  <div class="ct-forn">
    ${_ctFornLinha('Fotografia', dc.forn_fotografia, 'Filmagem', dc.forn_filmagem)}
    ${_ctFornLinha('Cerimonial', cerim, 'Decoração', 'Canga Fulô')}
    ${_ctFornLinha('Make/cabelo', dc.forn_make, 'Vestido', dc.forn_vestido)}
    ${_ctFornLinha('Buffet', dc.forn_buffet, 'Bolo', dc.forn_bolo)}
    ${_ctFornLinha('doces', dc.forn_doces, 'Assessoria', dc.forn_assessoria)}
    ${_ctFornLinha('Local', local, '', null)}
  </div>

  <div class="ct-sec">Do objeto</div>
  <p><strong>Cláusula 1º</strong> - O presente contrato tem por objeto o fornecimento de decoração de casamento com design floral.</p>
  <p>Data: ${f(data)} &nbsp;&nbsp; Local: ${f(local)}</p>
  <p>E-mails e mensagens trocados entre CONTRATADA e CONTRATANTE passam a fazer parte integrante deste ACORDO.</p>
  <p><em>(DESCRIÇÃO DOS PRODUTOS EM ANEXO)</em></p>

  <div class="ct-sec">Do preço e forma de pagamento</div>
  <p><strong>Cláusula 2º</strong> - Pelo(s) produto(s) e/ou serviço(s) adquiridos pagará a CONTRATANTE à CONTRATADA o valor de <strong>${valor}</strong> ( ${extenso ? extenso : '<span class="ct-fill"></span>'} ).</p>
  <p><strong>§1º</strong> Os valores e a forma de pagamento deverão ser pagos conforme combinado entre CONTRATANTE e CONTRATADA.</p>
  <p><strong>Forma de pagamento</strong></p>
  <p>Qt. parcelas: ${parcelas ? parcelas : _ph}</p>
  <p>Vencimentos: ${vencs ? vencs.replace(/\n/g, '<br>') : _ph}</p>
  <p><strong>§2º</strong> O valor devido será liquidado por meio de depósito bancário, DOC, TED ou PIX em conta da empresa CONTRATADA, no Banco Inter.</p>
  <p>Banco Inter (077) &nbsp; Conta Corrente: 1916738-5 &nbsp; Agência: 0001<br>
  Bruna Padilha Ximenes — CNPJ nº 23.667.854/0001-21 (PIX CNPJ)</p>
  <p><strong>§3º</strong> O material ou decoração somente será entregue mediante pagamento antecipado do saldo devedor.</p>

  <div class="ct-sec">Do pedido</div>
  <p><strong>Cláusula 3º</strong> - O CONTRATANTE tem ciência de que após o fechamento do pedido não poderá mais efetuar nenhum tipo de alteração nas características dos produtos adquiridos, seja quanto a tamanho, cor, dimensões ou qualquer outra; salvo quando houver disponibilidade da CONTRATADA e mediante pagamento de valor adicional caso haja diferença.</p>
  <p><strong>Cláusula 4º</strong> - O CONTRATANTE tem ciência de que o processo de produção das peças é artesanal e está ligado diretamente à natureza, podendo apresentar tonalidades, tamanhos e formas variadas. Estão assim sujeitos a pequenas diferenças entre a referência inicialmente apresentada e o produto final.</p>
  <p><strong>Cláusula 5º</strong> - Como padrão, os produtos serão entregues ao CONTRATANTE em embalagens próprias. Caso o CONTRATANTE deseje que os produtos sejam colocados em embalagens especiais, como isopor, para melhor transportar em caso de viagens, será cobrado valor adicional.</p>
  <p><em>Parágrafo único</em> - O formato da embalagem e a forma de envio não serão motivos para negativa de recebimento dos produtos tão pouco de seu pagamento integral.</p>
  <p><strong>Cláusula 6º</strong> - Nos casos de Design Floral + Decoração ou Taxa de Montagem serão seguidos todos os detalhes descritos no anexo.</p>

  <div class="ct-sec">Da entrega</div>
  <p><strong>Cláusula 7º</strong> - Por se tratarem de produtos feitos com flores naturais, os mesmos deverão ser entregues ao CONTRATANTE ou representante previamente autorizado no dia do evento; salvo em casos especiais, mediante acordo.</p>
  <p><strong>Cláusula 8º</strong> - O CONTRATANTE será notificado exclusivamente via Whatsapp ou ligação quando houver qualquer alteração no horário da entrega causada por motivos exteriores; O CONTRATANTE poderá optar por retirar gratuitamente o pedido no Atelier ou solicitar a entrega mediante pagamento de taxa referente ao deslocamento para o seu destino, sob as seguintes condições:</p>
  <p><strong>§1º RETIRADA GRATUITA NO ATELIER DA CONTRATADA:</strong> Caso o CONTRATANTE opte pela modalidade "SEM FRETE", deverá retirar gratuitamente seu pedido em nosso escritório. A retirada deverá ser agendada e cumprida conforme previamente combinado e atentando-se às condições descritas na Cláusula 6º. A retirada será feita à Rua Tenente Antônio João, 88, Graças, Recife/PE. A contratada não se responsabiliza pela providência da coleta tão pouco por danos causados no transporte da mercadoria até o seu destino.</p>
  <p><strong>§2º FRETE POR CONTA DO CONTRATANTE:</strong> O CONTRATANTE poderá solicitar a entrega do(s) produto(s) comprometendo-se a efetuar o pagamento do transporte - previamente ou no ato do recebimento do pedido - no endereço, data e horário previamente combinado entre as partes. Fica a contratada responsável por quaisquer danos causados no transporte da mercadoria.</p>
  <p><strong>Cláusula 9º</strong> - Em se tratando de decoração completa todos os valores referentes a fretes e deslocamentos já se encontram no bloco "operacional"; salvo custos referentes a solicitações posteriores a este contrato, que poderá acordar informalmente com a CONTRATADA ou através de aditivo contratual.</p>
  <p><strong>Cláusula 10º</strong> - A CONTRATADA se responsabiliza pela finalização das principais áreas da festa de 1 (uma) a 2 (duas) horas antes do horário marcado para que a equipe de fotografia e/ou filmagem possa fazer os registros; Em alguns casos, como arranjos que fiquem fora da água ou em locais de muito sol, é possível que a equipe de decoração aguarde bem próximo ao horário, para posicionar tais arranjos, afim de preservar a qualidade do material.</p>

  <div class="ct-sec">Da indisponibilidade</div>
  <p><strong>Cláusula 11º</strong> - Em caso de indisponibilidade das flores escolhidas a CONTRATADA deverá prosseguir com a substituição para que não reste prejudicado o pedido, a fim de garantir a prestação do serviço, levando em consideração o estilo, cores e detalhes previamente escolhidos.</p>
  <p><strong>§1º</strong> A CONTRATADA garante ao CONTRATANTE o mesmo padrão de qualidade nos materiais disponíveis, independente das pequenas diferenças de tonalidade, formatos e textura apresentadas nas flores que compõem o produto.</p>
  <p><strong>§2º</strong> Em caso de pedido com espécie específica determinada, havendo indisponibilidade da mesma, a CONTRATADA deverá notificar o CONTRATANTE a respeito da alteração antes que seja efetivada a compra das flores. Caso o CONTRATANTE discorde da troca proposta, deverá a CONTRATADA ressarcir todo o valor pago até o presente momento, não cabendo multas ou indenizações; caso a CONTRATADA não consiga estabelecer contato deverá prosseguir com a substituição para que não reste prejudicado o pedido, a fim de garantir a prestação do serviço.</p>

  <div class="ct-sec">Locações e danos (quando houver decoração)</div>
  <p><strong>Cláusula 12º</strong> - A CONTRATADA se responsabiliza pela contratação de todo material e equipe descritos no pedido em anexo.</p>
  <p><strong>§1º</strong> Em caso de dano ao material locado, durante a montagem e desmontagem pela equipe, a CONTRATADA será responsabilizada e arcará com o reparo ou reposição diante da empresa dona do material.</p>
  <p><strong>§2º</strong> Em caso de dano ao material locado, durante a festa ou em outro momento onde a equipe da CONTRATADA não esteja presente, a CONTRATANTE será responsabilizada e deverá arcar com reparo ou reposição diante da empresa dona do material.</p>

  <div class="ct-sec">Hipóteses de rescisão e penalidades</div>
  <p><strong>Cláusula 13º</strong> - O presente contrato poderá ser rescindido nas seguintes hipóteses:</p>
  <p>a) Por mútuo acordo, caso em que não haverá prejuízo a qualquer das partes, retornando as mesmas ao status quo;</p>
  <p>b) Em caso de inadimplência dos valores descritos na Cláusula 2º em até 10 (dez) dias antes do evento ou em qualquer momento posterior, inclusive de eventuais acréscimos extracontratuais, onde a CONTRATADA reserva-se ao direito de não entregar o material, perdendo o CONTRATANTE os valores que já houver pago;</p>
  <p>c) Por culpa da CONTRATADA, quando esta rescindir o contrato até um mês antes da data do evento, caso em que deverá a mesma proceder à devolução de todos os valores que houver recebido do CONTRATANTE;</p>
  <p>d) Por culpa ou desistência do CONTRATANTE faltando até 30 dias para o evento (não importando qual seja o motivo), este não terá direito à devolução integral dos valores pagos e se compromete a quitar seu saldo devedor (caso haja) para cobertura de custos administrativos e operacionais.</p>
  <p><strong>§1º</strong> Na hipótese de culpa ou desistência do CONTRATANTE, quando restarem menos de 30 dias para o evento, além dos custos administrativos e operacionais será cobrada uma multa de 30% sobre o valor total do contrato com a justificativa de que a EMPRESA CONTRATADA ficou impossibilitada de fechar contrato com outros clientes durante todo o período de vigência deste mesmo contrato.</p>
  <p><strong>§2º</strong> Na hipótese de culpa ou desistência da CONTRATADA, quando restarem menos de 30 dias para o evento, a mesma deverá proceder à devolução de todos os valores que houver recebido do CONTRATANTE e arcar com seus próprios custos administrativos e operacionais.</p>

  <div class="ct-sec">Dos direitos autorais</div>
  <p><strong>Cláusula 14º</strong> - A CONTRATADA detém direitos autorais e intelectuais sobre os produtos, podendo inclusive, utilizar como portfólio em seu portal na internet, mídias sociais, flyers, mostruários, matérias e concursos de arte, desde que exclusivamente para fins de divulgação de seu trabalho.</p>

  <div class="ct-sec">Do foro</div>
  <p><strong>Cláusula 15º</strong> - Fica eleito o Foro da Comarca de Recife - PE para dirimir quaisquer dúvidas oriundas do presente contrato, com exclusão de qualquer outro por mais privilegiado que seja.</p>
  <p>E por estarem justos e contratados, concordam as partes com o presente instrumento Particular de Prestação de Serviços, o qual o CONTRATANTE tem ciência e concorda tendo sido devidamente orientado a ler este acordo quando da formalização de seu pedido.</p>

  <p class="ct-cidade">${assin}</p>

  <div class="ct-assinaturas">
    <div class="ct-assina">${_assinaturaImg()}<div class="ct-linha-assina"></div>CONTRATADA:<br>Bruna Padilha Ximenes</div>
    <div class="ct-assina"><div class="ct-linha-assina"></div>CONTRATANTE:</div>
    <div class="ct-assina"><div class="ct-linha-assina"></div>Testemunha 1:</div>
    <div class="ct-assina"><div class="ct-linha-assina"></div>Testemunha 2:</div>
  </div>

  <div class="ct-sec">Anexo</div>
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
    '.ct-fill{border-bottom:1px solid #999;min-width:80px;display:inline-block;padding:0 4px;}' +
    '.ct-forn-linha{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:6px 10px;margin-bottom:5px;align-items:end;}' +
    '.ct-cidade{margin-top:26px;}' +
    '.ct-assinaturas{margin-top:30px;display:grid;grid-template-columns:1fr 1fr;gap:36px 40px;}' +
    '.ct-assina{font-size:11.5px;}' +
    '.ct-linha-assina{border-top:1px solid #333;margin-bottom:4px;height:28px;}' +
    '.ct-assinatura-img{display:block;max-height:58px;margin:0 auto -20px;position:relative;z-index:2;}' +
    '.ct-anexo{position:relative;}' +
    '.ct-anexo-vazio{color:#aaa;font-style:italic;}';
}
