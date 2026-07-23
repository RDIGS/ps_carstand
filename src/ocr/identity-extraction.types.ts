export type TipoDocumentoIdentificacao = 'cc' | 'titulo_residencia';

export interface IdentityExtractedFields {
  tipo_documento: TipoDocumentoIdentificacao | null;
  nome_completo: string | null;
  numero_documento: string | null;
  nif: string | null;
  data_nascimento: string | null;
  data_validade: string | null;
  nacionalidade: string | null;
  // Só costuma existir em alguns formatos de Título de Residência (mais
  // antigos, emitidos pelo extinto SEF) — o CC nunca imprime morada.
  morada: string | null;
  // Só para tipo_documento = 'titulo_residencia' (ex.: "PERMANENTE", "TEMPORÁRIA").
  tipo_titulo_residencia: string | null;
}

export interface IdentityExtractionResult {
  extracted: IdentityExtractedFields;
  confianca: Record<string, number>;
  avisos: string[];
}
