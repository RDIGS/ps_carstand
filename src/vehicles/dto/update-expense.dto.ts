import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

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
}
