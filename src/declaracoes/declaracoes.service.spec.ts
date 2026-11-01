import { ForbiddenException } from '@nestjs/common';
import { DeclaracoesService } from './declaracoes.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';

// A declaração de compra mostra o preço de compra — só para owners.

const OWNER: JwtPayload = { sub: 'p', standId: 's', schemaName: 'stand_x', role: 'owner', nome: 'x' };
const VENDEDOR: JwtPayload = { ...OWNER, role: 'vendedor' };

describe('DeclaracoesService — declaração de compra', () => {
  let tenant: { query: jest.Mock };
  let vehicles: { findOne: jest.Mock };
  let service: DeclaracoesService;

  beforeEach(() => {
    tenant = { query: jest.fn().mockResolvedValue([]) };
    vehicles = { findOne: jest.fn().mockResolvedValue({ id: 'v', preco_compra: '1000' }) };
    service = new DeclaracoesService({} as any, tenant as any, {} as any, {} as any, vehicles as any);
  });

  it('vendedor não pode emitir a declaração de compra', async () => {
    await expect(service.emitir(VENDEDOR, 'v', 'compra', { nome: 'Cliente' } as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(vehicles.findOne).not.toHaveBeenCalled();
  });

  it('vendedor não vê declarações de compra na lista; owner vê', async () => {
    await service.listar(VENDEDOR, 'v');
    expect(tenant.query.mock.calls[0][2]).toEqual(['v', false]);
    await service.listar(OWNER, 'v');
    expect(tenant.query.mock.calls[1][2]).toEqual(['v', true]);
  });
});
