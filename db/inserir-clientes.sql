-- ============================================================
-- inserir-clientes.sql  (REFERÊNCIA / HISTÓRICO)
--
-- Os 4 clientes abaixo já foram inseridos automaticamente via API
-- REST do Supabase em jul/2026 — não precisa rodar este arquivo.
--
-- O vínculo de cada cliente com seu orçamento editável NÃO usa coluna
-- no banco: fica no mapa ORCAMENTOS dentro de js/painel-evento.js
-- (nome do cliente → arquivo em /orcamentos). Para vincular um novo
-- orçamento, adicione uma linha nesse mapa.
--
-- Guardado aqui só como referência caso precise reinserir manualmente.
-- ============================================================

INSERT INTO events
  (tipo_evento, status, nomes, origem, cerimonial, local_evento, data_evento, horario, num_convidados, estilo, paleta, budget_cliente, ambientes)
VALUES
  ('casamento', 'orcamento_enviado', 'Aline e Mateus', NULL,
   'Cativily — Juliana Salazar', 'Quintas das Águas', '2027-11-13', '14:00', 150,
   'Moderno, sofisticado, levemente romântico — desconstruído',
   'Roxo empoeirado · salmão suave', 'R$ 25.000',
   'Cerimônia e recepção separados'),

  ('casamento', 'orcamento_enviado', 'Ana Laura e Luís', 'Belo Horizonte, MG',
   'Agnus — Dani Nunes', 'Cerimônia: Capela São Benedito — Tamandaré · Recepção: Casa dos Lobos — Tamandaré',
   '2026-10-10', '15:30', 60,
   'Minimalista rústico · luzes e folhagens',
   'Azul e branco (cerimônia) · tons terrosos (recepção)', NULL, NULL),

  ('casamento', 'orcamento_enviado', 'Pedro e Sabrina', NULL,
   'Divino Cerimonial', 'Quintas das Águas — Camaragibe', '2026-09-24', '15:00', 125,
   'Clássico', 'Branco, verde e rosa chá', NULL, NULL),

  ('casamento', 'orcamento_enviado', 'Cynthia e Josuelligton', NULL,
   'Manu Sumara', 'Portal do Beija Flor, Recife', '2027-01-30', '14:30', 100,
   'Colorido minimalista com frutas e velas',
   'Laranja, verde, lilás, rosa, amarelo', 'R$ 10.000 a R$ 12.000', NULL);
