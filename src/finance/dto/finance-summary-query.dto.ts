import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class FinanceSummaryQueryDto {
  // Mantido por compatibilidade — se dataInicio/dataFim vierem preenchidos,
  // têm sempre prioridade sobre periodo.
  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsUUID()
  vendedorId?: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;
}
