/* ============================================================
   gerar-pdf.js — Geração de PDF do orçamento via jsPDF + html2canvas
   ============================================================ */

async function gerarPDF() {
  if (!eventoAtual) return;

  const btn = document.querySelector('[onclick="gerarPDF()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Gerando PDF...'; }

  try {
    // Monta HTML do template
    const html = montarTemplatePDF();
    const template = document.getElementById('pdf-template');
    template.innerHTML = html;
    template.style.left = '-9999px';
    template.style.display = 'block';

    // Aguarda imagens carregarem
    await new Promise(r => setTimeout(r, 400));

    const canvas = await html2canvas(template, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const ratio  = canvas.height / canvas.width;
    const imgW   = pageW;
    const imgH   = imgW * ratio;

    // Adiciona páginas se o conteúdo for maior que A4
    let posY = 0;
    while (posY < imgH) {
      if (posY > 0) doc.addPage();
      doc.addImage(imgData, 'PNG', 0, -posY, imgW, imgH, undefined, 'FAST');
      posY += pageH;
    }

    const nomeArq = `orcamento-${(eventoAtual.nomes || 'evento').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}.pdf`;
    doc.save(nomeArq);
    template.style.display = 'none';
    toast('PDF gerado com sucesso! ✓');
  } catch (err) {
    console.error(err);
    toast('Erro ao gerar PDF. Tente novamente.', 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '📄 Gerar PDF do orçamento'; }
  }
}

function montarTemplatePDF() {
  const d     = eventoAtual;
  const tipo  = TIPO_LABELS[d.tipo_evento] || d.tipo_evento;
  const venda = calcVenda();
  const c     = CFG_TIPO[d.tipo_evento] || CFG_TIPO.casamento;

  // Monta linhas de itens por seção
  function linhasSecao(sec, titulo) {
    const items = budgetItems[sec] || [];
    const visíveis = items.filter(i => i.descricao);
    if (!visíveis.length) return '';
    const linhas = visíveis.map(i => {
      const subtotal = (parseFloat(i.valor_venda) || 0) * (parseFloat(i.qtd) || 1);
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0ede8">${i.descricao}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0ede8;text-align:center">${i.qtd}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0ede8;text-align:right">${fmt(subtotal)}</td>
      </tr>`;
    }).join('');
    return `
      <tr><td colspan="3" style="padding:14px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b8f72;font-weight:500">${titulo}</td></tr>
      ${linhas}`;
  }

  const tabelaCerimonia   = c.cerimonia ? linhasSecao('cerimonia', 'Floral da cerimônia') : '';
  const tabelaRecepcao    = linhasSecao('recepcao', 'Floral da recepção');
  const tabelaOperacional = linhasSecao('operacional', 'Operacional');
  const tabelaLocacoes    = linhasSecao('locacoes', 'Locações extras');
  const tabelaExtras      = linhasSecao('extras', 'Extras');
  const temItens = tabelaCerimonia || tabelaRecepcao || tabelaOperacional || tabelaLocacoes || tabelaExtras;

  const dataGeracao = new Date().toLocaleDateString('pt-BR');
  const validade    = new Date(Date.now() + 15 * 86400000).toLocaleDateString('pt-BR');

  return `
  <div style="font-family:'Jost',Arial,sans-serif;font-size:13px;color:#2a2a2a;background:#fff;width:794px;padding:48px 56px">

    <!-- Cabeçalho -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:24px;border-bottom:2px solid #3d5a47">
      <div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;font-weight:400;color:#3d5a47;letter-spacing:.01em">Bruna Floral</div>
        <div style="font-size:12px;color:#6b6b6b;letter-spacing:.08em;text-transform:uppercase;margin-top:4px">Decoração Floral</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:500;color:#3d5a47;margin-bottom:4px">Proposta de Decoração</div>
        <div style="font-size:12px;color:#6b6b6b">Emitida em ${dataGeracao}</div>
        <div style="font-size:12px;color:#6b6b6b">Válida até ${validade}</div>
      </div>
    </div>

    <!-- Dados do evento -->
    <div style="background:#faf7f2;border-radius:8px;padding:20px 24px;margin-bottom:28px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#6b6b6b;margin-bottom:14px;font-weight:500">Dados do evento</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><span style="color:#6b6b6b">Tipo:</span> <strong>${tipo}</strong></div>
        <div><span style="color:#6b6b6b">${c.nomes}:</span> <strong>${d.nomes || '—'}</strong></div>
        ${d.data_evento ? `<div><span style="color:#6b6b6b">Data:</span> <strong>${fmtData(d.data_evento)}</strong></div>` : ''}
        ${d.horario     ? `<div><span style="color:#6b6b6b">Horário:</span> <strong>${d.horario}</strong></div>` : ''}
        ${d.local_evento ? `<div style="grid-column:1/-1"><span style="color:#6b6b6b">Local:</span> <strong>${d.local_evento}</strong></div>` : ''}
        ${d.num_convidados ? `<div><span style="color:#6b6b6b">Convidados:</span> <strong>${d.num_convidados}</strong></div>` : ''}
        ${d.estilo      ? `<div><span style="color:#6b6b6b">Estilo:</span> <strong>${d.estilo}</strong></div>` : ''}
        ${d.paleta      ? `<div style="grid-column:1/-1"><span style="color:#6b6b6b">Paleta:</span> <strong>${d.paleta}</strong></div>` : ''}
      </div>
    </div>

    <!-- Itens -->
    ${temItens ? `
    <div style="margin-bottom:28px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#6b6b6b;margin-bottom:8px;font-weight:500">Itens do orçamento</div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:2px solid #3d5a47">
            <th style="text-align:left;padding:8px 0;font-size:11px;color:#6b6b6b;text-transform:uppercase;letter-spacing:.05em">Descrição</th>
            <th style="text-align:center;padding:8px 0;font-size:11px;color:#6b6b6b;text-transform:uppercase;letter-spacing:.05em;width:60px">Qtd</th>
            <th style="text-align:right;padding:8px 0;font-size:11px;color:#6b6b6b;text-transform:uppercase;letter-spacing:.05em;width:100px">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${tabelaCerimonia}${tabelaRecepcao}${tabelaOperacional}${tabelaLocacoes}${tabelaExtras}
        </tbody>
      </table>
    </div>` : ''}

    <!-- Total -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:40px">
      <div style="background:#3d5a47;color:#fff;border-radius:8px;padding:16px 24px;min-width:220px;text-align:right">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-bottom:6px">Total da proposta</div>
        <div style="font-size:26px;font-weight:500;letter-spacing:.01em">${fmt(venda)}</div>
      </div>
    </div>

    <!-- Rodapé -->
    <div style="border-top:1px solid #ddd6cc;padding-top:20px;text-align:center;color:#6b6b6b;font-size:12px">
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:#3d5a47;margin-bottom:6px">Bruna Floral · Decoração Floral</div>
      <div>Esta proposta é válida por 15 dias a partir da data de emissão.</div>
      <div style="margin-top:4px">Dúvidas? Entre em contato pelo WhatsApp.</div>
    </div>

  </div>`;
}
