import { IsIn } from 'class-validator';

export class AcceptLegalDocumentDto {
  @IsIn(['termos', 'privacidade', 'dpa'])
  tipo!: 'termos' | 'privacidade' | 'dpa';
}
