import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtPayload } from '../common/types/jwt-payload.interface';

const NIF_VALIDO = '999999990';

const USER: JwtPayload = {
  sub: 'person-1',
  standId: 'stand-1',
  schemaName: 'stand_teste',
  role: 'owner',
  nome: 'Teste',
};

function criarDto(overrides: Partial<CreateSaleDto> = {}): CreateSaleDto {
  return {
    vehicleId: 'vehicle-1',
    compradorNome: 'Comprador Teste',
    compradorNif: NIF_VALIDO,
    precoFinal: 10000,
    ...overrides,
  } as CreateSaleDto;
}

describe('SalesService', () => {
  let service: SalesService;
  let prisma: any;
  let tenant: any;
  let vehiclesRepo: any;
  let documents: any;
  let audit: any;
  let dbClient: any;

  const VEHICLE_DISPONIVEL = { id: 'vehicle-1', estado: 'disponivel', matricula: '00-AA-00', marca: 'X', modelo: 'Y' };

  beforeEach(() => {
    dbClient = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.startsWith('INSERT INTO sales')) {
          return Promise.resolve({
            rows: [{ id: 'sale-1', data_venda: '2026-01-01', estado: 'concluida' }],
          });
        }
        // rowCount: 1 simula 1 linha afetada (o caminho feliz) — os testes de
        // corrida sobrepõem isto para 0 (nenhuma linha afetada, condição
        // "AND estado = ..." não bateu certo porque outro pedido já mudou o
        // estado entretanto).
        return Promise.resolve({ rows: [], rowCount: 1 });
      }),
      release: jest.fn(),
    };

    prisma = { stand: { findUniqueOrThrow: jest.fn().mockResolvedValue({ nome: 'Stand X', nif: null, morada: null, contacto: null }) } };
    tenant = {
      getClient: jest.fn().mockResolvedValue(dbClient),
      query: jest.fn().mockResolvedValue([]),
    };
    vehiclesRepo = { findById: jest.fn().mockResolvedValue(VEHICLE_DISPONIVEL) };
    documents = { generateRegistoCompra: jest.fn().mockResolvedValue('https://storage/registo.pdf') };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const storage = { upload: jest.fn() };
    const identityExtraction = { extract: jest.fn() };

    service = new SalesService(prisma, tenant, vehiclesRepo, documents, audit, storage as any, identityExtraction as any);
  });

  describe('create', () => {
    it('rejeita NIF inválido antes de tocar na BD', async () => {
      await expect(service.create(USER, criarDto({ compradorNif: '111111111' }))).rejects.toThrow(BadRequestException);
      expect(tenant.getClient).not.toHaveBeenCalled();
    });

    it('rejeita se o veículo não existir', async () => {
      vehiclesRepo.findById.mockResolvedValueOnce(null);
      await expect(service.create(USER, criarDto())).rejects.toThrow(NotFoundException);
    });

    it('rejeita se o veículo já estiver vendido', async () => {
      vehiclesRepo.findById.mockResolvedValueOnce({ ...VEHICLE_DISPONIVEL, estado: 'vendido' });
      await expect(service.create(USER, criarDto())).rejects.toThrow(BadRequestException);
    });

    it('cria a venda, marca o veículo vendido e devolve o URL do PDF', async () => {
      const resultado = await service.create(USER, criarDto());

      expect(resultado).toEqual({ id: 'sale-1', doc_registo_compra_url: 'https://storage/registo.pdf', vehicle_estado: 'vendido' });
      expect(dbClient.query).toHaveBeenCalledWith('BEGIN');
      expect(dbClient.query).toHaveBeenCalledWith('COMMIT');
      expect(dbClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sales'), expect.any(Array));
      expect(dbClient.query).toHaveBeenCalledWith(
        expect.stringContaining("estado = 'vendido'"),
        expect.arrayContaining(['vehicle-1', 10000]),
      );
      expect(dbClient.release).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        USER.schemaName,
        expect.objectContaining({ entidade: 'sale', acao: 'criado' }),
      );
    });

    // Regressão: antes desta correção, uma falha na geração do PDF (Storage
    // em baixo, carácter que o pdf-lib não sabe codificar) devolvia 500 ao
    // cliente com a venda já feita "às escuras" (veículo marcado vendido sem
    // o utilizador saber se a venda tinha sido registada).
    it('não falha a venda se a geração do PDF rebentar — devolve doc_registo_compra_url null', async () => {
      documents.generateRegistoCompra.mockRejectedValueOnce(new Error('WinAnsi cannot encode'));

      const resultado = await service.create(USER, criarDto());

      expect(resultado).toEqual({ id: 'sale-1', doc_registo_compra_url: null, vehicle_estado: 'vendido' });
      expect(dbClient.query).toHaveBeenCalledWith('COMMIT');
      expect(audit.log).toHaveBeenCalledWith(
        USER.schemaName,
        expect.objectContaining({ entidade: 'sale', valorNovo: expect.objectContaining({ doc_registo_compra_url: null }) }),
      );
    });

    // Regressão: antes desta correção, a verificação de vehicle.estado
    // acontecia numa query separada, antes de abrir a transação — se duas
    // pessoas vendessem o mesmo carro quase ao mesmo tempo, as duas passavam
    // na verificação e criavam 2 vendas "concluídas" para o mesmo veículo.
    it('rejeita (e reverte a transação) se outra venda já tiver marcado o veículo vendido entretanto', async () => {
      dbClient.query.mockImplementation((sql: string) => {
        if (sql.startsWith('INSERT INTO sales')) {
          return Promise.resolve({ rows: [{ id: 'sale-1', data_venda: '2026-01-01', estado: 'concluida' }] });
        }
        if (sql.includes("estado = 'vendido'")) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      await expect(service.create(USER, criarDto())).rejects.toThrow(BadRequestException);
      expect(dbClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(dbClient.query).not.toHaveBeenCalledWith('COMMIT');
    });

    it('reverte a transação (ROLLBACK) se o INSERT/UPDATE falhar', async () => {
      dbClient.query.mockImplementation((sql: string) => {
        if (sql.startsWith('INSERT INTO sales')) throw new Error('falha de BD');
        return Promise.resolve({ rows: [] });
      });

      await expect(service.create(USER, criarDto())).rejects.toThrow('falha de BD');
      expect(dbClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(dbClient.release).toHaveBeenCalled();
    });
  });

  describe('revert', () => {
    it('rejeita se a venda não existir', async () => {
      tenant.query.mockResolvedValueOnce([]);
      await expect(service.revert(USER, 'sale-1')).rejects.toThrow(NotFoundException);
    });

    it('rejeita reverter uma venda já revertida', async () => {
      tenant.query.mockResolvedValueOnce([{ id: 'sale-1', estado: 'revertida', vehicle_id: 'vehicle-1' }]);
      await expect(service.revert(USER, 'sale-1')).rejects.toThrow(BadRequestException);
    });

    it('reverte a venda, invalida os documentos e liberta o veículo', async () => {
      tenant.query.mockResolvedValueOnce([
        { id: 'sale-1', estado: 'concluida', vehicle_id: 'vehicle-1', doc_registo_compra_url: 'https://storage/registo.pdf' },
      ]);

      const resultado = await service.revert(USER, 'sale-1');

      expect(resultado).toEqual({ id: 'sale-1', estado: 'revertida', vehicle_estado: 'disponivel' });
      expect(dbClient.query).toHaveBeenCalledWith(
        expect.stringContaining('doc_registo_compra_url = NULL'),
        ['sale-1'],
      );
      expect(dbClient.query).toHaveBeenCalledWith(
        expect.stringContaining("estado = 'disponivel'"),
        expect.arrayContaining(['vehicle-1']),
      );
      expect(audit.log).toHaveBeenCalledWith(USER.schemaName, expect.objectContaining({ acao: 'revertida' }));
    });

    // Mesmo tipo de regressão do create(): se dois pedidos de revert
    // chegarem quase ao mesmo tempo, só um pode ter efeito.
    it('rejeita se outro pedido já tiver revertido a venda entretanto', async () => {
      tenant.query.mockResolvedValueOnce([
        { id: 'sale-1', estado: 'concluida', vehicle_id: 'vehicle-1', doc_registo_compra_url: null },
      ]);
      dbClient.query.mockImplementation((sql: string) => {
        if (sql.includes("estado = 'revertida'")) return Promise.resolve({ rows: [], rowCount: 0 });
        return Promise.resolve({ rows: [], rowCount: 1 });
      });

      await expect(service.revert(USER, 'sale-1')).rejects.toThrow(BadRequestException);
      expect(dbClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
