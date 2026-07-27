// Lista fixa (antes era texto livre) — o dono do stand escrevia "Renda",
// "renda", "Aluguer" e cada variante virava uma categoria diferente nos
// relatórios, impossibilitando agregações fiáveis por categoria. Mesmo
// padrão já usado em `vehicle_expenses.categoria` (create-expense.dto.ts).
export const FINANCE_CATEGORIAS = [
  'renda',
  'salarios',
  'marketing',
  'servicos_terceiros',
  'impostos_taxas',
  'seguros',
  'manutencao_instalacoes',
  'comissoes_recebidas',
  'financiamento',
  'outro',
] as const;

export type FinanceCategoria = (typeof FINANCE_CATEGORIAS)[number];
