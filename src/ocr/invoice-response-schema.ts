// Mesmo mecanismo do DUA/identidade (ver dua-response-schema.ts) — um
// responseSchema obriga a API do Gemini à forma exata, incluindo as chaves
// de "confianca" fixas aos nomes dos campos.
export const CAMPOS_COM_CONFIANCA = [
  'fornecedor_nome',
  'fornecedor_nif',
  'data',
  'valor_total',
  'valor_iva',
  'taxa_iva',
] as const;

const confiancaProperties = Object.fromEntries(
  CAMPOS_COM_CONFIANCA.map((campo) => [campo, { type: 'NUMBER' }]),
);

export const INVOICE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    erro: { type: 'STRING', nullable: true, enum: ['documento_nao_reconhecido'] },
    fornecedor_nome: { type: 'STRING', nullable: true },
    fornecedor_nif: { type: 'STRING', nullable: true },
    data: { type: 'STRING', nullable: true },
    valor_total: { type: 'NUMBER', nullable: true },
    valor_iva: { type: 'NUMBER', nullable: true },
    taxa_iva: { type: 'NUMBER', nullable: true },
    descricao: { type: 'STRING', nullable: true },
    confianca: {
      type: 'OBJECT',
      properties: confiancaProperties,
      required: [...CAMPOS_COM_CONFIANCA],
    },
    avisos: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['erro', 'confianca', 'avisos'],
};
