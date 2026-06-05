/* ============================================================
   api/export-sheets.js — Vercel Serverless Function
   Autentica com Google via Service Account e adiciona
   uma linha na planilha da Bruna.

   Variáveis de ambiente necessárias (configurar no Vercel):
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY   ← NÃO é a anon key, é a service role
   - GOOGLE_SERVICE_ACCOUNT      ← JSON completo da service account (string)
   - GOOGLE_SHEET_ID             ← ID da planilha (está na URL)
   ============================================================ */

const { createClient } = require('@supabase/supabase-js');
const { google }       = require('googleapis');

module.exports = async function handler(req, res) {
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar autenticação (Bearer token do Supabase)
  const auth  = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Não autorizado' });

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Verificar se o token pertence a um usuário válido
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido' });

  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ error: 'eventId obrigatório' });

  // Buscar dados do evento
  const { data: evento, error: evErr } = await sb
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
  if (evErr || !evento) return res.status(404).json({ error: 'Evento não encontrado' });

  // Buscar itens de orçamento
  const { data: budgetItems } = await sb
    .from('budget_items')
    .select('*')
    .eq('event_id', eventId)
    .order('secao').order('ordem');

  // Buscar itens internos
  const { data: internalCosts } = await sb
    .from('internal_costs')
    .select('*')
    .eq('event_id', eventId)
    .order('tipo').order('ordem');

  // Calcular totais
  const totalVenda = (budgetItems || []).reduce((acc, i) =>
    acc + (parseFloat(i.valor_venda) || 0) * (parseFloat(i.qtd) || 1), 0);
  const totalCusto = (internalCosts || []).reduce((acc, i) =>
    acc + (parseFloat(i.valor) || 0), 0);

  // Montar linha para o Sheets
  const linha = [
    new Date().toLocaleDateString('pt-BR'),         // Data de exportação
    evento.tipo_evento,
    evento.nomes || '',
    evento.local_evento || '',
    evento.data_evento || '',
    evento.num_convidados || '',
    evento.estilo || '',
    evento.paleta || '',
    evento.budget_cliente || '',
    evento.status,
    totalVenda.toFixed(2).replace('.', ','),
    totalCusto.toFixed(2).replace('.', ','),
    (totalVenda - totalCusto).toFixed(2).replace('.', ','),
    evento.obs_geral || '',
    `https://brunafloraldecoracoes.com.br/painel#${eventId}`,
  ];

  // Autenticar com Google
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  } catch {
    return res.status(500).json({ error: 'Configuração do Google inválida' });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets   = google.sheets({ version: 'v4', auth });
  const sheetId  = process.env.GOOGLE_SHEET_ID;

  // Verificar se cabeçalho existe, se não, criar
  try {
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Eventos!A1:A1',
    });
    if (!header.data.values || !header.data.values.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Eventos!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            'Data exportação', 'Tipo', 'Nome(s)', 'Local', 'Data evento',
            'Convidados', 'Estilo', 'Paleta', 'Budget cliente', 'Status',
            'Total venda R$', 'Total custo R$', 'Lucro R$', 'Obs. gerais', 'Link'
          ]]
        }
      });
    }
  } catch { /* ignora erro no cabeçalho */ }

  // Adicionar linha
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Eventos!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [linha] }
  });

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  return res.status(200).json({ success: true, sheetUrl });
};
