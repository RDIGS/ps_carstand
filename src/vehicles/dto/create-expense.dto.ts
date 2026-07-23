import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateExpenseDto {
  @IsIn(['reparacao', 'transporte', 'legalizacao', 'limpeza_detalhe', 'outro'])
  categoria!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber()
  @IsPositive()
  valor!: number;
}
