import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { Pool } from 'pg';
import { gzipSync } from 'zlib';

// Tabelas centrais incluídas no backup — refresh_tokens fica de fora de
// propósito: são sessões transitórias sem valor de restauro, e mais
// sensível manter tokens (mesmo hasheados) fora de um ficheiro de backup.
const CENTRAL_TABLES = [
  'people',
  'stands',
  'stand_members',
  'suggestions',
  'app_versions',
  'platform_entity_config',
  'legal_documents',
  'legal_acceptances',
];

// Backups muito próximos uns dos outros (ex.: Render a acordar várias vezes
// seguidas, ou reinícios em loop) não trazem valor e só gastam quota do
// Storage — só cria um novo se o último tiver mais desta antiguidade.
const INTERVALO_MINIMO_HORAS = 1;
// Quantos backups manter (os mais antigos além disto são apagados a cada
// corrida). Com 1 arranque/dia dá ~1 mês de histórico.
const NUM_BACKUPS_A_MANTER = 30;

/**
 * Faz um dump completo da base de dados (DB Central + todos os schemas de
 * stand) sempre que o servidor arranca — local ou no Render, é a mesma BD
 * Supabase em ambos os casos. Guardado como JSON comprimido no Supabase
 * Storage (bucket privado dedicado), com fallback para disco local se as
 * credenciais do Supabase não estiverem configuradas (mesmo padrão do
 * StorageService). Corre em background: nunca deve atrasar o arranque do
 * servidor nem o primeiro health check do Render.
 *
 * Segundo destino independente (secção nova, 2026-10-25, incidente do
 * projeto Supabase ter ficado inacessível ~1 mês sem ninguém conseguir lá
 * entrar): enviar também para um repositório GitHub privado, via
 * `GITHUB_BACKUP_TOKEN`/`GITHUB_BACKUP_REPO`. O objetivo é explícito —
 * nunca depender de um único sítio (e de uma única conta) para os backups,
 * que é exatamente o que aconteceu com o Supabase sozinho. Best-effort e
 * independente do destino principal: uma falha aqui nunca impede o backup
 * da correr/ser considerado feito, só fica registada em log.
 */
@Injectable()
export class BackupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BackupService.name);
  private readonly pool: Pool;
  private readonly localRoot = join(process.cwd(), 'backups');

  constructor(private readonly config: ConfigService) {
    this.pool = new Pool({ connectionString: this.config.get<string>('DATABASE_URL') });
  }

  onApplicationBootstrap(): void {
    this.runBackup().catch((err) =>
      this.logger.error(`Backup automático falhou: ${err instanceof Error ? err.message : err}`),
    );
  }

  async runBackup(): Promise<void> {
    const backups = await this.listBackups();
    const ultimo = backups.at(-1);
    if (ultimo && Date.now() - ultimo.criadoEm < INTERVALO_MINIMO_HORAS * 60 * 60 * 1000) {
      this.logger.log(`Último backup tem menos de ${INTERVALO_MINIMO_HORAS}h — a saltar.`);
      return;
    }

    this.logger.log('A iniciar backup da base de dados...');
    const dump = await this.dumpDatabase();
    const agora = Date.now();
    const isoLegivel = new Date(agora).toISOString().replace(/[:.]/g, '-');
    const nomeFicheiro = `backup-${agora}-${isoLegivel}.json.gz`;
    const conteudo = gzipSync(Buffer.from(JSON.stringify(dump)));

    await this.guardar(nomeFicheiro, conteudo);
    await this.aplicarRetencao();

    try {
      await this.guardarGitHub(nomeFicheiro, conteudo);
      await this.aplicarRetencaoGitHub();
    } catch (err) {
      // Nunca falha o backup todo por causa do 2º destino — o principal
      // (Supabase/disco, acima) já está garantido nesta altura.
      this.logger.warn(`Backup para o GitHub falhou: ${err instanceof Error ? err.message : err}`);
    }

    this.logger.log(`Backup concluído: ${nomeFicheiro} (${(conteudo.length / 1024).toFixed(0)} KB)`);
  }

  private async dumpDatabase(): Promise<Record<string, unknown>> {
    const client = await this.pool.connect();
    try {
      await client.query('SET search_path TO public');

      const central: Record<string, unknown[]> = {};
      for (const tabela of CENTRAL_TABLES) {
        const res = await client.query(`SELECT * FROM "${tabela}"`);
        central[tabela] = res.rows;
      }

      const standsRes = await client.query<{ id: string; nome: string; schema_name: string }>(
        'SELECT id, nome, schema_name FROM stands',
      );

      const stands: Record<string, { nome: string; tabelas: Record<string, unknown[]> }> = {};
      for (const stand of standsRes.rows) {
        const schema = stand.schema_name;
        await client.query(`SET search_path TO "${schema}"`);
        const tabelasRes = await client.query<{ table_name: string }>(
          'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
          [schema],
        );
        const tabelas: Record<string, unknown[]> = {};
        for (const { table_name } of tabelasRes.rows) {
          const dadosRes = await client.query(`SELECT * FROM "${table_name}"`);
          tabelas[table_name] = dadosRes.rows;
        }
        stands[schema] = { nome: stand.nome, tabelas };
      }

      return { geradoEm: new Date().toISOString(), central, stands };
    } finally {
      client.release();
    }
  }

  private async guardar(nome: string, conteudo: Buffer): Promise<void> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.config.get<string>('SUPABASE_BACKUP_BUCKET', 'backups');

    if (!supabaseUrl || !serviceKey) {
      this.logger.warn('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados — a gravar backup em disco local.');
      await mkdir(this.localRoot, { recursive: true });
      await writeFile(join(this.localRoot, nome), conteudo);
      return;
    }

    await this.garantirBucket(supabaseUrl, serviceKey, bucket);
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${nome}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/gzip',
        'x-upsert': 'true',
      },
      body: new Uint8Array(conteudo),
    });
    if (!res.ok) {
      throw new Error(`Falha ao enviar backup para o Supabase Storage: ${res.status} — ${await res.text()}`);
    }
  }

  private async garantirBucket(supabaseUrl: string, serviceKey: string, bucket: string): Promise<void> {
    const res = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    });
    // 400/409 = bucket já existe — ignorar, só falhar em erro inesperado.
    if (!res.ok && res.status !== 400 && res.status !== 409) {
      throw new Error(`Falha ao garantir bucket de backups: ${res.status} — ${await res.text()}`);
    }
  }

  // Repositório GitHub privado dedicado a backups (secção nova, 2026-10-25)
  // — segundo destino independente da Supabase. `GITHUB_BACKUP_REPO` no
  // formato "dono/repo" (ex. "RDIGS/ps-carstand-backups"). Sem as duas vars
  // configuradas, este destino fica simplesmente desligado (não é
  // obrigatório, ao contrário do Supabase/disco local que é sempre o
  // destino principal).
  private githubConfig(): { token: string; repo: string } | null {
    const token = this.config.get<string>('GITHUB_BACKUP_TOKEN');
    const repo = this.config.get<string>('GITHUB_BACKUP_REPO');
    if (!token || !repo) return null;
    return { token, repo };
  }

  private async guardarGitHub(nome: string, conteudo: Buffer): Promise<void> {
    const github = this.githubConfig();
    if (!github) {
      this.logger.debug('GITHUB_BACKUP_TOKEN/GITHUB_BACKUP_REPO não configurados — a saltar backup para o GitHub.');
      return;
    }

    // Ficheiro novo sempre (nome tem timestamp, nunca colide) — a Contents
    // API só pede `sha` para ATUALIZAR um ficheiro existente, não para criar.
    const res = await fetch(`https://api.github.com/repos/${github.repo}/contents/backups/${nome}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${github.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Backup automático ${nome}`,
        content: conteudo.toString('base64'),
      }),
    });
    if (!res.ok) {
      throw new Error(`Falha ao enviar backup para o GitHub: ${res.status} — ${await res.text()}`);
    }
  }

  private async listBackupsGitHub(): Promise<{ nome: string; sha: string }[]> {
    const github = this.githubConfig();
    if (!github) return [];

    const res = await fetch(`https://api.github.com/repos/${github.repo}/contents/backups`, {
      headers: { Authorization: `Bearer ${github.token}`, Accept: 'application/vnd.github+json' },
    });
    if (res.status === 404) return []; // pasta "backups/" ainda não existe (1ª corrida).
    if (!res.ok) {
      this.logger.warn(`Falha ao listar backups no GitHub: ${res.status}`);
      return [];
    }
    const entries = (await res.json()) as { name: string; sha: string }[];
    return entries
      .filter((e) => e.name.startsWith('backup-'))
      .map((e) => ({ nome: e.name, sha: e.sha }))
      .sort((a, b) => this.timestampDoNome(a.nome) - this.timestampDoNome(b.nome));
  }

  private async aplicarRetencaoGitHub(): Promise<void> {
    const github = this.githubConfig();
    if (!github) return;

    const backups = await this.listBackupsGitHub();
    if (backups.length <= NUM_BACKUPS_A_MANTER) return;
    const aApagar = backups.slice(0, backups.length - NUM_BACKUPS_A_MANTER);

    for (const { nome, sha } of aApagar) {
      const res = await fetch(`https://api.github.com/repos/${github.repo}/contents/backups/${nome}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${github.token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: `Remover backup antigo ${nome}`, sha }),
      });
      if (!res.ok) {
        this.logger.warn(`Falha ao apagar backup antigo do GitHub (${nome}): ${res.status}`);
      }
    }
    this.logger.log(`Retenção (GitHub) aplicada: ${aApagar.length} backup(s) antigo(s) removido(s).`);
  }

  private async listBackups(): Promise<{ nome: string; criadoEm: number }[]> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.config.get<string>('SUPABASE_BACKUP_BUCKET', 'backups');

    if (!supabaseUrl || !serviceKey) {
      await mkdir(this.localRoot, { recursive: true });
      const ficheiros = await readdir(this.localRoot);
      return ficheiros
        .filter((f) => f.startsWith('backup-'))
        .map((nome) => ({ nome, criadoEm: this.timestampDoNome(nome) }))
        .sort((a, b) => a.criadoEm - b.criadoEm);
    }

    const res = await fetch(`${supabaseUrl}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: '', limit: 1000 }),
    });
    if (!res.ok) {
      // Bucket pode ainda não existir na 1ª corrida — trata como "sem backups".
      return [];
    }
    const entries = (await res.json()) as { name: string }[];
    return entries
      .filter((e) => e.name.startsWith('backup-'))
      .map((e) => ({ nome: e.name, criadoEm: this.timestampDoNome(e.name) }))
      .sort((a, b) => a.criadoEm - b.criadoEm);
  }

  private timestampDoNome(nome: string): number {
    const match = nome.match(/^backup-(\d+)-/);
    return match ? Number(match[1]) : 0;
  }

  private async aplicarRetencao(): Promise<void> {
    const backups = await this.listBackups();
    if (backups.length <= NUM_BACKUPS_A_MANTER) return;
    const aApagar = backups.slice(0, backups.length - NUM_BACKUPS_A_MANTER).map((b) => b.nome);

    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const bucket = this.config.get<string>('SUPABASE_BACKUP_BUCKET', 'backups');

    if (!supabaseUrl || !serviceKey) {
      await Promise.all(aApagar.map((nome) => unlink(join(this.localRoot, nome))));
      this.logger.log(`Retenção aplicada: ${aApagar.length} backup(s) antigo(s) removido(s) do disco local.`);
      return;
    }

    const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: aApagar }),
    });
    if (!res.ok) {
      this.logger.warn(`Falha ao aplicar retenção de backups: ${res.status}`);
    } else {
      this.logger.log(`Retenção aplicada: ${aApagar.length} backup(s) antigo(s) removido(s).`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
