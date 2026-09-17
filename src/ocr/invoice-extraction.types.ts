export interface InvoiceLineItem {
  descricao: string;
  valor: number;
}

export interface InvoiceExtractedFields {
  fornecedor_nome: string | null;
  fornecedor_nif: string | null;
  data: string | null; // YYYY-MM-DD
  valor_total: number | null; // valor final pago, já com IVA incluído
  valor_iva: number | null;
  taxa_iva: number | null; // percentagem (23, 13, 6 ou 0) — null se a fatura tiver taxas mistas
  descricao: string | null; // resumo curto do que foi comprado/serviço prestado
  // Divisão da fatura em linhas/serviços distintos (secção nova, 2026-09-17,
  // "fatura para várias despesas") — quando não é possível distinguir linhas
  // com confiança, vem sempre com 1 item só (repete descricao/valor_total),
  // nunca vazio. O frontend decide o fluxo (1 despesa vs. ecrã de divisão)
  // consoante o comprimento desta lista, não há um campo "erro" à parte para isso.
  itens: InvoiceLineItem[];
}

export interface InvoiceExtractionResult {
  extracted: InvoiceExtractedFields;
  confianca: Record<string, number>;
  avisos: string[];
}
