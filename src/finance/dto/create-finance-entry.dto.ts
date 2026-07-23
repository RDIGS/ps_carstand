import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateFinanceEntryDto {
  @IsIn(['receita', 'despesa'])
  tipo!: 'receita' | 'despesa';

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsNumber()
  @IsPositive()
  valor!: number;

  @IsOptional()
  @IsString()
  descricao?: string;
}
