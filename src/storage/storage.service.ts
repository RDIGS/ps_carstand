import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';

// Ficheiros (fotos, documentos com dados pessoais — CC do comprador, DUA,
// faturas) vivem num bucket PRIVADO do Supabase Storage (secção 8, RGPD).
//
// Na base de dados guarda-se só uma referência `sb:<caminho>`, nunca um URL:
// até 2026-11 guardava-se um URL assinado válido 10 anos, que qualquer pessoa
// com o link (reencaminhado, num histórico, num backup) abria sem sessão e
// sem forma de o cancelar. Agora o URL é assinado no momento em que sai para
// a app (UrlsAssinadasInterceptor), válido 1 hora, e só para ficheiros do
// stand de quem pede.
//
// Valores antigos (URL completo) continuam a ser aceites por `descarregar()`
// e passam inalterados pelo interceptor até à migração
// (scripts/migrar-storage.ts) que move os ficheiros — mover é a única forma
// de invalidar os URLs de 10 anos já emitidos.
//
// Sem credenciais configuradas (desenvolvimento local), cai para disco local
// em ./storage, servido estaticamente pelo main.ts.
export const PREFIXO_REF = 'sb:';
const VALIDADE_URL_SEGUNDOS = 60 * 60;
// Reutilizar a mesma assinatura durante 45 min dá URLs estáveis (a cache de
// imagens da app não volta a descarregar a cada pedido) e poupa chamadas ao
// Supabase; sobram sempre ≥15 min de validade a quem a recebe.
const CACHE_ASSINATURA_MS = 45 * 60 * 1000;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly localRoot = join(process.cwd(), 'storage');
  private readonly cache = new Map<string, { url: string; ate: number }>();

  constructor(private readonly config: ConfigService) {}

  private get supabase() {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET', 'documentos');
    return url && key ? { url, key, bucket } : null;
  }

  /**
   * Grava e devolve a referência a guardar na BD (`sb:<caminho>`). O nome
   * leva um sufixo aleatório: cada versão de um ficheiro tem caminho próprio
   * (a cache da app pode confiar no caminho) e não é adivinhável.
   */
  async upload(path: string, buffer: Buffer, contentType: string): Promise<string> {
    const ext = extname(path);
    const caminho = `${path.slice(0, path.length - ext.length)}-${randomBytes(6).toString('hex')}${ext}`;
    const sb = this.supabase;

    if (sb) {
      const res = await fetch(`${sb.url}/storage/v1/object/${sb.bucket}/${caminho}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sb.key}`, 'Content-Type': contentType, 'x-upsert': 'true' },
        body: new Uint8Array(buffer),
      });
      if (!res.ok) {
        throw new Error(`Falha ao enviar ficheiro para o Supabase Storage: ${res.status} — ${await res.text()}`);
      }
      return `${PREFIXO_REF}${caminho}`;
    }

    this.logger.warn('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados — a gravar em disco local.');
    const fullPath = join(this.localRoot, caminho);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return `${PREFIXO_REF}${caminho}`;
  }

  /** `sb:<caminho>` → caminho; qualquer outro valor → null. */
  static caminhoDe(ref: unknown): string | null {
    return typeof ref === 'string' && ref.startsWith(PREFIXO_REF) ? ref.slice(PREFIXO_REF.length) : null;
  }

  /** URLs assinados (1 h) para vários caminhos de uma vez — caminho → URL. */
  async assinar(caminhos: string[]): Promise<Map<string, string>> {
    const resultado = new Map<string, string>();
    const agora = Date.now();
    const emFalta: string[] = [];
    for (const c of new Set(caminhos)) {
      const emCache = this.cache.get(c);
      if (emCache && emCache.ate > agora) resultado.set(c, emCache.url);
      else emFalta.push(c);
    }
    if (emFalta.length === 0) return resultado;

    const sb = this.supabase;
    if (!sb) {
      for (const c of emFalta) resultado.set(c, `/storage/${c}`);
      return resultado;
    }

    const res = await fetch(`${sb.url}/storage/v1/object/sign/${sb.bucket}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sb.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: VALIDADE_URL_SEGUNDOS, paths: emFalta }),
    });
    if (!res.ok) throw new Error(`Falha ao assinar URLs do Supabase Storage: ${res.status}`);
    const assinados = (await res.json()) as { path: string | null; signedURL: string | null; error: string | null }[];
    for (const a of assinados) {
      if (!a.path || !a.signedURL) continue;
      const url = `${sb.url}/storage/v1${a.signedURL}`;
      resultado.set(a.path, url);
      this.cache.set(a.path, { url, ate: agora + CACHE_ASSINATURA_MS });
    }
    if (this.cache.size > 5000) {
      for (const [k, v] of this.cache) if (v.ate <= agora) this.cache.delete(k);
    }
    return resultado;
  }

  /**
   * Conteúdo de um ficheiro guardado, para uso interno (PDFs, site público).
   * Aceita a referência nova (`sb:`), um URL antigo ainda não migrado e o
   * caminho local (`/storage/...`). `null` se não existir ou falhar.
   */
  async descarregar(ref: string | null | undefined): Promise<Buffer | null> {
    if (!ref) return null;
    try {
      const caminho = StorageService.caminhoDe(ref);
      const sb = this.supabase;
      if (caminho && sb) {
        const res = await fetch(`${sb.url}/storage/v1/object/${sb.bucket}/${caminho}`, {
          headers: { Authorization: `Bearer ${sb.key}` },
          signal: AbortSignal.timeout(15_000),
        });
        return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
      }
      if (caminho) return await readFile(join(this.localRoot, caminho));
      if (ref.startsWith('/storage/')) return await readFile(join(this.localRoot, ref.slice('/storage/'.length)));
      const res = await fetch(ref, { signal: AbortSignal.timeout(15_000) });
      return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    } catch {
      return null;
    }
  }
}
