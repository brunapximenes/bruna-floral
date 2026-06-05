/* ============================================================
   utils.js — Funções utilitárias compartilhadas
   ============================================================ */

/** Pega valor de um input pelo id (retorna '' se não existir) */
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

/** Define valor de um input pelo id (silencioso se não existir) */
function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = (v === null || v === undefined) ? '' : v;
}

/** Mostra/oculta elementos por classe */
function tog(cls, show) {
  document.querySelectorAll('.' + cls).forEach(el => {
    show ? el.classList.remove('hidden') : el.classList.add('hidden');
  });
}

/** Formata valor em R$ */
function fmt(n) {
  return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formata data YYYY-MM-DD → DD/MM/YYYY */
function fmtData(str) {
  if (!str) return '—';
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('pt-BR');
}

/** Toast de feedback */
let _toastTimer = null;
function toast(msg, tipo = 'ok') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = tipo === 'erro' ? 'erro show' : 'show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3500);
}

/** Labels e cores dos status */
const STATUS_LABELS = {
  novo:              'Novo',
  em_analise:        'Em análise',
  orcamento_enviado: 'Orçamento enviado',
  fechado:           'Fechado',
  cancelado:         'Cancelado'
};
const STATUS_BADGE = {
  novo:              'badge-novo',
  em_analise:        'badge-analise',
  orcamento_enviado: 'badge-orc',
  fechado:           'badge-fechado',
  cancelado:         'badge-cancelado'
};

/** Labels de tipo de evento */
const TIPO_LABELS = {
  casamento:   'Casamento',
  aniversario: 'Aniversário',
  batizado:    'Batizado',
  corporativo: 'Corporativo'
};

/** Configuração de campos por tipo de evento */
const CFG_TIPO = {
  casamento:   { nomes:'Nome do casal',             origem:true,  cerimonial:true,  altar:true,  welcome:true, lembranca:'Bem casado / palha italiana / lembrancinha?', buque:true,  banda:true,  familia:true,  cerimonia:true  },
  aniversario: { nomes:'Nome do aniversariante',     origem:true,  cerimonial:true,  altar:false, welcome:true, lembranca:'Bem casado / palha italiana / lembrancinha?', buque:false, banda:true,  familia:false, cerimonia:false },
  batizado:    { nomes:'Nome do bebê / criança',     origem:true,  cerimonial:true,  altar:true,  welcome:true, lembranca:'Bem batizado / lembrancinha?',                buque:false, banda:false, familia:true,  cerimonia:true  },
  corporativo: { nomes:'Nome da empresa / evento',   origem:false, cerimonial:false, altar:false, welcome:true, lembranca:'Presenteáveis?',                              buque:false, banda:true,  familia:false, cerimonia:false }
};
