import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DUA_SYSTEM_PROMPT } from './prompts/dua.prompt';
import { DUA_RESPONSE_SCHEMA, CAMPOS_COM_CONFIANCA } from './dua-response-schema';
import { DuaExtractionResult, DuaExtractedFields } from './dua-extraction.types';
import { MATRICULA_REGEX } from '../common/utils/matricula.util';

// Campos onde uma confiança baixa força revisão manual mesmo que a IA não
// tenha assinalado nada (secção 14, nota final).
const CAMPOS_CRITICOS = ['matricula', 'chassis'];
const CONFIANCA_MINIMA = 0.85;

@Injectable()
export class DuaExtractionService {
  private readonly logger = new Logger(DuaExtractionService.name);

  constructor(private readonly config: ConfigService) {}

  async extract(fotoFrenteBase64: string, fotoVersoBase64: string): Promise<DuaExtractionResult> {
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
                { text: DUA_SYSTEM_PROMPT },
                { inline_data: { mime_type: 'image/jpeg', data: fotoFrenteBase64 } },
                { inline_data: { mime_type: 'image/jpeg', data: fotoVersoBase64 } },
              ],
            },
          ],
          // responseSchema testado contra a API real (v1beta): garante a forma do
          // JSON pela própria API, incluindo as chaves de "confianca" fixas aos
          // nomes dos campos — não depende só da instrução em texto do prompt.
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: DUA_RESPONSE_SCHEMA,
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
        message: 'As imagens não parecem ser um DUA português válido.',
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new UnprocessableEntityException({
        error: 'documento_nao_reconhecido',
        message: 'As imagens não parecem ser um DUA português válido.',
      });
    }

    if (parsed.erro === 'documento_nao_reconhecido') {
      throw new UnprocessableEntityException({
        error: 'documento_nao_reconhecido',
        message: 'As imagens não parecem ser um DUA português válido.',
      });
    }

    const extracted = parsed as unknown as DuaExtractedFields;
    const confianca = (parsed.confianca as Record<string, number>) ?? {};
    const avisos = (parsed.avisos as string[]) ?? [];

    // Testado contra um DUA real: o modelo às vezes devolve confiança 1 mesmo
    // em campos que deixou a null — o autorreporte de confiança não é de
    // confiar sozinho. Isto força determinística e localmente a confiança a 0
    // sempre que o campo não foi extraído, em vez de depender só do modelo.
    for (const campo of CAMPOS_COM_CONFIANCA) {
      if (extracted[campo as keyof DuaExtractedFields] == null) {
        confianca[campo] = 0;
      }
    }

    if (extracted.matricula && !MATRICULA_REGEX.test(extracted.matricula)) {
      throw new UnprocessableEntityException({
        error: 'documento_nao_reconhecido',
        message: 'Matrícula extraída não está num formato português válido.',
        campo: 'matricula',
      });
    }

    // "matricula_anterior" é uma chave sempre presente agora que o responseSchema
    // a torna obrigatória (ver dua-response-schema.ts) — já não precisa de fallback.
    const possivelImportado = extracted.importado === true && (confianca['matricula_anterior'] ?? 1) < CONFIANCA_MINIMA;

    const temCampoCriticoComBaixaConfianca = CAMPOS_CRITICOS.some(
      (campo) => (confianca[campo] ?? 1) < CONFIANCA_MINIMA,
    );

    return {
      extracted,
      confianca,
      avisos,
      possivel_importado: possivelImportado || temCampoCriticoComBaixaConfianca,
    };
  }
}
