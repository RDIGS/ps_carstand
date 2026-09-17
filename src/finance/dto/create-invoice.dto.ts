import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

// Fatura partilhável entre várias despesas (secção nova, 2026-09-17) — ver
// comentário em tenant-schema.sql (CREATE TABLE invoices). Campos iguais aos
// já extraídos por POST /finance/extract-invoice, mas aqui é o utilizador
// que já reviu/corrigiu antes de confirmar (não se corre o OCR outra vez).
export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  fornecedorNome?: string;

  @IsOptional()
  @IsString()
  fornecedorNif?: string;

  @IsOptional()
  @IsDateString()
  data?: string;

  @IsNumber()
  @IsPositive()
  valorTotal!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valorIva?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaIva?: number;
}
