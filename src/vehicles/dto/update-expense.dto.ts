import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';
import { METODOS_PAGAMENTO } from '../../common/constants/metodos-pagamento';

export class UpdateExpenseDto {
  @IsOptional()
  @IsIn(['reparacao', 'transporte', 'legalizacao', 'limpeza_detalhe', 'outro'])
  categoria?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsDateString()
  data?: string;

  // `null` explícito = limpar o campo (o frontend manda-o sempre no
  // formulário de edição) — `@IsOptional()` ignora tanto `undefined` como
  // `null`.
  @IsOptional()
  @IsIn(METODOS_PAGAMENTO)
  metodoPagamento?: string | null;

  @IsOptional()
  @IsUUID()
  pagoPor?: string | null;

  @IsOptional()
  @IsBoolean()
  reembolsado?: boolean;

  // Mesma razão de `metodoPagamento` — `null` explícito limpa o campo.
  @IsOptional()
  @IsString()
  fornecedorNome?: string | null;

  @IsOptional()
  @IsString()
  fornecedorNif?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorIva?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaIva?: number | null;

  @IsOptional()
  @IsBoolean()
  pago?: boolean;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string | null;
}
