import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';
import { METODOS_PAGAMENTO } from '../../common/constants/metodos-pagamento';

export class CreateExpenseDto {
  @IsIn(['reparacao', 'transporte', 'legalizacao', 'limpeza_detalhe', 'outro'])
  categoria!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber()
  @IsPositive()
  valor!: number;

  // Mesma razão de `data` em CreateFinanceEntryDto: permite lançar despesas
  // retroativas em vez de ficar sempre preso ao dia em que foram inseridas.
  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  @IsIn(METODOS_PAGAMENTO)
  metodoPagamento?: string;

  @IsOptional()
  @IsUUID()
  pagoPor?: string;

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

  // Contas a pagar — mesma razão de CreateFinanceEntryDto.
  @IsOptional()
  @IsBoolean()
  pago?: boolean;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;
}
