import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class ListEventsQueryDto {
  @IsDateString()
  inicio!: string;

  @IsDateString()
  fim!: string;

  // 'stand' (omitido) = tudo o que a equipa tem marcado, incluindo tarefas
  // não alocadas a ninguém. 'meu' = só o que criei ou fui convidado.
  @IsOptional()
  @IsIn(['stand', 'meu'])
  escopo?: 'stand' | 'meu';
}
