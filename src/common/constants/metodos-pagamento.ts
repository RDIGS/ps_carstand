// Lista fixa partilhada entre despesas gerais (finance_entries) e despesas
// de veículo (vehicle_expenses) — mesmo padrão de FINANCE_CATEGORIAS
// (lista fechada em vez de texto livre, para agregações fiáveis).
export const METODOS_PAGAMENTO = ['numerario', 'transferencia', 'multibanco', 'cartao', 'cheque', 'outro'] as const;

export type MetodoPagamento = (typeof METODOS_PAGAMENTO)[number];
