import { VehiclesService } from './vehicles.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// Regra de negócio (pedido do utilizador, 2026-11): preço de compra, despesas
// e margem são só para owners — para vendedores nem saem do servidor.

const OWNER: JwtPayload = { sub: 'p-owner', standId: 's-1', schemaName: 'stand_teste', role: 'owner', nome: 'Dono' };
const VENDEDOR: JwtPayload = { ...OWNER, sub: 'p-vend', role: 'vendedor', nome: 'Vendedor' };

const VEICULO = {
  id: 'v-1',
  matricula: 'AA-00-BB',
  estado: 'disponivel',
  kms: 1000,
  preco_compra: '10000.00',
  preco_venda_recomendado: '15000.00',
};

describe('VehiclesService — dados só de owner', () => {
  let service: VehiclesService;
  let repo: any;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue({ ...VEICULO }),
      findMany: jest.fn().mockResolvedValue({ rows: [{ ...VEICULO, despesas_total: '500.00' }], totalItems: 1 }),
      despesasTotal: jest.fn().mockResolvedValue('500.00'),
      update: jest.fn().mockImplementation((_s: string, _id: string, fields: Record<string, unknown>) =>
        Promise.resolve({ ...VEICULO, ...fields }),
      ),
    };
    prisma = { stand: { findUniqueOrThrow: jest.fn().mockResolvedValue({ vendedorPodeEditarPrecoKms: true }) } };
    audit = { log: jest.fn() };
    service = new VehiclesService(repo, prisma, audit, {} as any);
  });

  it('owner recebe compra, despesas e margem prevista (pedido − compra − despesas)', async () => {
    const v = (await service.detalhe(OWNER, 'v-1')) as Record<string, unknown>;
    expect(v.preco_compra).toBe('10000.00');
    expect(v.despesas_total).toBe(500);
    expect(v.margem_prevista).toBe(4500);
  });

  it('vendedor não recebe compra, despesas nem margem — na ficha', async () => {
    const v = (await service.detalhe(VENDEDOR, 'v-1')) as Record<string, unknown>;
    expect(v).not.toHaveProperty('preco_compra');
    expect(v).not.toHaveProperty('despesas_total');
    expect(v).not.toHaveProperty('margem_prevista');
    expect(v.matricula).toBe('AA-00-BB');
  });

  it('vendedor não recebe compra, despesas nem margem — na lista', async () => {
    const { data } = await service.list(VENDEDOR, undefined, 1, 20);
    for (const v of data as Record<string, unknown>[]) {
      expect(v).not.toHaveProperty('preco_compra');
      expect(v).not.toHaveProperty('despesas_total');
      expect(v).not.toHaveProperty('margem_prevista');
    }
  });

  it('margem fica null sem preço pedido (não inventa um número)', () => {
    const v = service.paraResposta(OWNER, { ...VEICULO, preco_venda_recomendado: null, despesas_total: '0' }) as Record<
      string,
      unknown
    >;
    expect(v.margem_prevista).toBeNull();
  });

  it('vendedor não consegue alterar o preço de compra', async () => {
    await service.update(VENDEDOR, 'v-1', { precoCompra: 1, kms: 2000 } as any);
    const campos = repo.update.mock.calls[0][2];
    expect(campos).not.toHaveProperty('preco_compra');
    expect(campos.kms).toBe(2000);
  });

  it('owner continua a poder alterar o preço de compra', async () => {
    await service.update(OWNER, 'v-1', { precoCompra: 9000 } as any);
    expect(repo.update.mock.calls[0][2].preco_compra).toBe(9000);
  });
});
