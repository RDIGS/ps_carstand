export interface DuaExtractedFields {
  matricula: string | null;
  marca: string | null;
  modelo: string | null;
  versao: string | null;
  data_primeira_matricula: string | null;
  chassis: string | null;
  categoria: string | null;
  combustivel: string | null;
  cilindrada: number | null;
  potencia_kw: number | null;
  peso_tara: number | null;
  peso_bruto: number | null;
  cor: string | null;
  num_lugares: number | null;
  importado: boolean;
  matricula_anterior: string | null;
  pais_origem_anterior: string | null;
  data_primeira_matricula_original: string | null;
}

export interface DuaExtractionResult {
  extracted: DuaExtractedFields;
  confianca: Record<string, number>;
  avisos: string[];
  possivel_importado: boolean;
}
