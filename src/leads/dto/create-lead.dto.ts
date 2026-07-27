import { IsDateString, IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { LEAD_ORIGENS } from '../lead-constants';

export class CreateLeadDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(LEAD_ORIGENS)
  origem?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsDateString()
  proximoContacto?: string;
}
