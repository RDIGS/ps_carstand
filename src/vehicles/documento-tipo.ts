// Tipos de documento anexável a um veículo (secção nova, 2026-09-16) —
// distinto dos valores internos "dua_frente"/"dua_verso"/"foto_viatura"
// (esses nunca são escolhidos pelo cliente, só o backend os define).
export const DOCUMENTO_TIPOS = ['seguro', 'inspecao'] as const;
export type DocumentoTipo = (typeof DOCUMENTO_TIPOS)[number];
