import { ArrayUnique, IsArray, IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsDateString()
  dataHoraInicio!: string;

  @IsOptional()
  @IsDateString()
  dataHoraFim?: string;

  @IsOptional()
  @IsUUID()
  veiculoId?: string;

  @IsOptional()
  @IsUUID()
  leadId?: string;

  // Sem convidados = evento/tarefa do stand não alocada a ninguém em
  // específico, visível a toda a equipa. Cada UUID é validado como membro
  // atual do stand no serviço (mesmo padrão de `pagoPor` no Financeiro).
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  participantesIds?: string[];
}
