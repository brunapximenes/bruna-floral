/* ============================================================
   api/confirmar.js — Serve a página de confirmação (RSVP) com
   título e meta tags (Open Graph) DINÂMICOS, baseados no evento.

   Por quê: o WhatsApp/Facebook monta o preview do link lendo o HTML
   SEM rodar JavaScript. Então o nome do evento precisa já vir no
   <title>/og:title pelo servidor — não dá pra fazer só no front.

   A rota /confirmar aponta para cá (ver vercel.json). Se por algum
   motivo não conseguir ler o HTML, redireciona para o arquivo
   estático, para o convidado nunca ficar sem a página.
   ============================================================ */

const fs   = require('fs');
const path = require('path');

const TIPO_TXT = {
  casamento: 'o casamento', noivado: 'o noivado', aniversario: 'o aniversário',
  batizado: 'o batizado', corporativo: 'o evento'
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDataBR(str) {
  if (!str) return '';
  const d = new Date(str + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// __dirname garante que o rastreador do Vercel inclua o arquivo no deploy
const HTML_PATH = path.join(__dirname, '..', 'confirmar.html');

module.exports = function handler(req, res) {
  const q = (req.query) || {};
  const nome = (q.n || '').toString().trim();
  const tipo = (q.t || '').toString().trim();
  const data = (q.d || '').toString().trim();

  const titulo = nome ? ('Confirmação de presença — ' + nome) : 'Confirmação de presença';

  let desc = 'Confirme sua presença';
  const partes = [];
  if (tipo && TIPO_TXT[tipo]) partes.push('em ' + TIPO_TXT[tipo]);
  const dataFmt = fmtDataBR(data);
  if (dataFmt) partes.push(dataFmt);
  if (partes.length) desc = 'Confirme sua presença ' + partes.join(' · ');

  let html;
  try {
    html = fs.readFileSync(HTML_PATH, 'utf8');
  } catch (e) {
    // Fallback: manda para o arquivo estático preservando os parâmetros
    const qs = req.url && req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
    res.setHeader('Location', '/confirmar.html' + qs);
    res.statusCode = 302;
    res.end();
    return;
  }

  const head =
      '<title>' + esc(titulo) + '</title>\n'
    + '<meta property="og:title" content="' + esc(titulo) + '">\n'
    + '<meta property="og:description" content="' + esc(desc) + '">\n'
    + '<meta property="og:type" content="website">\n'
    + '<meta property="og:site_name" content="Bruna Floral">\n'
    + '<meta name="description" content="' + esc(desc) + '">';

  // Troca o <title> estático pelo bloco dinâmico
  html = html.replace(/<title>[\s\S]*?<\/title>/, head);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Preview pode ficar em cache; evita cache longo para refletir mudanças
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.statusCode = 200;
  res.end(html);
};
