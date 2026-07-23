import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

// Documentos gerados (Registo de Compra) vivem no Supabase Storage em
// produção (secção 2/21), num bucket PRIVADO — têm dados pessoais do
// comprador (NIF, morada), nunca podem ficar publicamente acessíveis
// (secção 8, RGPD). Por isso é sempre pedido um URL assinado, nunca o
// `/object/public/...` (esse só funciona em buckets marcados públicos, e
// este não é). Testado contra o Supabase real: 10 anos de validade
// funciona (secção 21 já define retenção de 10 anos para estes documentos).
//
// Sem credenciais configuradas (ex.: ambiente de desenvolvimento local sem
// Supabase ainda ligado), cai para disco local em ./storage, servido
// estaticamente pelo main.ts — para o fluxo de venda/OCR funcionar de
// imediato sem depender de uma conta Supabase já criada.
const DEZ_ANOS_EM_SEGUNDOS = 10 * 365 * 24 * 60 * 60;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly localRoot = join(process.cwd(), 'storage');

  constructor(private readonly config: ConfigService) {}

  async upload(path: string, buffer: Buffer, contentType: string): Promise<string> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.config.get<string>('SUPABASE_STORAGE_BUCKET', 'documentos');

    if (supabaseUrl && serviceKey) {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(buffer),
      });
      if (!uploadResponse.ok) {
        const body = await uploadResponse.text();
        throw new Error(`Falha ao enviar ficheiro para o Supabase Storage: ${uploadResponse.status} — ${body}`);
      }

      const signResponse = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: DEZ_ANOS_EM_SEGUNDOS }),
      });
      if (!signResponse.ok) {
        throw new Error(`Falha ao assinar URL do Supabase Storage: ${signResponse.status}`);
      }
      const { signedURL } = (await signResponse.json()) as { signedURL: string };
      return `${supabaseUrl}/storage/v1${signedURL}`;
    }

    this.logger.warn('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados — a gravar em disco local.');
    const fullPath = join(this.localRoot, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    return `/storage/${path.replace(/\\/g, '/')}`;
  }
}
