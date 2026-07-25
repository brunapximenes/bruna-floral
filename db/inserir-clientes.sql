-- ============================================================
-- inserir-clientes.sql
-- 1. Adiciona a coluna que vincula cada evento ao seu orçamento
-- 2. Insere os 4 clientes que já têm orçamento pronto
-- Rodar UMA vez no Supabase → SQL Editor
-- ============================================================

-- 1. Coluna do link do orçamento (segura de rodar mais de uma vez)
ALTER TABLE events ADD COLUMN IF NOT EXISTS orcamento_slug text;

-- 2. Clientes
INSERT INTO events
  (tipo_evento, status, nomes, origem, cerimonial, local_evento, data_evento, horario, num_convidados, estilo, paleta, budget_cliente, ambientes, orcamento_slug)
VALUES
  ('casamento', 'orcamento_enviado', 'Aline e Mateus', NULL,
   'Cativily — Juliana Salazar', 'Quintas das Águas', '2027-11-13', '14:00', 150,
   'Moderno, sofisticado, levemente romântico — desconstruído',
   'Roxo empoeirado · salmão suave', 'R$ 25.000',
   'Cerimônia e recepção separados', 'aline-mateus'),

  ('casamento', 'orcamento_enviado', 'Ana Laura e Luís', 'Belo Horizonte, MG',
   'Agnus — Dani Nunes', 'Cerimônia: Capela São Benedito — Tamandaré · Recepção: Casa dos Lobos — Tamandaré',
   '2026-10-10', '15:30', 60,
   'Minimalista rústico · luzes e folhagens',
   'Azul e branco (cerimônia) · tons terrosos (recepção)', NULL,
   NULL, 'ana-laura-luis'),

  ('casamento', 'orcamento_enviado', 'Pedro e Sabrina', NULL,
   'Divino Cerimonial', 'Quintas das Águas — Camaragibe', '2026-09-24', '15:00', 125,
   'Clássico', 'Branco, verde e rosa chá', NULL,
   NULL, 'pedro-sabrina'),

  ('casamento', 'orcamento_enviado', 'Cynthia e Josuelligton', NULL,
   'Manu Sumara', 'Portal do Beija Flor, Recife', '2027-01-30', '14:30', 100,
   'Colorido minimalista com frutas e velas',
   'Laranja, verde, lilás, rosa, amarelo', 'R$ 10.000 a R$ 12.000',
   NULL, 'cynthia-josuelligton');
