import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INVOICE_SYSTEM_PROMPT } from './prompts/invoice.prompt';
import { INVOICE_RESPONSE_SCHEMA, CAMPOS_COM_CONFIANCA } from './invoice-response-schema';
import { InvoiceExtractionResult, InvoiceExtractedFields } from './invoice-extraction.types';
import { fetchGemini } from './gemini-fetch.util';

@Injectable()
export class InvoiceExtractionService {
  private readonly logger = new Logger(InvoiceExtractionService.name);

  constructor(private readonly config: ConfigService) {}

  async extract(fotoBase64: string): Promise<InvoiceExtractionResult> {
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-3.1-flash-lite');
    const apiKey = this.config.get<string>('GEMINI_API_KEY');

    let response: Response;
    try {
      response = await fetchGemini(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: INVOICE_SYSTEM_PROMPT },
                  { inline_data: { mime_type: 'image/jpeg', data: fotoBase64 } },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: INVOICE_RESPONSE_SCHEMA,
              temperature: 0.1,
            },
          }),
        },
      );
    } catch (err) {
      // Mesmo motivo do dua-extraction.service.ts/identity-extraction.service.ts.
      this.logger.error(`Falha a contactar o Gemini: ${err instanceof Error ? err.message : err}`);
      throw new UnprocessableEntityException({
        error: 'ocr_indisponivel',
        message: 'Não foi possível processar o documento neste momento. Tenta novamente.',
      });
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Gemini respondeu ${response.status}: ${body}`);
      throw new UnprocessableEntityException({
        error: 'ocr_indisponivel',
        message: 'Não foi possível processar o documento neste momento. Tenta novamente.',
      });
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new UnprocessableEntityException({
        error: 'documento_nao_reconhecido',
        message: 'A imagem não parece ser uma fatura ou recibo válido.',
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new UnprocessableEntityException({
        error: 'documento_nao_reconhecido',
        message: 'A imagem não parece ser uma fatura ou recibo válido.',
      });
    }

    if (parsed.erro === 'documento_nao_reconhecido') {
      throw new UnprocessableEntityException({
        error: 'documento_nao_reconhecido',
        message: 'A imagem não parece ser uma fatura ou recibo válido.',
      });
    }

    const extracted = parsed as unknown as InvoiceExtractedFields;
    const confianca = (parsed.confianca as Record<string, number>) ?? {};
    const avisos = (parsed.avisos as string[]) ?? [];

    // Mesma lógica de segurança do DUA/identidade: não confiar cegamente no
    // autorreporte do modelo — força confiança 0 sempre que o campo não foi
    // extraído.
    for (const campo of CAMPOS_COM_CONFIANCA) {
      if (extracted[campo as keyof InvoiceExtractedFields] == null) {
        confianca[campo] = 0;
      }
    }

    return { extracted, confianca, avisos };
  }
}
