import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class CreateChecklistTemplateDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  itens!: string[];
}
