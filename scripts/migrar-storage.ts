/**
 * Migração dos ficheiros do Storage para referências `sb:<caminho>` (2026-11).
 *
 * Até aqui cada ficheiro (fotos, CC do comprador, DUA, faturas, PDFs) ficava
 * na BD como um URL assinado válido 10 ANOS — quem tivesse o link abria o
 * ficheiro sem sessão, e um URL assinado do Supabase não se cancela. A única
 * forma de os invalidar é mudar o ficheiro de sítio. Este script, por stand:
 *
 *   1. lista TODOS os objetos do stand no bucket (`<schema>/…` e
 *      `stands/<standId>/…`), incluindo órfãos (fotos apagadas na app
 *      continuam no Storage e os links antigos delas também têm de morrer);
 *   2. move cada um para um caminho novo (sufixo aleatório no nome);
 *   3. atualiza todas as colunas que referenciam ficheiros para `sb:<novo>`.
 *
 * Por omissão só mostra o que faria (dry-run); só executa com --confirm.
 *
 * Uso:
 *   npx ts-node scripts/migrar-storage.ts                                (dry-run, todos os stands)
 *   npx ts-node scripts/migrar-storage.ts --stand=<schema_name>          (dry-run, só esse stand)
 *   npx ts-node scripts/migrar-storage.ts --stand=<schema_name> --confirm
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { Pool } from 'pg';

const IDENTIFICADOR_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

// Todas as colunas (por stand) que guardam um ficheiro — mesma lista de
// src/tenant/tenant-schema.sql. Todas as tabelas têm `id`.
const COLUNAS_STAND: [tabela: string, coluna: string][] = [
  ['vehicle_photos', 'url'],
  ['invoices', 'comprovativo_url'],
  ['vehicle_expenses', 'comprovativo_url'],
  ['sales', 'doc_registo_compra_url'],
  ['sales', 'doc_responsabilidade_url'],
  ['sales', 'doc_dua_final_url'],
  ['sales', 'identificacao_frente_url'],
  ['sales', 'identificacao_verso_url'],
  ['sales', 'identificacao_documento_combinado_url'],
  ['finance_entries', 'comprovativo_url'],
  ['documentos_gerados', 'url'],
];

const SUPABASE_URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'documentos';
const HEADERS = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

/** URL antigo assinado ou `sb:<caminho>` → caminho no bucket; senão null. */
function caminhoDe(valor: string): string | null {
  if (valor.startsWith('sb:')) return valor.slice(3);
  const prefixo = `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/`;
  if (!valor.startsWith(prefixo)) return null;
  return decodeURIComponent(valor.slice(prefixo.length).split('?')[0]);
}

function caminhoNovo(caminho: string): string {
  const ext = extname(caminho);
  return `${caminho.slice(0, caminho.length - ext.length)}-m${randomBytes(6).toString('hex')}${ext}`;
}

/** Todos os ficheiros debaixo de `prefixo` (a API do Supabase lista uma pasta de cada vez). */
async function listarRecursivo(prefixo: string): Promise<string[]> {
  const ficheiros: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ prefix: prefixo, limit: 1000, offset }),
    });
    if (!res.ok) throw new Error(`Listar ${prefixo}: ${res.status} ${await res.text()}`);
    const itens = (await res.json()) as { name: string; id: string | null }[];
    for (const it of itens) {
      const caminho = `${prefixo}${it.name}`;
      if (it.id === null) ficheiros.push(...(await listarRecursivo(`${caminho}/`)));
      else ficheiros.push(caminho);
    }
    if (itens.length < 1000) return ficheiros;
  }
}

async function mover(de: string, para: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/move`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ bucketId: BUCKET, sourceKey: de, destinationKey: para }),
  });
  if (!res.ok) throw new Error(`Mover ${de}: ${res.status} ${await res.text()}`);
}

async function main() {
  const args = process.argv.slice(2);
  const confirmar = args.includes('--confirm');
  const filtro = args.find((a) => a.startsWith('--stand='))?.slice('--stand='.length);
  if (!SUPABASE_URL || !KEY) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY em falta no .env');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    const { rows: stands } = await pool.query<{ id: string; nome: string; schema_name: string; logo_url: string | null }>(
      `SELECT id, nome, schema_name, logo_url FROM public.stands ORDER BY nome`,
    );
    const alvo = filtro ? stands.filter((s) => s.schema_name === filtro) : stands;
    if (alvo.length === 0) throw new Error(`Nenhum stand com schema ${filtro}`);
    console.log(confirmar ? '*** A EXECUTAR ***' : '(dry-run — nada é alterado; usa --confirm para executar)');

    for (const stand of alvo) {
      if (!IDENTIFICADOR_RE.test(stand.schema_name)) throw new Error(`schema inválido: ${stand.schema_name}`);
      const schema = stand.schema_name;
      console.log(`\n=== ${stand.nome} (${schema})`);

      // 1. Referências na BD
      const refs: { tabela: string; coluna: string; id: string; caminho: string }[] = [];
      for (const [tabela, coluna] of COLUNAS_STAND) {
        const { rows } = await pool.query<{ id: string; v: string }>(
          `SELECT id, ${coluna} AS v FROM "${schema}".${tabela} WHERE ${coluna} IS NOT NULL`,
        );
        for (const r of rows) {
          const caminho = caminhoDe(r.v);
          if (caminho) refs.push({ tabela, coluna, id: r.id, caminho });
          else console.log(`  ! ${tabela}.${coluna} ${r.id}: valor não reconhecido, fica como está`);
        }
      }
      const logo = stand.logo_url ? caminhoDe(stand.logo_url) : null;

      // 2. Objetos no Storage
      const objetos = [...(await listarRecursivo(`${schema}/`)), ...(await listarRecursivo(`stands/${stand.id}/`))];
      const referenciados = new Set([...refs.map((r) => r.caminho), ...(logo ? [logo] : [])]);
      const orfaos = objetos.filter((o) => !referenciados.has(o));
      const semFicheiro = [...referenciados].filter((c) => !objetos.includes(c));
      console.log(`  ${refs.length} referências na BD${logo ? ' + logótipo' : ''}, ${objetos.length} ficheiros no Storage`);
      console.log(`  ${orfaos.length} ficheiros sem referência (também movidos), ${semFicheiro.length} referências sem ficheiro`);

      const mapa = new Map(objetos.map((o) => [o, caminhoNovo(o)]));
      if (!confirmar) {
        for (const [de, para] of [...mapa].slice(0, 3)) console.log(`  ex.: ${de}  →  ${para}`);
        continue;
      }

      // 3. Mover (um a um; o que falhar fica no sítio e com a referência antiga)
      const movidos = new Map<string, string>();
      for (const [de, para] of mapa) {
        try {
          await mover(de, para);
          movidos.set(de, para);
        } catch (e) {
          console.log(`  ! ${(e as Error).message}`);
        }
      }
      console.log(`  movidos ${movidos.size}/${mapa.size}`);

      // 4. Atualizar a BD (numa transação). Referências a ficheiros que não
      //    existem passam também a sb:<caminho> — o link antigo já não servia.
      const novaRef = (caminho: string) => `sb:${movidos.get(caminho) ?? caminho}`;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const r of refs) {
          if (objetos.includes(r.caminho) && !movidos.has(r.caminho)) continue; // falhou a mover: manter o antigo
          await client.query(`UPDATE "${schema}".${r.tabela} SET ${r.coluna} = $1 WHERE id = $2`, [novaRef(r.caminho), r.id]);
        }
        if (logo && (!objetos.includes(logo) || movidos.has(logo))) {
          await client.query(`UPDATE public.stands SET logo_url = $1 WHERE id = $2`, [novaRef(logo), stand.id]);
        }
        await client.query('COMMIT');
        console.log(`  BD atualizada`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('ERRO', e.message);
  process.exit(1);
});
