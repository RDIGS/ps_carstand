import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';
import { FINANCE_CATEGORIAS } from '../finance-categorias';
import { METODOS_PAGAMENTO } from '../../common/constants/metodos-pagamento';

export class CreateFinanceEntryDto {
  @IsIn(['receita', 'despesa'])
  tipo!: 'receita' | 'despesa';

  @IsOptional()
  @IsIn(FINANCE_CATEGORIAS)
  categoria?: string;

  @IsNumber()
  @IsPositive()
  valor!: number;

  @IsOptional()
  @IsString()
  descricao?: string;

  // Opcional: permite lançar algo com data retroativa (ex.: "esta despesa
  // foi paga a semana passada, só agora tive tempo de a registar"). Sem
  // isto, ficava sempre preso à data em que foi introduzida na app.
  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  @IsIn(METODOS_PAGAMENTO)
  metodoPagamento?: string;

  // `null`/omitido = pago diretamente pela empresa. Preenchido = um
  // colaborador pagou do próprio bolso e precisa de ser reembolsado.
  @IsOptional()
  @IsUUID()
  pagoPor?: string;

  // Gerador do lançamento seguinte todos os meses (FinanceRecurringCron) —
  // pedido do utilizador para não ter de repetir despesas fixas (ex.: renda).
  @IsOptional()
  @IsBoolean()
  recorrente?: boolean;

  // Dados fiscais do comprovativo — pré-preenchidos pela leitura automática
  // da fatura (POST /finance/extract-invoice), mas sempre editáveis à mão.
  @IsOptional()
  @IsString()
  fornecedorNome?: string;

  @IsOptional()
  @IsString()
  fornecedorNif?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorIva?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaIva?: number;
}
