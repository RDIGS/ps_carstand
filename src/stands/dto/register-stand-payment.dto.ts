import { IsDateString, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RegisterStandPaymentDto {
  @IsNumber()
  @IsPositive()
  valor!: number;

  // Por omissão, hoje — só se preenche quando o pagamento é registado
  // tardiamente e a data real foi outro dia.
  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}
