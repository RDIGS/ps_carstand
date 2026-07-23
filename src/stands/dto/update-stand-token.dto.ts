import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class UpdateStandTokenDto {
  @IsOptional()
  @IsDateString()
  tokenValidoAte?: string;

  @IsOptional()
  @IsIn(['ativo', 'em_carencia', 'expirado', 'pendente', 'suspenso'])
  tokenEstado?: 'ativo' | 'em_carencia' | 'expirado' | 'pendente' | 'suspenso';
}
