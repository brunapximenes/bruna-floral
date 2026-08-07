/* ============================================================
   painel-evento.js — Abrir, carregar e editar um evento
   ============================================================ */

let eventoAtual = null;   // objeto completo do evento aberto
let tipoAtual   = 'casamento';

/* ── Mapa de orçamentos prontos (nome do cliente → arquivo em /orcamentos) ──
   Para vincular um novo orçamento a um cliente, basta adicionar uma linha aqui
   com o nome exatamente como aparece no painel e o nome do arquivo (sem .html). */
const ORCAMENTOS = {
  'aline e mateus':          'aline-mateus',
  'ana laura e luis':        'ana-laura-luis',
  'pedro e sabrina':         'pedro-sabrina',
  'cynthia e josuelligton':  'cynthia-josuelligton',
  'isabella e david':        'isabella-david',
  'julia e arthur':          'julia-arthur',
};

/* Normaliza o nome para casar sem depender de acento/maiúscula/espaço */
function _normNome(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/\s+/g, ' ')
    .trim();
}

function orcamentoDoEvento(ev) {
  if (!ev) return null;
  return ev.orcamento_slug || ORCAMENTOS[_normNome(ev.nomes)] || null;
}

/* ── NAVEGAÇÃO ──────────────────────────────────────────────── */
async function abrirEvento(id) {
  document.getElementById('tela-lista').classList.remove('active');
  document.getElementById('tela-evento').classList.add('active');
  window.scrollTo({ top: 0 });

  const { data, error } = await sb
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) { toast('Erro ao carregar evento.', 'erro'); return; }

  eventoAtual = data;
  tipoAtual   = data.tipo_evento || 'casamento';

  preencherCampos(data);
  aplicarConfigTipo();
  document.getElementById('status-select').value = data.status || 'novo';
  document.getElementById('evento-nome-header').textContent = data.nomes || '(sem nome)';

  // Botão "Ver orçamento" — só aparece se o evento tiver um orçamento vinculado
  const btnOrc = document.getElementById('btn-ver-orcamento');
  btnOrc.style.display = orcamentoDoEvento(data) ? '' : 'none';

  // Carregar aba ativa (padrão = descritivo)
  goAba('descritivo', document.querySelector('.aba[data-aba="descritivo"]'));
  carregarDescritivo();

  // Carregar financeiro em background
  await Promise.all([
    carregarItensOrcamento(),
    carregarItensInterno()
  ]);
}

function abrirOrcamentoExterno() {
  const slug = orcamentoDoEvento(eventoAtual);
  if (!slug) return;
  window.open('/orcamentos/' + slug + '.html', '_blank');
}

function voltarLista() {
  document.getElementById('tela-evento').classList.remove('active');
  document.getElementById('tela-lista').classList.add('active');
  carregarLista();
}

/* ── EXCLUIR / ARQUIVAR ─────────────────────────────────────── */
function confirmarExcluir() {
  if (!eventoAtual) return;
  document.getElementById('modal-excluir').style.display = 'flex';
}

function fecharModalExcluir() {
  document.getElementById('modal-excluir').style.display = 'none';
}

async function arquivarEvento() {
  if (!eventoAtual) return;
  const { error } = await sb
    .from('events')
    .update({ status: 'arquivado' })
    .eq('id', eventoAtual.id);
  fecharModalExcluir();
  if (error) { toast('Erro ao arquivar.', 'erro'); return; }
  toast('Evento arquivado ✓');
  voltarLista();
}

async function excluirEvento() {
  if (!eventoAtual) return;
  const { error } = await sb
    .from('events')
    .delete()
    .eq('id', eventoAtual.id);
  fecharModalExcluir();
  if (error) { toast('Erro ao excluir.', 'erro'); return; }
  toast('Evento excluído ✓');
  voltarLista();
}

function goAba(id, btn) {
  document.querySelectorAll('.pag').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.aba').forEach(a => a.classList.remove('active'));
  document.getElementById('pag-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}

/* ── PREENCHER CAMPOS ───────────────────────────────────────── */
function preencherCampos(d) {
  // Campos mapeados: id do input → chave no banco
  const mapa = {
    'nomes':          d.nomes,
    'telefone':       d.telefone,
    'origem':         d.origem,
    'local':          d.local_evento,
    'data':           d.data_evento,
    'horario':        d.horario,
    'pessoas':        d.num_convidados,
    'cerimonial':     d.cerimonial,
    'estilo':         d.estilo,
    'paleta':         d.paleta,
    'tema-corp':      d.tema_corp,
    'budget-cliente': d.budget_cliente,
    'obs-geral':      d.obs_geral,
    'notas-internas': d.notas_internas,

    // Específicos
    'aniver-idade':   d.aniver_idade,
    'mae-aniver':     d.tipo_evento === 'aniversario' ? d.mae_responsavel : null,
    'mae-batizado':   d.tipo_evento === 'batizado'    ? d.mae_responsavel : null,

    // Cerimônia
    'mesmo-end':       d.mesmo_end,
    'ambientes':       d.ambientes,
    'loc-cadeiras':    d.loc_cadeiras,
    'flores-caminho':  d.flores_caminho,
    'altar-estilo':    d.altar_estilo,
    'altar-estrutura': d.altar_estrutura,
    'welcome':         d.welcome,
    'obs-cerimonia':   d.obs_cerimonia,

    // Convidados
    'loc-mesas':       d.loc_mesas,
    'mesa-posta':      d.mesa_posta,
    'arranjo-conv':    d.arranjo_conv,
    'mesa-familia':    d.mesa_familia,
    'arranjo-familia': d.arranjo_familia,
    'obs-conv':        d.obs_conv,

    // Bolo
    'bolo-junto':      d.bolo_junto,
    'bolo-tam':        d.bolo_tam,
    'qtd-doces':       d.qtd_doces,
    'lembranca':       d.lembranca,
    'lembranca-area':  d.lembranca_area,
    'obs-doces':       d.obs_doces,

    // Buffet
    'buffet-tipo':     d.buffet_tipo,
    'buffet-mesas':    d.buffet_mesas,
    'bar':             d.bar,
    'obs-buffet':      d.obs_buffet,

    // Demais
    'lounge':          d.lounge,
    'banda':           d.banda,
    'iluminacao':      d.iluminacao,
    'cenario':         d.cenario,
    'buque':           d.buque,
    'obs-extras':      d.obs_extras,
  };

  Object.entries(mapa).forEach(([id, valor]) => setVal(id, valor));
  atualizarLinkWhats();
}

/* Mostra/atualiza o botão de abrir a conversa no WhatsApp a partir do celular */
function atualizarLinkWhats() {
  const link = document.getElementById('link-whats');
  if (!link) return;
  const d = (val('telefone') || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) {
    link.href = 'https://wa.me/55' + d;
    link.style.display = '';
  } else {
    link.style.display = 'none';
  }
}

/* ── CONFIG POR TIPO ────────────────────────────────────────── */
function aplicarConfigTipo() {
  const c = CFG_TIPO[tipoAtual];
  document.getElementById('label-nomes').textContent     = c.nomes;
  document.getElementById('label-lembranca').textContent = c.lembranca;
  tog('q-origem',       c.origem);
  tog('q-cerimonial',   c.cerimonial);
  tog('q-altar',        c.altar);
  tog('q-welcome',      c.welcome);
  tog('q-buque',        c.buque);
  tog('q-banda',        c.banda);
  tog('q-familia',      c.familia);
  tog('q-tema-corp',    tipoAtual === 'corporativo');
  tog('q-aniver',       tipoAtual === 'aniversario');
  tog('q-mae-batizado', tipoAtual === 'batizado');
  if (tipoAtual !== 'aniversario') {
    document.querySelector('.q-mae-aniver').classList.add('hidden');
  }

  const abaCer = document.getElementById('aba-cerimonia');
  const cardCer = document.getElementById('card-orc-cerimonia');
  if (c.cerimonia) {
    abaCer.classList.remove('hidden');
    if (cardCer) cardCer.style.display = '';
  } else {
    abaCer.classList.add('hidden');
    if (cardCer) cardCer.style.display = 'none';
  }
}

/* ── SALVAR CAMPO INDIVIDUAL (auto-save no onchange) ──────── */
let _saveTimer = {};

async function salvarCampo(chave) {
  if (!eventoAtual) return;

  // Mapeia id do input → chave do banco
  const mapaInput = {
    'nomes':          'nomes',
    'origem':         'origem',
    'local_evento':   'local_evento',
    'data_evento':    'data_evento',
    'horario':        'horario',
    'num_convidados': 'num_convidados',
    'cerimonial':     'cerimonial',
    'estilo':         'estilo',
    'paleta':         'paleta',
    'tema_corp':      'tema_corp',
    'budget_cliente': 'budget_cliente',
    'obs_geral':      'obs_geral',
    'notas_internas': 'notas_internas',
  };

  const inputId = Object.keys(mapaInput).find(k => mapaInput[k] === chave) || chave;

  // Pega valor do elemento correto pelo id do input HTML
  const elId = {
    'nomes':          'nomes',
    'telefone':       'telefone',
    'origem':         'origem',
    'local_evento':   'local',
    'data_evento':    'data',
    'horario':        'horario',
    'num_convidados': 'pessoas',
    'cerimonial':     'cerimonial',
    'estilo':         'estilo',
    'paleta':         'paleta',
    'tema_corp':      'tema-corp',
    'budget_cliente': 'budget-cliente',
    'obs_geral':      'obs-geral',
    'notas_internas': 'notas-internas',
    'mesmo_end':      'mesmo-end',
    'ambientes':      'ambientes',
    'loc_cadeiras':   'loc-cadeiras',
    'flores_caminho': 'flores-caminho',
    'altar_estilo':   'altar-estilo',
    'altar_estrutura':'altar-estrutura',
    'welcome':        'welcome',
    'obs_cerimonia':  'obs-cerimonia',
    'loc_mesas':      'loc-mesas',
    'mesa_posta':     'mesa-posta',
    'arranjo_conv':   'arranjo-conv',
    'mesa_familia':   'mesa-familia',
    'arranjo_familia':'arranjo-familia',
    'obs_conv':       'obs-conv',
    'bolo_junto':     'bolo-junto',
    'bolo_tam':       'bolo-tam',
    'qtd_doces':      'qtd-doces',
    'lembranca':      'lembranca',
    'lembranca_area': 'lembranca-area',
    'obs_doces':      'obs-doces',
    'buffet_tipo':    'buffet-tipo',
    'buffet_mesas':   'buffet-mesas',
    'bar':            'bar',
    'obs_buffet':     'obs-buffet',
    'lounge':         'lounge',
    'banda':          'banda',
    'iluminacao':     'iluminacao',
    'cenario':        'cenario',
    'buque':          'buque',
    'obs_extras':     'obs-extras',
    'aniver_idade':   'aniver-idade',
  }[chave] || chave;

  const valor = val(elId) || null;

  // Debounce de 800ms para não salvar a cada tecla
  clearTimeout(_saveTimer[chave]);
  _saveTimer[chave] = setTimeout(async () => {
    const update = { [chave]: valor };

    // Atualiza nome no header se for o campo nomes
    if (chave === 'nomes') {
      document.getElementById('evento-nome-header').textContent = valor || '(sem nome)';
    }

    const { error } = await sb
      .from('events')
      .update(update)
      .eq('id', eventoAtual.id);

    if (!error) {
      eventoAtual[chave] = valor;
      toast('Salvo ✓');
    } else {
      toast('Erro ao salvar.', 'erro');
    }
  }, 800);
}

async function salvarCampoMae() {
  if (!eventoAtual) return;
  const v = tipoAtual === 'batizado' ? val('mae-batizado')
          : tipoAtual === 'aniversario' ? val('mae-aniver')
          : null;
  const { error } = await sb
    .from('events')
    .update({ mae_responsavel: v || null })
    .eq('id', eventoAtual.id);
  if (!error) { eventoAtual.mae_responsavel = v; toast('Salvo ✓'); }
  else toast('Erro ao salvar.', 'erro');
}

async function salvarStatus() {
  if (!eventoAtual) return;
  const novoStatus = document.getElementById('status-select').value;
  const { error } = await sb
    .from('events')
    .update({ status: novoStatus })
    .eq('id', eventoAtual.id);
  if (!error) { eventoAtual.status = novoStatus; toast('Status atualizado ✓'); }
  else toast('Erro ao salvar status.', 'erro');
}
