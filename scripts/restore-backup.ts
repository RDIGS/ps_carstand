/**
 * Restauro de um backup gerado por src/backup/backup.service.ts.
 *
 * NUNCA exposto via API — é sempre corrido manualmente por quem tem acesso
 * direto ao .env/BD, tal como os scripts ad-hoc de migração usados durante
 * o desenvolvimento. TRUNCATE + INSERT é destrutivo: por omissão o script
 * só mostra o que faria (dry-run); só executa a sério com --confirm.
 *
 * Uso:
 *   npx ts-node scripts/restore-backup.ts <ficheiro.json.gz>                (dry-run, tudo)
 *   npx ts-node scripts/restore-backup.ts <ficheiro.json.gz> --confirm      (restaura tudo, a sério)
 *   npx ts-node scripts/restore-backup.ts <ficheiro.json.gz> --stand=<schema_name> --confirm
 *       (restaura só esse stand, deixa a BD Central e os outros stands intocados)
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { Pool, PoolClient } from 'pg';

const IDENTIFICADOR_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

// Mesma ordem de criação de src/tenant/tenant-schema.sql — respeita as
// dependências de FK (ex.: sales.vehicle_id -> vehicles.id). Qualquer tabela
// no dump que não conste desta lista (schema evoluiu depois deste script)
// é inserida no fim, na ordem em que veio do dump.
const ORDEM_TABELAS_STAND = [
  'vehicles',
  'vehicle_photos',
  'vehicle_expenses',
  'sales',
  'finance_entries',
  'market_estimates',
  'checklist_templates',
  'checklist_template_items',
  'vehicle_checklist_items',
  'leads',
  'audit_log',
];

// Mesma ordem de CENTRAL_TABLES em backup.service.ts — já respeita FKs
// (people/stands antes de quem lhes aponta).
const ORDEM_TABELAS_CENTRAL = [
  'people',
  'stands',
  'stand_members',
  'suggestions',
  'app_versions',
  'platform_entity_config',
  'legal_documents',
  'legal_acceptances',
];

interface Dump {
  geradoEm: string;
  central: Record<string, Record<string, unknown>[]>;
  stands: Record<string, { nome: string; tabelas: Record<string, Record<string, unknown>[]> }>;
}

function assertIdentificadorValido(nome: string, contexto: string): void {
  if (!IDENTIFICADOR_RE.test(nome)) {
    throw new Error(`${contexto} com nome inválido, a recusar por segurança: ${nome}`);
  }
}

function ordenar(tabelasNoDump: string[], ordemConhecida: string[]): string[] {
  const conhecidas = ordemConhecida.filter((t) => tabelasNoDump.includes(t));
  const desconhecidas = tabelasNoDump.filter((t) => !ordemConhecida.includes(t));
  return [...conhecidas, ...desconhecidas];
}

async function restaurarTabela(
  client: PoolClient,
  schema: string,
  tabela: string,
  linhas: Record<string, unknown>[],
  confirmar: boolean,
): Promise<void> {
  assertIdentificadorValido(schema, 'Schema');
  assertIdentificadorValido(tabela, 'Tabela');

  if (!confirmar) {
    console.log(`  [dry-run] "${schema}"."${tabela}": TRUNCATE + ${linhas.length} linha(s) a inserir`);
    return;
  }

  await client.query(`TRUNCATE TABLE "${schema}"."${tabela}" CASCADE`);
  for (const linha of linhas) {
    const colunas = Object.keys(linha);
    colunas.forEach((c) => assertIdentificadorValido(c, `Coluna de "${tabela}"`));
    if (colunas.length === 0) continue;

    const colunasSql = colunas.map((c) => `"${c}"`).join(', ');
    const placeholders = colunas.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO "${schema}"."${tabela}" (${colunasSql}) VALUES (${placeholders})`,
      colunas.map((c) => linha[c]),
    );
  }
  console.log(`  "${schema}"."${tabela}": ${linhas.length} linha(s) restaurada(s)`);
}

async function main(): Promise<void> {
  const [ficheiro, ...flags] = process.argv.slice(2);
  const confirmar = flags.includes('--confirm');
  const standFiltro = flags.find((f) => f.startsWith('--stand='))?.split('=')[1];

  if (!ficheiro) {
    console.error('Uso: npx ts-node scripts/restore-backup.ts <ficheiro.json.gz> [--stand=<schema>] [--confirm]');
    process.exit(1);
  }

  const dump: Dump = JSON.parse(gunzipSync(readFileSync(ficheiro)).toString('utf8'));
  console.log(`Backup gerado em: ${dump.geradoEm}`);
  if (!confirmar) {
    console.log('*** DRY-RUN *** — nada será alterado. Junta --confirm para executar a sério.\n');
  } else {
    console.log('*** A EXECUTAR A SÉRIO *** — isto vai APAGAR e substituir os dados das tabelas listadas.\n');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (!standFiltro) {
      console.log('== BD Central ==');
      const tabelas = ordenar(Object.keys(dump.central), ORDEM_TABELAS_CENTRAL);
      for (const tabela of tabelas) {
        await restaurarTabela(client, 'public', tabela, dump.central[tabela] ?? [], confirmar);
      }
    }

    for (const [schema, dadosStand] of Object.entries(dump.stands)) {
      if (standFiltro && schema !== standFiltro) continue;
      console.log(`\n== Stand "${dadosStand.nome}" (${schema}) ==`);
      const tabelas = ordenar(Object.keys(dadosStand.tabelas), ORDEM_TABELAS_STAND);
      for (const tabela of tabelas) {
        await restaurarTabela(client, schema, tabela, dadosStand.tabelas[tabela] ?? [], confirmar);
      }
    }

    if (standFiltro && !dump.stands[standFiltro]) {
      throw new Error(`Stand com schema "${standFiltro}" não encontrado neste backup.`);
    }

    if (confirmar) {
      await client.query('COMMIT');
      console.log('\nRestauro concluído e confirmado (COMMIT).');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDry-run terminado, nada foi alterado (ROLLBACK).');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nFalhou — nada foi alterado (ROLLBACK):', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
