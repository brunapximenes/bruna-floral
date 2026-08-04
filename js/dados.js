/* ============================================================
   dados.js — Formulário público de dados pessoais para o contrato.
   Recebe o evento pelo ?id= na URL e grava em events.dados_contrato.
   ============================================================ */

const _params = new URLSearchParams(location.search);
const _eventoId = _params.get('id');

const _campos = {
  nome_completo: 'd-nome',
  cpf:           'd-cpf',
  celular:       'd-celular',
  estado_civil:  'd-estado',
  nacionalidade: 'd-nacionalidade',
  endereco:      'd-endereco',
  insta:         'd-insta',
  email:         'd-email',
  forn_fotografia: 'd-fotografia',
  forn_filmagem:   'd-filmagem',
  forn_make:       'd-make',
  forn_vestido:    'd-vestido',
  forn_buffet:     'd-buffet',
  forn_bolo:       'd-bolo',
  forn_doces:      'd-doces',
  forn_assessoria: 'd-assessoria',
};

(async function init() {
  if (!_eventoId) {
    document.getElementById('tela').style.display = 'none';
    document.getElementById('erro-id').style.display = 'block';
    return;
  }

  // Carrega o evento para saudar e pré-preencher o que já existe
  const { data, error } = await sb
    .from('events')
    .select('nomes, telefone, dados_contrato')
    .eq('id', _eventoId)
    .single();

  if (error || !data) {
    document.getElementById('tela').style.display = 'none';
    document.getElementById('erro-id').style.display = 'block';
    return;
  }

  if (data.nomes) {
    document.getElementById('topo-sub').textContent = 'Contrato de ' + data.nomes;
  }

  const dc = data.dados_contrato || {};
  Object.entries(_campos).forEach(([chave, id]) => {
    const el = document.getElementById(id);
    if (el && dc[chave]) el.value = dc[chave];
  });
  // celular: se ainda não preencheu, usa o telefone do questionário
  const celEl = document.getElementById('d-celular');
  if (celEl && !celEl.value && data.telefone) celEl.value = data.telefone;
})();

async function enviarDados() {
  const btn = document.getElementById('btn-enviar');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const dados = {};
  Object.entries(_campos).forEach(([chave, id]) => {
    const el = document.getElementById(id);
    dados[chave] = el ? el.value.trim() : '';
  });

  const { error } = await sb
    .from('events')
    .update({ dados_contrato: dados })
    .eq('id', _eventoId);

  if (error) {
    console.error('Erro ao salvar dados:', error);
    toast('Não foi possível enviar. Tente novamente em instantes.', 'erro');
    btn.disabled = false;
    btn.textContent = 'Enviar dados';
    return;
  }

  document.getElementById('tela').style.display = 'none';
  document.getElementById('confirma').style.display = 'block';
  window.scrollTo({ top: 0 });
}
