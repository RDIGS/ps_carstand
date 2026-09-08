import { IsBoolean } from 'class-validator';

export class ToggleConcluidoDto {
  @IsBoolean()
  concluido!: boolean;
}
