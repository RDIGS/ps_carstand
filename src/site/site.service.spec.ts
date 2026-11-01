import { SiteService } from './site.service';

// O site é público: só pode sair o que é exato e necessário (pedido do
// utilizador) — nada de matrícula, chassis, preço de compra/final nem links
// do Storage.

describe('SiteService — dados públicos', () => {
  let tenant: { query: jest.Mock };
  let service: SiteService;

  beforeEach(() => {
    tenant = { query: jest.fn().mockResolvedValue([]) };
    service = new SiteService({} as any, tenant as any);
  });

  const PROIBIDO = /matricula|chassis|preco_compra|preco_venda_final|despesa|SELECT\s+url|p\.url\b/i;

  it('a lista não pede colunas privadas', async () => {
    await service.listarVeiculos('stand_x');
    const sql: string = tenant.query.mock.calls[0][1];
    // "matricula" aparece em data_primeira_matricula (o ano) — isso é público.
    expect(sql.replace(/data_primeira_matricula(_original)?/g, '')).not.toMatch(PROIBIDO);
  });

  it('a ficha não pede colunas privadas e as fotos saem como IDs', async () => {
    tenant.query.mockResolvedValueOnce([{ id: 'v-1' }]).mockResolvedValueOnce([{ id: 'foto-1' }]);
    const r = await service.obterVeiculo('stand_x', '00000000-0000-0000-0000-000000000001');
    for (const [, sql] of tenant.query.mock.calls) {
      expect((sql as string).replace(/data_primeira_matricula(_original)?/g, '')).not.toMatch(PROIBIDO);
    }
    expect(r?.fotos).toEqual(['foto-1']);
  });

  it('só serve fotos do tipo foto_viatura de carros visíveis', async () => {
    await service.refFotoPublica('stand_x', '00000000-0000-0000-0000-000000000001');
    const [, sql, params] = tenant.query.mock.calls[0];
    expect(sql).toContain("p.tipo = 'foto_viatura'");
    expect(params[1]).toEqual(['disponivel', 'reservado']);
  });

  it('IDs inválidos nem chegam à base de dados', async () => {
    expect(await service.refFotoPublica('stand_x', '../../etc')).toBeNull();
    expect(tenant.query).not.toHaveBeenCalled();
  });
});
