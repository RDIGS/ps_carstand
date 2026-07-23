import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool, PoolClient } from 'pg';

// Regex simples de whitelist para nomes de schema (ex: "stand_3f2a9c1b"),
// nunca gerados a partir de input direto do utilizador — mas validamos
// sempre antes de interpolar em SQL, porque não há forma segura de
// parametrizar um identificador de schema/tabela com placeholders ($1).
const SCHEMA_NAME_RE = /^[a-z][a-z0-9_]{0,62}$/;

function assertValidSchemaName(schemaName: string): void {
  if (!SCHEMA_NAME_RE.test(schemaName)) {
    throw new Error(`Nome de schema inválido: ${schemaName}`);
  }
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);
  private readonly pool: Pool;
  private readonly tenantSchemaSql: string;

  constructor(private readonly config: ConfigService) {
    this.pool = new Pool({ connectionString: this.config.get<string>('DATABASE_URL') });
    this.tenantSchemaSql = readFileSync(join(__dirname, 'tenant-schema.sql'), 'utf8');
  }

  /** Cria o schema Postgres de um stand novo e aplica o DDL (secção 12.2). */
  async provisionSchema(schemaName: string): Promise<void> {
    assertValidSchemaName(schemaName);
    const client = await this.pool.connect();
    try {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(this.tenantSchemaSql);
      this.logger.log(`Schema provisionado: ${schemaName}`);
    } finally {
      client.release();
    }
  }

  /** Executa uma query simples dentro do schema do stand. */
  async query<T = any>(schemaName: string, sql: string, params: unknown[] = []): Promise<T[]> {
    assertValidSchemaName(schemaName);
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Dá acesso a um client dedicado (com search_path já definido) para quem
   * precisa de correr uma transação com várias queries (ex.: criar venda +
   * marcar veículo como vendido). O chamador é responsável por libertar o
   * client (`client.release()`) e por BEGIN/COMMIT/ROLLBACK.
   */
  async getClient(schemaName: string): Promise<PoolClient> {
    assertValidSchemaName(schemaName);
    const client = await this.pool.connect();
    await client.query(`SET search_path TO "${schemaName}"`);
    return client;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
