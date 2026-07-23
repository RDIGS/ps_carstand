// Schema estrutural enviado à API do Gemini (generationConfig.responseSchema)
// — testado contra a API real (v1beta) e confirmado a devolver exatamente
// esta forma. Substitui a confiança cega na instrução em texto do prompt:
// aqui é a própria API que obriga as chaves de "confianca" a coincidirem
// com os nomes dos campos, em vez de depender do modelo "se lembrar".
export const CAMPOS_COM_CONFIANCA = [
  'matricula',
  'marca',
  'modelo',
  'versao',
  'data_primeira_matricula',
  'chassis',
  'categoria',
  'combustivel',
  'cilindrada',
  'potencia_kw',
  'peso_tara',
  'peso_bruto',
  'cor',
  'num_lugares',
  'matricula_anterior',
  'pais_origem_anterior',
  'data_primeira_matricula_original',
] as const;

const confiancaProperties = Object.fromEntries(
  CAMPOS_COM_CONFIANCA.map((campo) => [campo, { type: 'NUMBER' }]),
);

export const DUA_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    erro: { type: 'STRING', nullable: true, enum: ['documento_nao_reconhecido'] },
    matricula: { type: 'STRING', nullable: true },
    marca: { type: 'STRING', nullable: true },
    modelo: { type: 'STRING', nullable: true },
    versao: { type: 'STRING', nullable: true },
    data_primeira_matricula: { type: 'STRING', nullable: true },
    chassis: { type: 'STRING', nullable: true },
    categoria: { type: 'STRING', nullable: true },
    combustivel: { type: 'STRING', nullable: true },
    cilindrada: { type: 'NUMBER', nullable: true },
    potencia_kw: { type: 'NUMBER', nullable: true },
    peso_tara: { type: 'NUMBER', nullable: true },
    peso_bruto: { type: 'NUMBER', nullable: true },
    cor: { type: 'STRING', nullable: true },
    num_lugares: { type: 'NUMBER', nullable: true },
    importado: { type: 'BOOLEAN' },
    matricula_anterior: { type: 'STRING', nullable: true },
    pais_origem_anterior: { type: 'STRING', nullable: true },
    data_primeira_matricula_original: { type: 'STRING', nullable: true },
    confianca: {
      type: 'OBJECT',
      properties: confiancaProperties,
      required: [...CAMPOS_COM_CONFIANCA],
    },
    avisos: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['erro', 'importado', 'confianca', 'avisos'],
};
