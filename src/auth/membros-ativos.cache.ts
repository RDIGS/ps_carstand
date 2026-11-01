// Estado de cada membro (ativo + papel) visto pelo JwtStrategy em cada
// pedido. Sem isto, quem era removido/desativado ou mudava de papel mantinha
// o acesso antigo até o JWT expirar (até 1 hora). Cache de 1 min para não
// fazer uma query por pedido (o pooler da Supabase tem poucas ligações);
// TeamService limpa a entrada no momento da alteração, por isso neste
// processo o corte é imediato.
const VALIDADE_MS = 60_000;

interface EstadoMembro {
  ativo: boolean;
  role: string | null;
  ate: number;
}

const cache = new Map<string, EstadoMembro>();

const chave = (standId: string, personId: string) => `${standId}:${personId}`;

export function lerMembroEmCache(standId: string, personId: string): EstadoMembro | null {
  const e = cache.get(chave(standId, personId));
  return e && e.ate > Date.now() ? e : null;
}

export function guardarMembroEmCache(standId: string, personId: string, ativo: boolean, role: string | null) {
  if (cache.size > 10_000) cache.clear();
  cache.set(chave(standId, personId), { ativo, role, ate: Date.now() + VALIDADE_MS });
}

/** Chamar sempre que um membro é alterado/removido (ou a pessoa desativada). */
export function invalidarMembro(personId: string, standId?: string) {
  for (const k of cache.keys()) {
    if (k.endsWith(`:${personId}`) && (!standId || k.startsWith(`${standId}:`))) cache.delete(k);
  }
}
