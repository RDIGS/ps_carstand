// Tipos de documento anexável a um veículo (secção nova, 2026-09-16;
// alargado a DUA em 2026-09-17 — pedido do utilizador para juntar tudo no
// mesmo cartão em vez do DUA só se ver no ato da criação). "foto_viatura"
// (a galeria geral) continua de fora — essa tem o seu próprio cartão.
export const DOCUMENTO_TIPOS = ['seguro', 'inspecao', 'dua_frente', 'dua_verso'] as const;
export type DocumentoTipo = (typeof DOCUMENTO_TIPOS)[number];
