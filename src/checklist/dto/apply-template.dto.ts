import { IsUUID } from 'class-validator';

export class ApplyTemplateDto {
  @IsUUID()
  templateId!: string;
}
