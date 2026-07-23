import { IsBoolean } from 'class-validator';

export class UpdateChecklistItemDto {
  @IsBoolean()
  concluido!: boolean;
}
