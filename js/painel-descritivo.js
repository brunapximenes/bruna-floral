/* ============================================================
   painel-descritivo.js — Aba "Descritivo" do painel
   ============================================================ */

function carregarDescritivo() {
  if (!eventoAtual) return;
  const CHAVE = 'desc-v1-' + eventoAtual.id;
  const doc   = document.getElementById('descritivo-doc');
  const salvo = localStorage.getItem(CHAVE);
  if (salvo) {
    doc.innerHTML = salvo;
  } else {
    doc.innerHTML = templateDescritivo(eventoAtual);
    localStorage.setItem(CHAVE, doc.innerHTML);
  }
  doc.oninput = () => localStorage.setItem(CHAVE, doc.innerHTML);
}

function preencherDescritivo() {
  if (!eventoAtual) { toast('Nenhum evento aberto.', 'erro'); return; }
  if (!confirm('Substituir o descritivo atual pelos dados do formulário?')) return;
  const CHAVE = 'desc-v1-' + eventoAtual.id;
  const doc   = document.getElementById('descritivo-doc');
  doc.innerHTML = templateDescritivo(eventoAtual);
  localStorage.setItem(CHAVE, doc.innerHTML);
  doc.oninput = () => localStorage.setItem(CHAVE, doc.innerHTML);
}

function imprimirDescritivo() {
  const doc  = document.getElementById('descritivo-doc');
  const nome = (eventoAtual && eventoAtual.nomes) ? eventoAtual.nomes : 'Descritivo';
  const win  = window.open('', '_blank');
  win.document.write(
    '<!DOCTYPE html><html lang="pt-BR">' +
    '<head><meta charset="UTF-8"><title>Descritivo — ' + nome + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">' +
    '<style>' + _dsCssImprimir() + '</style></head>' +
    '<body>' + doc.innerHTML + '</body></html>'
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
