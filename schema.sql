-- ============================================================
-- schema.sql — Banco de dados Bruna Floral
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA PRINCIPAL: events
-- ============================================================
CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  status           TEXT NOT NULL DEFAULT 'novo'
                   CHECK (status IN ('novo','em_analise','orcamento_enviado','fechado','cancelado')),

  -- Dados gerais
  tipo_evento      TEXT NOT NULL DEFAULT 'casamento'
                   CHECK (tipo_evento IN ('casamento','aniversario','batizado','corporativo')),
  nomes            TEXT,
  origem           TEXT,
  local_evento     TEXT,
  data_evento      DATE,
  horario          TIME,
  num_convidados   INTEGER,
  cerimonial       TEXT,
  estilo           TEXT,
  paleta           TEXT,
  budget_cliente   TEXT,
  obs_geral        TEXT,
  notas_internas   TEXT,

  -- Específicos por tipo
  aniver_idade     INTEGER,
  mae_responsavel  TEXT,
  tema_corp        TEXT,

  -- Cerimônia
  mesmo_end        TEXT,
  ambientes        TEXT,
  loc_cadeiras     TEXT,
  flores_caminho   TEXT,
  altar_estilo     TEXT,
  altar_estrutura  TEXT,
  welcome          TEXT,
  obs_cerimonia    TEXT,

  -- Convidados
  loc_mesas        TEXT,
  mesa_posta       TEXT,
  arranjo_conv     TEXT,
  mesa_familia     TEXT,
  arranjo_familia  TEXT,
  obs_conv         TEXT,

  -- Bolo e doces
  bolo_junto       TEXT,
  bolo_tam         TEXT,
  qtd_doces        INTEGER,
  lembranca        TEXT,
  lembranca_area   TEXT,
  obs_doces        TEXT,

  -- Buffet
  buffet_tipo      TEXT,
  buffet_mesas     TEXT,
  bar              TEXT,
  obs_buffet       TEXT,

  -- Demais áreas
  lounge           TEXT,
  banda            TEXT,
  iluminacao       TEXT,
  cenario          TEXT,
  buque            TEXT,
  obs_extras       TEXT
);

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Índices
CREATE INDEX idx_events_status      ON events (status);
CREATE INDEX idx_events_tipo        ON events (tipo_evento);
CREATE INDEX idx_events_data        ON events (data_evento);
CREATE INDEX idx_events_created_at  ON events (created_at DESC);

-- ============================================================
-- TABELA: budget_items (itens do orçamento de venda)
-- ============================================================
CREATE TABLE budget_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  secao       TEXT NOT NULL CHECK (secao IN ('cerimonia','recepcao','outros')),
  descricao   TEXT NOT NULL DEFAULT '',
  qtd         NUMERIC(10,2) NOT NULL DEFAULT 1,
  valor_venda NUMERIC(12,2) NOT NULL DEFAULT 0,
  ordem       INTEGER DEFAULT 0
);

CREATE INDEX idx_budget_items_event ON budget_items (event_id);

-- ============================================================
-- TABELA: internal_costs (controle interno de custos)
-- ============================================================
CREATE TABLE internal_costs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo       TEXT NOT NULL CHECK (tipo IN ('flores','mobilia','equipe')),
  nome       TEXT NOT NULL DEFAULT '',
  funcao     TEXT,
  valor      NUMERIC(12,2) NOT NULL DEFAULT 0,
  ordem      INTEGER DEFAULT 0
);

CREATE INDEX idx_internal_costs_event ON internal_costs (event_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_costs ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa (anônima) pode INSERIR eventos (formulário público)
CREATE POLICY "anon_insert_events"
  ON events FOR INSERT
  TO anon
  WITH CHECK (true);

-- Somente usuário autenticado (Bruna) pode ver e editar tudo
CREATE POLICY "auth_all_events"
  ON events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_all_budget"
  ON budget_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_all_internal"
  ON internal_costs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
