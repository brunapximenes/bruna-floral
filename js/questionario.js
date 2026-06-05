/* ============================================================
   questionario.js — Lógica do formulário público
   ============================================================ */

let tipoAtual = 'casamento';
let secoes    = [];
let secAtual  = 0;

/* ── INICIALIZAÇÃO ─────────────────────────────────────────── */
(function init() {
  renderTipoBtns();
  atualizarSecoes();
  aplicarConfig();
  mostrarSecao();
})();

/* ── BOTÕES DE TIPO ─────────────────────────────────────────── */
function renderTipoBtns() {
  const row = document.getElementById('tipo-row');
  const tipos = [
    { id: 'casamento',   label: 'Casamento'   },
    { id: 'aniversario', label: 'Aniversário' },
    { id: 'batizado',    label: 'Batizado'    },
    { id: 'corporativo', label: 'Corporativo' }
  ];
  row.innerHTML = tipos.map(t =>
    `<button class="tipo-btn${t.id === tipoAtual ? ' active' : ''}" onclick="setTipo('${t.id}',this)">${t.label}</button>`
  ).join('');
}

function setTipo(t, btn) {
  tipoAtual = t;
  document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  secAtual = 0;
  atualizarSecoes();
  aplicarConfig();
  mostrarSecao();
}

/* ── CONFIGURAÇÃO POR TIPO ──────────────────────────────────── */
function aplicarConfig() {
  const c = CFG_TIPO[tipoAtual];
  document.getElementById('label-nomes').textContent    = c.nomes;
  document.getElementById('label-lembranca').textContent = c.lembranca;
  tog('campo-origem',      c.origem);
  tog('campo-cerimonial',  c.cerimonial);
  tog('campo-altar',       c.altar);
  tog('campo-welcome',     c.welcome);
  tog('campo-buque',       c.buque);
  tog('campo-banda',       c.banda);
  tog('campo-familia',     c.familia);
  tog('campo-tema-corp',   tipoAtual === 'corporativo');
  tog('campo-aniver',      tipoAtual === 'aniversario');
  tog('campo-mae-batizado',tipoAtual === 'batizado');
  if (tipoAtual !== 'aniversario') {
    document.querySelector('.campo-mae-aniver').classList.add('hidden');
  }
}

function checkIdade() {
  const v  = parseInt(document.getElementById('aniver-idade').value) || 0;
  const el = document.querySelector('.campo-mae-aniver');
  (v > 0 && v < 18) ? el.classList.remove('hidden') : el.classList.add('hidden');
}

/* ── NAVEGAÇÃO ──────────────────────────────────────────────── */
function atualizarSecoes() {
  secoes = ['geral'];
  if (CFG_TIPO[tipoAtual].cerimonia) secoes.push('cerimonia');
  secoes.push('convidados', 'bolo', 'buffet', 'demais');
}

function mostrarSecao() {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + secoes[secAtual]).classList.add('active');
  atualizarProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function atualizarProgress() {
  const labels = {
    geral:'Geral', cerimonia:'Cerimônia', convidados:'Convidados',
    bolo:'Bolo e doces', buffet:'Buffet', demais:'Demais áreas'
  };
  const steps = document.getElementById('progress-steps');
  steps.innerHTML = '';
  secoes.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'step' + (i < secAtual ? ' done' : i === secAtual ? ' active' : '');
    steps.appendChild(d);
  });
  document.getElementById('progress-label').textContent =
    `${secAtual + 1} de ${secoes.length} — ${labels[secoes[secAtual]]}`;
}

function proximo() { if (secAtual < secoes.length - 1) { secAtual++; mostrarSecao(); } }
function voltar()  { if (secAtual > 0) { secAtual--; mostrarSecao(); } }

/* ── MONTAR PAYLOAD DO BANCO ────────────────────────────────── */
function montarPayload() {
  const mae = tipoAtual === 'batizado'    ? val('mae-batizado')
            : tipoAtual === 'aniversario' ? val('mae-aniver')
            : null;

  return {
    tipo_evento:      tipoAtual,
    status:           'novo',

    // Geral
    nomes:            val('nomes')        || null,
    origem:           val('origem')       || null,
    cerimonial:       val('cerimonial')   || null,
    local_evento:     val('local')        || null,
    data_evento:      val('data')         || null,
    horario:          val('horario')      || null,
    num_convidados:   parseInt(val('pessoas')) || null,
    estilo:           val('estilo')       || null,
    paleta:           val('paleta')       || null,
    budget_cliente:   val('budget')       || null,
    obs_geral:        val('obs-geral')    || null,

    // Por tipo
    aniver_idade:    tipoAtual === 'aniversario' ? (parseInt(val('aniver-idade')) || null) : null,
    mae_responsavel: mae || null,
    tema_corp:       tipoAtual === 'corporativo' ? (val('tema-corp') || null) : null,

    // Cerimônia
    mesmo_end:        val('mesmo-end')       || null,
    ambientes:        val('ambientes')        || null,
    loc_cadeiras:     val('loc-cadeiras')     || null,
    flores_caminho:   val('flores-caminho')   || null,
    altar_estilo:     val('altar-estilo')     || null,
    altar_estrutura:  val('altar-estrutura')  || null,
    welcome:          val('welcome')          || null,
    obs_cerimonia:    val('obs-cerimonia')    || null,

    // Convidados
    loc_mesas:        val('loc-mesas')        || null,
    mesa_posta:       val('mesa-posta')       || null,
    arranjo_conv:     val('arranjo-conv')     || null,
    mesa_familia:     val('mesa-familia')     || null,
    arranjo_familia:  val('arranjo-familia')  || null,
    obs_conv:         val('obs-conv')         || null,

    // Bolo/doces
    bolo_junto:       val('bolo-junto')       || null,
    bolo_tam:         val('bolo-tam')         || null,
    qtd_doces:        parseInt(val('qtd-doces')) || null,
    lembranca:        val('lembranca')        || null,
    lembranca_area:   val('lembranca-area')   || null,
    obs_doces:        val('obs-doces')        || null,

    // Buffet
    buffet_tipo:      val('buffet-tipo')      || null,
    buffet_mesas:     val('buffet-mesas')     || null,
    bar:              val('bar')              || null,
    obs_buffet:       val('obs-buffet')       || null,

    // Demais
    lounge:           val('lounge')           || null,
    banda:            val('banda')            || null,
    iluminacao:       val('iluminacao')       || null,
    cenario:          val('cenario')          || null,
    buque:            val('buque')            || null,
    obs_extras:       val('obs-extras')       || null,
  };
}

/* ── MONTAR MENSAGEM WHATSAPP ───────────────────────────────── */
function montarMsgWhatsApp(d) {
  const c = CFG_TIPO[tipoAtual];
  const tipoLabel = TIPO_LABELS[tipoAtual];
  let msg = '🌸 *QUESTIONÁRIO DE DECORAÇÃO FLORAL*\n\n';
  msg += `*Tipo de evento:* ${tipoLabel}\n`;
  msg += `*${c.nomes}:* ${d.nomes || '—'}\n`;
  if (d.origem)           msg += `*De onde são:* ${d.origem}\n`;
  if (d.aniver_idade)     msg += `*Aniversário de:* ${d.aniver_idade} anos\n`;
  if (d.mae_responsavel)  msg += `*Mãe / responsável:* ${d.mae_responsavel}\n`;
  if (d.local_evento)     msg += `*Local:* ${d.local_evento}\n`;
  if (d.data_evento)      msg += `*Data:* ${fmtData(d.data_evento)}\n`;
  if (d.horario)          msg += `*Horário:* ${d.horario}\n`;
  if (d.num_convidados)   msg += `*Convidados:* ${d.num_convidados}\n`;
  if (d.cerimonial)       msg += `*Cerimonial:* ${d.cerimonial}\n`;
  if (d.estilo)           msg += `*Estilo:* ${d.estilo}\n`;
  if (d.paleta)           msg += `*Paleta:* ${d.paleta}\n`;
  if (d.tema_corp)        msg += `*Tema/identidade:* ${d.tema_corp}\n`;
  if (d.budget_cliente)   msg += `*Orçamento previsto:* ${d.budget_cliente}\n`;
  if (d.obs_geral)        msg += `*Obs. gerais:* ${d.obs_geral}\n`;

  if (c.cerimonia) {
    msg += '\n*— CERIMÔNIA —*\n';
    if (d.mesmo_end)       msg += `*Mesmo endereço:* ${d.mesmo_end}\n`;
    if (d.ambientes)       msg += `*Ambientes:* ${d.ambientes}\n`;
    if (d.loc_cadeiras)    msg += `*Locação cadeiras:* ${d.loc_cadeiras}\n`;
    if (d.flores_caminho)  msg += `*Flores caminho:* ${d.flores_caminho}\n`;
    if (d.altar_estilo)    msg += `*Altar estilo:* ${d.altar_estilo}\n`;
    if (d.altar_estrutura) msg += `*Altar estrutura:* ${d.altar_estrutura}\n`;
    if (d.welcome)         msg += `*Welcome drinks:* ${d.welcome}\n`;
    if (d.obs_cerimonia)   msg += `*Obs:* ${d.obs_cerimonia}\n`;
  }

  msg += '\n*— CONVIDADOS —*\n';
  if (d.loc_mesas)       msg += `*Locação mesas:* ${d.loc_mesas}\n`;
  if (d.mesa_posta)      msg += `*Mesa posta:* ${d.mesa_posta}\n`;
  if (d.arranjo_conv)    msg += `*Arranjo convidados:* ${d.arranjo_conv}\n`;
  if (d.mesa_familia)    msg += `*Mesa família:* ${d.mesa_familia}\n`;
  if (d.arranjo_familia) msg += `*Arranjo família:* ${d.arranjo_familia}\n`;

  msg += '\n*— BOLO E DOCES —*\n';
  if (d.bolo_junto)     msg += `*Bolo e doces juntos:* ${d.bolo_junto}\n`;
  if (d.bolo_tam)       msg += `*Tamanho bolo:* ${d.bolo_tam}\n`;
  if (d.qtd_doces)      msg += `*Qtd doces:* ${d.qtd_doces}\n`;
  if (d.lembranca)      msg += `*${c.lembranca.replace('?','')}:* ${d.lembranca}\n`;
  if (d.lembranca_area) msg += `*Área exclusiva:* ${d.lembranca_area}\n`;

  msg += '\n*— BUFFET —*\n';
  if (d.buffet_tipo)  msg += `*Formato:* ${d.buffet_tipo}\n`;
  if (d.buffet_mesas) msg += `*Mesas buffet:* ${d.buffet_mesas}\n`;
  if (d.bar)          msg += `*Bar:* ${d.bar}\n`;

  msg += '\n*— DEMAIS ÁREAS —*\n';
  if (d.lounge)     msg += `*Lounge:* ${d.lounge}\n`;
  if (d.banda)      msg += `*Banda/palco:* ${d.banda}\n`;
  if (d.iluminacao) msg += `*Iluminação:* ${d.iluminacao}\n`;
  if (d.cenario)    msg += `*Cenário/fotos:* ${d.cenario}\n`;
  if (d.buque)      msg += `*Buquê:* ${d.buque}\n`;
  if (d.obs_extras) msg += `*Obs extras:* ${d.obs_extras}\n`;

  return msg;
}

/* ── ENVIAR ─────────────────────────────────────────────────── */
async function enviar() {
  const btn = document.getElementById('btn-enviar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Salvando...';

  const dados = montarPayload();

  // 1. Salvar no banco
  let salvoNoBanco = false;
  try {
    const { error } = await sb.from('events').insert([dados]);
    if (error) throw error;
    salvoNoBanco = true;
  } catch (err) {
    console.error('Erro ao salvar no banco:', err);
    // Não bloqueia o WhatsApp — sempre abre mesmo se o banco falhar
    toast('Não foi possível salvar no sistema, mas seu WhatsApp será aberto normalmente.', 'erro');
  }

  // 2. Abrir WhatsApp (sempre)
  const msg = montarMsgWhatsApp(dados);
  const url  = `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');

  // 3. Mostrar confirmação
  document.getElementById('tela-formulario').style.display = 'none';
  document.getElementById('tela-confirmacao').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  btn.disabled = false;
  btn.innerHTML = '✦ Enviar questionário';
}
