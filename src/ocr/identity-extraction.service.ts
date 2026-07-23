import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDENTITY_SYSTEM_PROMPT } from './prompts/identity.prompt';
import { IDENTITY_RESPONSE_SCHEMA, CAMPOS_COM_CONFIANCA } from './identity-response-schema';
import { IdentityExtractionResult, IdentityExtractedFields } from './identity-extraction.types';

const CAMPOS_CRITICOS = ['nome_completo', 'numero_documento'];
const CONFIANCA_MINIMA = 0.85;

@Injectable()
export class IdentityExtractionService {
  private readonly logger = new Logger(IdentityExtractionService.name);

  constructor(private readonly config: ConfigService) {}

  async extract(fotoFrenteBase64: string, fotoVersoBase64: string): Promise<IdentityExtractionResult> {
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-3.1-flash-lite');
    const apiKey = this.config.get<string>('GEMINI_API_KEY');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: IDENTITY_SYSTEM_PROMPT },
                { inline_data: { mime_type: 'image/jpeg', data: fotoFrenteBase64 } },
                { inline_data: { mime_type: 'image/jpeg', data: fotoVersoBase64 } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: IDENTITY_RESPONSE_SCHEMA,
            temperature: 0.1,
          },
        }),
      },
    );

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
        message: 'As imagens não parecem ser um Cartão de Cidadão ou Título de Residência válido.',
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new UnprocessableEntityException({
        error: 'documento_nao_reconhecido',
        message: 'As imagens não parecem ser um Cartão de Cidadão ou Título de Residência válido.',
      });
    }

    if (parsed.erro === 'documento_nao_reconhecido' || !parsed.tipo_documento) {
      throw new UnprocessableEntityException({
        error: 'documento_nao_reconhecido',
        message: 'As imagens não parecem ser um Cartão de Cidadão ou Título de Residência válido.',
      });
    }

    const extracted = parsed as unknown as IdentityExtractedFields;
    const confianca = (parsed.confianca as Record<string, number>) ?? {};
    const avisos = (parsed.avisos as string[]) ?? [];

    // Mesma lógica de segurança do DUA (dua-extraction.service.ts): não
    // confiar cegamente no autorreporte do modelo — força confiança 0 sempre
    // que o campo não foi extraído.
    for (const campo of CAMPOS_COM_CONFIANCA) {
      if (extracted[campo as keyof IdentityExtractedFields] == null) {
        confianca[campo] = 0;
      }
    }

    const temCampoCriticoComBaixaConfianca = CAMPOS_CRITICOS.some(
      (campo) => (confianca[campo] ?? 1) < CONFIANCA_MINIMA,
    );
    if (temCampoCriticoComBaixaConfianca) {
      avisos.push('confianca_baixa_campo_critico');
    }

    return { extracted, confianca, avisos };
  }
}
