import { Matches, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { MATRICULA_REGEX } from '../../common/utils/matricula.util';

export class CreateVehicleDto {
  @Matches(MATRICULA_REGEX, { message: 'Matrícula em formato inválido.' })
  matricula!: string;

  @IsString()
  @MinLength(1)
  marca!: string;

  @IsString()
  @MinLength(1)
  modelo!: string;

  @IsOptional()
  @IsString()
  versao?: string;

  @IsOptional()
  @IsString()
  dataPrimeiraMatricula?: string;

  @IsOptional()
  @IsString()
  chassis?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  combustivel?: string;

  @IsOptional()
  @IsInt()
  cilindrada?: number;

  @IsOptional()
  @IsInt()
  potenciaKw?: number;

  @IsOptional()
  @IsInt()
  pesoTara?: number;

  @IsOptional()
  @IsInt()
  pesoBruto?: number;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsOptional()
  @IsInt()
  numLugares?: number;

  @IsInt()
  @Min(0)
  kms!: number;

  @IsOptional()
  @IsNumber()
  precoCompra?: number;

  @IsOptional()
  @IsNumber()
  precoVendaRecomendado?: number;

  @IsIn(['manual', 'dua_ocr'])
  origem!: 'manual' | 'dua_ocr';

  @IsOptional()
  importado?: boolean;

  @IsOptional()
  @IsString()
  matriculaAnterior?: string;

  @IsOptional()
  @IsString()
  paisOrigemAnterior?: string;

  @IsOptional()
  @IsString()
  dataPrimeiraMatriculaOriginal?: string;

  @IsOptional()
  possivelImportado?: boolean;
}
