-- Schema aplicado a CADA stand (schema_<uuid>), conforme secção 12.2 da
-- arquitetura. É executado pelo StandsService::provisionSchema logo após
-- `CREATE SCHEMA` + `SET search_path`, por isso as tabelas aqui não levam
-- qualificação de schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT NOT NULL,
  marca TEXT NOT NULL,
  modelo TEXT NOT NULL,
  versao TEXT,
  data_primeira_matricula DATE,
  chassis TEXT,
  categoria TEXT,
  combustivel TEXT,
  cilindrada INTEGER,
  potencia_kw INTEGER,
  peso_tara INTEGER,
  peso_bruto INTEGER,
  cor TEXT,
  num_lugares INTEGER,
  kms INTEGER NOT NULL,
  preco_compra NUMERIC(10,2),
  preco_venda_recomendado NUMERIC(10,2),
  preco_venda_final NUMERIC(10,2),
  estado TEXT NOT NULL DEFAULT 'disponivel'
        CHECK (estado IN ('pendente_aprovacao','disponivel','reservado','vendido','rejeitado')),
  origem TEXT CHECK (origem IN ('manual','dua_ocr')),
  possivel_importado BOOLEAN DEFAULT FALSE,
  importado BOOLEAN DEFAULT FALSE,
  matricula_anterior TEXT,
  pais_origem_anterior TEXT,
  data_primeira_matricula_original DATE,
  criado_por UUID NOT NULL,
  aprovado_por UUID,
  data_entrada_stock DATE DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicles_estado ON vehicles(estado);
CREATE INDEX idx_vehicles_matricula ON vehicles(matricula);

CREATE TABLE vehicle_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('dua_frente','dua_verso','foto_viatura')),
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicle_photos_vehicle ON vehicle_photos(vehicle_id);

CREATE TABLE vehicle_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  categoria TEXT CHECK (categoria IN ('reparacao','transporte','legalizacao','limpeza_detalhe','outro')),
  descricao TEXT,
  valor NUMERIC(10,2) NOT NULL,
  data DATE DEFAULT CURRENT_DATE,
  criado_por UUID NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicle_expenses_vehicle ON vehicle_expenses(vehicle_id);

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id),
  comprador_nome TEXT NOT NULL,
  comprador_nif TEXT NOT NULL,
  comprador_morada TEXT,
  comprador_cp TEXT,
  comprador_identificacao_tipo TEXT CHECK (comprador_identificacao_tipo IN ('bi','cc','titulo_residencia','outro')),
  comprador_identificacao_numero TEXT,
  preco_final NUMERIC(10,2) NOT NULL,
  vendedor_id UUID NOT NULL,
  comissao_vendedor NUMERIC(10,2),
  data_venda DATE DEFAULT CURRENT_DATE,
  doc_registo_compra_url TEXT,
  doc_responsabilidade_url TEXT,
  -- Digitalização do documento de identificação do comprador (secção 23) —
  -- só preenchido se o utilizador confirmar que as fotos já estavam
  -- cortadas/prontas; caso contrário as fotos são só transitórias (usadas
  -- para o OCR) e nunca chegam a ser guardadas aqui.
  identificacao_frente_url TEXT,
  identificacao_verso_url TEXT,
  identificacao_documento_combinado_url TEXT,
  estado TEXT DEFAULT 'concluida' CHECK (estado IN ('concluida','revertida')),
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_vehicle ON sales(vehicle_id);
CREATE INDEX idx_sales_vendedor ON sales(vendedor_id);

CREATE TABLE finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT CHECK (tipo IN ('receita','despesa')),
  categoria TEXT,
  valor NUMERIC(10,2) NOT NULL,
  descricao TEXT,
  data DATE DEFAULT CURRENT_DATE,
  criado_por UUID NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE market_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  fonte TEXT CHECK (fonte IN ('standvirtual','olx','custojusto')),
  preco_medio NUMERIC(10,2),
  preco_min NUMERIC(10,2),
  preco_max NUMERIC(10,2),
  num_anuncios_comparados INTEGER,
  consultado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_market_estimates_vehicle ON market_estimates(vehicle_id);

-- Checklist de veículo (secção 25): o owner cria modelos reutilizáveis
-- (checklist_templates + itens) e aplica-os a um veículo — aplicar faz uma
-- CÓPIA para vehicle_checklist_items, nunca uma referência viva, para editar
-- o template depois não alterar retroativamente veículos já em preparação.
CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  criado_por UUID NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  ordem INTEGER DEFAULT 0
);

CREATE INDEX idx_checklist_template_items_template ON checklist_template_items(checklist_template_id);

CREATE TABLE vehicle_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  concluido BOOLEAN DEFAULT FALSE,
  concluido_por UUID,
  concluido_em TIMESTAMPTZ,
  ordem INTEGER DEFAULT 0,
  origem_template_id UUID
);

CREATE INDEX idx_vehicle_checklist_items_vehicle ON vehicle_checklist_items(vehicle_id);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  acao TEXT NOT NULL,
  valor_anterior JSONB,
  valor_novo JSONB,
  feito_por UUID NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_entidade ON audit_log(entidade, entidade_id);
