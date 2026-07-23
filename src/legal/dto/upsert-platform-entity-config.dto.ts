import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertPlatformEntityConfigDto {
  @IsIn(['singular', 'coletiva'])
  tipoEntidade!: 'singular' | 'coletiva';

  @IsString()
  @MinLength(1)
  nome!: string;

  @IsString()
  @MinLength(1)
  identificadorFiscal!: string;

  @IsString()
  @MinLength(1)
  morada!: string;

  @IsOptional()
  @IsString()
  cae?: string;
}
