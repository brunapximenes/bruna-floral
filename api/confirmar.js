/* ============================================================
   api/confirmar.js — Serve a página de confirmação (RSVP).

   O link é curto: /c/<codigo>  (ou, legado, /confirmar?e=<id>).
   O servidor busca no banco (função get_confirmacao_code / get_confirmacao,
   lidas com a chave pública anon) os dados do evento e monta:
   - <title>/og:title/og:image dinâmicos (o WhatsApp lê sem rodar JS);
   - cores de fundo/texto/botões e a foto do convite;
   - injeta o id do evento (window.CF) para o formulário salvar a confirmação.

   Se não conseguir ler o HTML, redireciona para o arquivo estático,
   para o convidado nunca ficar sem a página.
   ============================================================ */

const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Valores públicos (os mesmos do front — a anon key não é segredo)
const SB_URL  = 'https://jimkkxlrrsjdylrccnpb.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbWtreGxycnNqZHlscmNjbnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDgzNjAsImV4cCI6MjA5NjE4NDM2MH0.Vjhy8qQlYfQMG7gvaxIVrvsrMhRcRaMV2eMQDvZCyg0';

const TIPO_TXT = {
  casamento: 'o casamento', noivado: 'o noivado', aniversario: 'o aniversário',
  batizado: 'o batizado', corporativo: 'o evento'
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// Escapa para usar com segurança dentro de aspas de uma string JS
function escJs(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/\r?\n/g, ' ');
}

function fmtDataBR(str) {
  if (!str) return '';
  const d = new Date(String(str).slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// __dirname garante que o rastreador do Vercel inclua o arquivo no deploy
const HTML_PATH = path.join(__dirname, '..', 'confirmar.html');

// Só aceita cor em formato seguro (#hex). Evita injeção no <style>.
function corSegura(c) {
  c = (c || '').toString().trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '';
}

// Só aceita imagem do próprio Storage do projeto (evita injetar URL externa).
function imgSegura(u) {
  u = (u || '').toString().trim();
  return u.indexOf(SB_URL + '/storage/') === 0 ? u : '';
}

// Busca os dados do evento pela função do banco (por código curto ou por id).
async function buscarEvento(code, eventId) {
  try {
    const sb = createClient(SB_URL, SB_ANON);
    let r;
    if (code) r = await sb.rpc('get_confirmacao_code', { p_code: code });
    else if (eventId) r = await sb.rpc('get_confirmacao', { p_event: eventId });
    else return {};
    if (r.error || !r.data || !r.data.length) return {};
    return r.data[0];
  } catch (e) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  const q = (req.query) || {};
  const code    = (q.c || '').toString().trim();
  let   eventId = (q.e || '').toString().trim();

  let html;
  try {
    html = fs.readFileSync(HTML_PATH, 'utf8');
  } catch (e) {
    const qs = req.url && req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
    res.setHeader('Location', '/confirmar.html' + qs);
    res.statusCode = 302;
    res.end();
    return;
  }

  // Dados do evento vêm do banco; parâmetros do link servem de reserva
  // (mantém os links antigos, longos, ainda funcionando).
  const ev = await buscarEvento(code, eventId);
  if (ev.id) eventId = ev.id;

  const nome = (ev.nomes || q.n || '').toString().trim();
  const tipo = (ev.tipo_evento || q.t || '').toString().trim();
  const data = (ev.data_evento || q.d || '').toString().trim();

  const img = imgSegura(ev.confirmar_img) || imgSegura(q.img);
  const bg  = corSegura(ev.confirmar_bg)        || corSegura(q.bg);
  const txt = corSegura(ev.confirmar_cor_texto) || corSegura(q.txt);
  const btn = corSegura(ev.confirmar_cor_botao) || corSegura(q.btn);

  const titulo = nome ? ('Confirmação de presença — ' + nome) : 'Confirmação de presença';
  let desc = 'Confirme sua presença';
  const partes = [];
  if (tipo && TIPO_TXT[tipo]) partes.push('em ' + TIPO_TXT[tipo]);
  const dataFmt = fmtDataBR(data);
  if (dataFmt) partes.push(dataFmt);
  if (partes.length) desc = 'Confirme sua presença ' + partes.join(' · ');

  let head =
      '<title>' + esc(titulo) + '</title>\n'
    + '<meta property="og:title" content="' + esc(titulo) + '">\n'
    + '<meta property="og:description" content="' + esc(desc) + '">\n'
    + '<meta property="og:type" content="website">\n'
    + '<meta property="og:site_name" content="Bruna Ximenes">\n'
    + '<meta name="description" content="' + esc(desc) + '">';
  if (img) head += '\n<meta property="og:image" content="' + esc(img) + '">';

  // Estilo de personalização (fundo + cores do texto e dos botões).
  // !important vence o :root padrão do confirmar.html (que vem depois).
  let regras = '';
  if (bg)  regras += 'body{background:' + bg + ' !important;}';
  if (txt) regras += ':root{--cf-accent:' + txt + ' !important;}';
  if (btn) regras += ':root{--cf-btn:' + btn + ' !important;}';
  if (regras) head += '\n<style>' + regras + '</style>';

  // Dados que o formulário precisa (id do evento para salvar, e textos do cabeçalho)
  head += '\n<script>window.CF={id:"' + escJs(eventId) + '",nome:"' + escJs(nome)
        + '",tipo:"' + escJs(tipo) + '",data:"' + escJs(data) + '"};</script>';

  html = html.replace(/<title>[\s\S]*?<\/title>/, head);

  if (img) {
    html = html.replace('<!--CF-CONVITE-->',
      '<img class="cf-convite" src="' + esc(img) + '" alt="Convite">');
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.statusCode = 200;
  res.end(html);
};
