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

describe('SiteService — pedidos de visita', () => {
  let tenant: { query: jest.Mock };
  let service: SiteService;

  // Dia e hora daqui a 2 dias, às 15:00 (dentro do horário e do prazo).
  const daqui = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
  const valido = () =>
    service.lerCampos({ nome: 'Rui', telefone: '912345678', data: daqui(2), hora: '15:00', consentimento: 'sim' });

  beforeEach(() => {
    tenant = {
      query: jest.fn().mockImplementation((_schema: string, sql: string, params?: unknown[]) => {
        if (sql.includes('AT TIME ZONE')) return Promise.resolve([{ ts: `${params![0]}T${params![1]}:00Z` }]);
        if (sql.includes('count(*)')) return Promise.resolve([{ total: 0 }]);
        return Promise.resolve([]);
      }),
    };
    service = new SiteService({} as any, tenant as any);
  });

  const inseriu = () => tenant.query.mock.calls.some(([, sql]) => (sql as string).includes('INSERT INTO visit_requests'));

  it('pedido válido é gravado', async () => {
    expect(await service.criarPedido('stand_x', valido())).toEqual([]);
    expect(inseriu()).toBe(true);
  });

  it('robô que preenche o campo-armadilha: finge sucesso mas não grava', async () => {
    const campos = { ...valido(), website: 'http://spam' };
    expect(await service.criarPedido('stand_x', campos)).toEqual([]);
    expect(inseriu()).toBe(false);
  });

  it('sem consentimento, sem contacto ou fora de horas → recusado', async () => {
    expect(await service.criarPedido('stand_x', { ...valido(), consentimento: '' })).not.toEqual([]);
    expect(await service.criarPedido('stand_x', { ...valido(), telefone: '', email: '' })).not.toEqual([]);
    expect(await service.criarPedido('stand_x', { ...valido(), hora: '23:00' })).not.toEqual([]);
    expect(await service.criarPedido('stand_x', { ...valido(), data: daqui(90) })).not.toEqual([]);
    expect(inseriu()).toBe(false);
  });

  it('a partir de 50 pedidos em 24 h o stand deixa de aceitar (trava abusos)', async () => {
    tenant.query.mockImplementation((_s: string, sql: string, params?: unknown[]) => {
      if (sql.includes('AT TIME ZONE')) return Promise.resolve([{ ts: `${params![0]}T${params![1]}:00Z` }]);
      if (sql.includes('count(*)')) return Promise.resolve([{ total: 50 }]);
      return Promise.resolve([]);
    });
    expect(await service.criarPedido('stand_x', valido())).not.toEqual([]);
    expect(inseriu()).toBe(false);
  });

  it('campos enormes são cortados antes de chegar à BD', () => {
    const c = service.lerCampos({ nome: 'x'.repeat(5000), mensagem: 'y'.repeat(5000) });
    expect(c.nome?.length).toBe(100);
    expect(c.mensagem?.length).toBe(1000);
  });
});

