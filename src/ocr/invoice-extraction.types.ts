export interface InvoiceExtractedFields {
  fornecedor_nome: string | null;
  fornecedor_nif: string | null;
  data: string | null; // YYYY-MM-DD
  valor_total: number | null; // valor final pago, já com IVA incluído
  valor_iva: number | null;
  taxa_iva: number | null; // percentagem (23, 13, 6 ou 0) — null se a fatura tiver taxas mistas
  descricao: string | null; // resumo curto do que foi comprado/serviço prestado
}

export interface InvoiceExtractionResult {
  extracted: InvoiceExtractedFields;
  confianca: Record<string, number>;
  avisos: string[];
}
