import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  dataHoraInicio?: string;

  // `null` explícito = limpar (evento passa a não ter hora de fim).
  @IsOptional()
  @IsDateString()
  dataHoraFim?: string | null;

  @IsOptional()
  @IsUUID()
  veiculoId?: string | null;

  @IsOptional()
  @IsUUID()
  leadId?: string | null;

  // Substitui sempre a lista completa de convidados (mais simples do que
  // adicionar/remover 1 a 1) — quem já tinha respondido e continua na lista
  // nova mantém a resposta (ver CalendarService.update).
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  participantesIds?: string[];

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;
}
