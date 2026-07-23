import { IsString, MinLength } from 'class-validator';

export class AddChecklistItemDto {
  @IsString()
  @MinLength(1)
  descricao!: string;
}
