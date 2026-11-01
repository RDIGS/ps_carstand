import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, mergeMap } from 'rxjs';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { StorageService } from './storage.service';

// Campos de ficheiro nas respostas: `url`, `*_url`, `*Url` e `foto_capa`.
// Só estes são convertidos — um texto livre que por acaso comece por "sb:"
// (descrição, notas) nunca é tocado.
const CAMPO_FICHEIRO = /(^|_)url$|Url$|^foto_capa$/;

/**
 * Global: troca cada referência `sb:<caminho>` numa resposta JSON por um URL
 * assinado válido 1 hora (ver StorageService). Defesa extra: só assina
 * caminhos do próprio stand de quem pede (`<schema>/…` ou
 * `stands/<standId>/…`); o painel de admin (chave própria, sem JWT) pode
 * assinar tudo; pedidos públicos não assinam nada.
 */
@Injectable()
export class UrlsAssinadasInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UrlsAssinadasInterceptor.name);

  constructor(private readonly storage: StorageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: JwtPayload; path?: string }>();
    return next.handle().pipe(mergeMap((body) => this.converter(body, req)));
  }

  private async converter(body: unknown, req: { user?: JwtPayload; path?: string }): Promise<unknown> {
    if (body === null || typeof body !== 'object' || Buffer.isBuffer(body)) return body;

    const encontrados: { alvo: Record<string, unknown>; chave: string; caminho: string }[] = [];
    const visitar = (valor: unknown, profundidade: number) => {
      if (profundidade > 8 || valor === null || typeof valor !== 'object' || Buffer.isBuffer(valor)) return;
      if (valor instanceof Date) return;
      if (Array.isArray(valor)) {
        for (const v of valor) visitar(v, profundidade + 1);
        return;
      }
      const obj = valor as Record<string, unknown>;
      for (const [chave, v] of Object.entries(obj)) {
        const caminho = CAMPO_FICHEIRO.test(chave) ? StorageService.caminhoDe(v) : null;
        if (caminho) encontrados.push({ alvo: obj, chave, caminho });
        else visitar(v, profundidade + 1);
      }
    };
    visitar(body, 0);
    if (encontrados.length === 0) return body;

    const permitido = (caminho: string) => {
      if (caminho.includes('..')) return false;
      if (req.user) return caminho.startsWith(`${req.user.schemaName}/`) || caminho.startsWith(`stands/${req.user.standId}/`);
      return (req.path ?? '').startsWith('/admin/');
    };

    const validos = encontrados.filter((e) => permitido(e.caminho));
    let urls = new Map<string, string>();
    try {
      urls = await this.storage.assinar(validos.map((e) => e.caminho));
    } catch (e) {
      this.logger.error(`Falha a assinar URLs: ${(e as Error).message}`);
    }
    for (const e of encontrados) {
      if (!permitido(e.caminho)) this.logger.warn(`Referência de ficheiro fora do stand recusada: ${e.caminho}`);
      e.alvo[e.chave] = urls.get(e.caminho) ?? null;
    }
    return body;
  }
}
