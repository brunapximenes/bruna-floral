/* ============================================================
   painel-convidados.js — Aba "Lista de convidados" (RSVP)
   Lista de convidados com link de confirmação. Cada convidado:
   nome principal + acompanhantes adultos + crianças + status.
   Os convidados confirmam sozinhos pelo link público (confirmar.html),
   que insere a linha aqui. Bruna também adiciona/edita manualmente.
   Tabela: guests
   ============================================================ */

let _convidados = [];

function _cvEsc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Link público de confirmação deste evento */
function linkConfirmacao() {
  if (!eventoAtual) return '';
  const base = location.origin && location.origin.startsWith('http')
    ? location.origin : 'https://bruna-floral.vercel.app';
  const p = new URLSearchParams({
    e: eventoAtual.id,
    n: eventoAtual.nomes || '',
    t: eventoAtual.tipo_evento || '',
    d: eventoAtual.data_evento || ''
  });
  return base + '/confirmar?' + p.toString();
}

async function carregarConvidados() {
  if (!eventoAtual) return;
  const inp = document.getElementById('cv-link');
  if (inp) inp.value = linkConfirmacao();

  _carregarPersonalizacao();

  const { data, error } = await sb
    .from('guests')
    .select('*')
    .eq('event_id', eventoAtual.id)
    .order('status', { ascending: true })
    .order('created_at', { ascending: true });

  _convidados = error ? [] : (data || []);
  _renderConvidados();
}

function _renderConvidados() {
  const tab   = document.getElementById('cv-tabela');
  const vazio = document.getElementById('cv-vazio');
  if (!tab) return;

  if (!_convidados.length) {
    tab.innerHTML = '';
    if (vazio) vazio.style.display = '';
    _renderTotais();
    return;
  }
  if (vazio) vazio.style.display = 'none';

  let html = '<thead><tr>'
    + '<th>Nome principal</th>'
    + '<th class="cv-c">Adultos</th>'
    + '<th class="cv-c">Crianças</th>'
    + '<th class="cv-c">Total</th>'
    + '<th>Status</th>'
    + '<th>Recado</th>'
    + '<th></th>'
    + '</tr></thead><tbody>';

  _convidados.forEach(g => {
    const total = 1 + (Number(g.adultos) || 0) + (Number(g.criancas) || 0);
    const recado = g.mensagem ? '<span class="cv-recado" title="' + _cvEsc(g.mensagem) + '">💬 ' + _cvEsc(g.mensagem) + '</span>' : '';
    html += '<tr class="cv-row cv-' + g.status + '">'
      + '<td><input class="cv-inp cv-inp-nome" value="' + _cvEsc(g.nome) + '" '
        + 'onchange="atualizarConvidado(\'' + g.id + '\',\'nome\',this.value)"></td>'
      + '<td class="cv-c"><input class="cv-inp cv-num" type="number" min="0" value="' + (Number(g.adultos) || 0) + '" '
        + 'onchange="atualizarConvidado(\'' + g.id + '\',\'adultos\',this.value)"></td>'
      + '<td class="cv-c"><input class="cv-inp cv-num" type="number" min="0" value="' + (Number(g.criancas) || 0) + '" '
        + 'onchange="atualizarConvidado(\'' + g.id + '\',\'criancas\',this.value)"></td>'
      + '<td class="cv-c cv-total">' + total + '</td>'
      + '<td><select class="cv-inp cv-status-sel cv-badge-' + g.status + '" '
        + 'onchange="atualizarConvidado(\'' + g.id + '\',\'status\',this.value)">'
        + '<option value="confirmado"' + (g.status === 'confirmado' ? ' selected' : '') + '>✓ Confirmado</option>'
        + '<option value="pendente"' + (g.status === 'pendente' ? ' selected' : '') + '>• Pendente</option>'
        + '<option value="recusado"' + (g.status === 'recusado' ? ' selected' : '') + '>✕ Não vai</option>'
        + '</select></td>'
      + '<td class="cv-recado-td">' + recado + '</td>'
      + '<td class="cv-c"><button class="cv-del" title="Excluir" onclick="removerConvidado(\'' + g.id + '\')">🗑</button></td>'
      + '</tr>';
  });

  html += '</tbody>';
  tab.innerHTML = html;
  _renderTotais();
}

function _renderTotais() {
  const box = document.getElementById('cv-totais');
  if (!box) return;

  const conf = _convidados.filter(g => g.status === 'confirmado');
  const pend = _convidados.filter(g => g.status === 'pendente');
  const rec  = _convidados.filter(g => g.status === 'recusado');

  const adultosConf  = conf.reduce((s, g) => s + (Number(g.adultos) || 0), 0);
  const criancasConf = conf.reduce((s, g) => s + (Number(g.criancas) || 0), 0);
  const pessoasConf  = conf.length + adultosConf + criancasConf;  // principal (1) + acompanhantes

  box.innerHTML =
      _cardTotal('Pessoas confirmadas', pessoasConf, 'ok',
                 conf.length + ' principais · ' + adultosConf + ' adultos · ' + criancasConf + ' crianças')
    + _cardTotal('Convites confirmados', conf.length, 'ok', '')
    + _cardTotal('Pendentes', pend.length, 'pend', '')
    + _cardTotal('Não vão', rec.length, 'rec', '');
}

function _cardTotal(label, valor, cls, sub) {
  return '<div class="cv-card cv-card-' + cls + '">'
    + '<div class="cv-card-num">' + valor + '</div>'
    + '<div class="cv-card-lab">' + label + '</div>'
    + (sub ? '<div class="cv-card-sub">' + sub + '</div>' : '')
    + '</div>';
}

async function adicionarConvidado() {
  if (!eventoAtual) return;
  const nome = val('cv-add-nome');
  if (!nome) { toast('Digite o nome do convidado.', 'erro'); return; }
  const adultos  = parseInt(val('cv-add-adultos'))  || 0;
  const criancas = parseInt(val('cv-add-criancas')) || 0;
  const status   = document.getElementById('cv-add-status').value || 'pendente';

  const linha = {
    event_id: eventoAtual.id,
    nome, adultos, criancas, status,
    confirmed_at: status === 'confirmado' ? new Date().toISOString() : null
  };

  const { data, error } = await sb.from('guests').insert(linha).select().single();
  if (error) { toast('Erro ao adicionar convidado.', 'erro'); return; }

  _convidados.push(data);
  setVal('cv-add-nome', ''); setVal('cv-add-adultos', '0'); setVal('cv-add-criancas', '0');
  document.getElementById('cv-add-status').value = 'pendente';
  document.getElementById('cv-add-nome').focus();
  _renderConvidados();
  toast('Convidado adicionado ✓');
}

async function atualizarConvidado(id, campo, valor) {
  const g = _convidados.find(x => x.id === id);
  if (!g) return;

  if (campo === 'adultos' || campo === 'criancas') valor = parseInt(valor) || 0;

  const upd = { [campo]: valor };
  if (campo === 'status') {
    upd.confirmed_at = valor === 'confirmado'
      ? (g.confirmed_at || new Date().toISOString())
      : (valor === 'recusado' ? new Date().toISOString() : g.confirmed_at);
  }

  const { error } = await sb.from('guests').update(upd).eq('id', id);
  if (error) { toast('Erro ao salvar.', 'erro'); return; }

  Object.assign(g, upd);
  // Recalcula totais/estilos (status muda a cor da linha, números mudam o total)
  _renderConvidados();
}

async function removerConvidado(id) {
  const g = _convidados.find(x => x.id === id);
  const nome = g ? (g.nome || 'este convidado') : 'este convidado';
  if (!confirm('Remover ' + nome + ' da lista?')) return;

  const { error } = await sb.from('guests').delete().eq('id', id);
  if (error) { toast('Erro ao remover.', 'erro'); return; }

  _convidados = _convidados.filter(x => x.id !== id);
  _renderConvidados();
  toast('Removido ✓');
}

/* ── Personalizar a página de confirmação (foto + cor de fundo) ── */
const _CV_BG_PADRAO = '#3d5a47';   // verde do painel

function _carregarPersonalizacao() {
  if (!eventoAtual) return;
  // Foto do convite
  const prev = document.getElementById('cv-convite-preview');
  const btnRm = document.getElementById('cv-convite-rm');
  const img = eventoAtual.confirmar_img || '';
  if (prev) {
    if (img) {
      prev.innerHTML = '<img src="' + _cvEsc(img) + '" alt="Convite">';
      prev.classList.add('tem-foto');
    } else {
      prev.textContent = 'Nenhuma foto — usando o padrão.';
      prev.classList.remove('tem-foto');
    }
  }
  if (btnRm) btnRm.style.display = img ? '' : 'none';

  // Cor de fundo
  const cor = document.getElementById('cv-bg-color');
  const hint = document.getElementById('cv-bg-hint');
  const bg = eventoAtual.confirmar_bg || '';
  if (cor) cor.value = bg || _CV_BG_PADRAO;
  if (hint) hint.textContent = bg ? bg.toUpperCase() : 'Padrão do painel';
}

async function _salvarCampoEventoCV(campo, valor) {
  if (!eventoAtual) return false;
  const { error } = await sb.from('events').update({ [campo]: valor }).eq('id', eventoAtual.id);
  if (error) { toast('Erro ao salvar.', 'erro'); return false; }
  eventoAtual[campo] = valor;
  return true;
}

async function trocarFotoConvite(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || !eventoAtual) return;
  if (!file.type || file.type.indexOf('image/') !== 0) { toast('Selecione uma imagem.', 'erro'); return; }

  toast('Enviando a foto do convite...');
  try {
    const url = await _uploadImagem(file);   // reaproveita o upload do descritivo (bucket público)
    const ok = await _salvarCampoEventoCV('confirmar_img', url);
    if (ok) { _carregarPersonalizacao(); toast('Foto do convite salva ✓'); }
  } catch (e) {
    toast('Não foi possível enviar a foto. Tente de novo.', 'erro');
  }
}

async function removerFotoConvite() {
  if (!eventoAtual) return;
  if (!confirm('Remover a foto do convite desta página de confirmação?')) return;
  const ok = await _salvarCampoEventoCV('confirmar_img', null);
  if (ok) { _carregarPersonalizacao(); toast('Foto removida ✓'); }
}

async function mudarCorFundoConfirmacao(cor) {
  if (!eventoAtual) return;
  const ok = await _salvarCampoEventoCV('confirmar_bg', cor);
  if (ok) { _carregarPersonalizacao(); toast('Cor de fundo salva ✓'); }
}

async function resetCorFundoConfirmacao() {
  if (!eventoAtual) return;
  const ok = await _salvarCampoEventoCV('confirmar_bg', null);
  if (ok) { _carregarPersonalizacao(); toast('Voltou ao padrão ✓'); }
}

/* ── Compartilhar o link ───────────────────────────────── */
function copiarLinkConfirmacao() {
  const link = linkConfirmacao();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link)
      .then(() => toast('Link copiado ✓'))
      .catch(() => _copiarFallback(link));
  } else {
    _copiarFallback(link);
  }
}
function _copiarFallback(link) {
  const inp = document.getElementById('cv-link');
  if (inp) { inp.value = link; inp.select(); try { document.execCommand('copy'); toast('Link copiado ✓'); } catch (e) { toast('Copie o link manualmente.', 'erro'); } }
}

function compartilharLinkConfirmacao() {
  const link = linkConfirmacao();
  const nome = (eventoAtual && eventoAtual.nomes) ? eventoAtual.nomes : 'nosso evento';
  const msg  = 'Olá! Por favor confirme sua presença em ' + nome + ': ' + link;
  if (navigator.share) {
    navigator.share({ title: 'Confirmação de presença', text: msg }).catch(() => {});
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
  }
}
