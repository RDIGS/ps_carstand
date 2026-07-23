// Mesmo mecanismo do DUA (ver dua-response-schema.ts): um responseSchema
// obriga a API do Gemini à forma exata, incluindo as chaves de "confianca"
// fixas aos nomes dos campos.
export const CAMPOS_COM_CONFIANCA = [
  'nome_completo',
  'numero_documento',
  'nif',
  'data_nascimento',
  'data_validade',
  'nacionalidade',
  'morada',
  'tipo_titulo_residencia',
] as const;

const confiancaProperties = Object.fromEntries(
  CAMPOS_COM_CONFIANCA.map((campo) => [campo, { type: 'NUMBER' }]),
);

export const IDENTITY_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    erro: { type: 'STRING', nullable: true, enum: ['documento_nao_reconhecido'] },
    tipo_documento: { type: 'STRING', nullable: true, enum: ['cc', 'titulo_residencia'] },
    nome_completo: { type: 'STRING', nullable: true },
    numero_documento: { type: 'STRING', nullable: true },
    nif: { type: 'STRING', nullable: true },
    data_nascimento: { type: 'STRING', nullable: true },
    data_validade: { type: 'STRING', nullable: true },
    nacionalidade: { type: 'STRING', nullable: true },
    morada: { type: 'STRING', nullable: true },
    tipo_titulo_residencia: { type: 'STRING', nullable: true },
    confianca: {
      type: 'OBJECT',
      properties: confiancaProperties,
      required: [...CAMPOS_COM_CONFIANCA],
    },
    avisos: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['erro', 'tipo_documento', 'confianca', 'avisos'],
};
