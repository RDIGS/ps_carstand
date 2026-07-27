import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { FINANCE_CATEGORIAS } from '../finance-categorias';

export class UpdateFinanceEntryDto {
  @IsOptional()
  @IsIn(['receita', 'despesa'])
  tipo?: 'receita' | 'despesa';

  @IsOptional()
  @IsIn(FINANCE_CATEGORIAS)
  categoria?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  data?: string;
}
