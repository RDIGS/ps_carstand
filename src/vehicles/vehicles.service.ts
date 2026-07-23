import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehiclesRepository } from './vehicles.repository';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto, CAMPOS_EDITAVEIS_POR_VENDEDOR } from './dto/update-vehicle.dto';
import { JwtPayload } from '../common/types/jwt-payload.interface';

const ESTADOS_VISIVEIS_VENDEDOR = ['disponivel', 'reservado', 'pendente_aprovacao'];

@Injectable()
export class VehiclesService {
  constructor(
    private readonly repo: VehiclesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async list(user: JwtPayload, estadoQuery: string | undefined, page: number, limit: number) {
    let estados = estadoQuery ? estadoQuery.split(',').map((e) => e.trim()) : ['disponivel', 'reservado'];

    // Vendedor nunca vê "vendido", mesmo que peça explicitamente no filtro (secção 4/12.4).
    if (user.role === 'vendedor') {
      estados = estados.filter((e) => ESTADOS_VISIVEIS_VENDEDOR.includes(e));
      if (estados.length === 0) estados = ['disponivel', 'reservado'];
    }

    const { rows, totalItems } = await this.repo.findMany(user.schemaName, { estados, page, limit });
    return {
      data: rows,
      page,
      total_pages: Math.max(1, Math.ceil(totalItems / limit)),
      total_items: totalItems,
    };
  }

  async findOne(user: JwtPayload, id: string) {
    const vehicle = await this.repo.findById(user.schemaName, id);
    if (!vehicle) throw new NotFoundException({ error: 'nao_encontrado', message: 'Veículo não encontrado.' });

    if (user.role === 'vendedor' && !ESTADOS_VISIVEIS_VENDEDOR.includes(vehicle.estado)) {
      throw new NotFoundException({ error: 'nao_encontrado', message: 'Veículo não encontrado.' });
    }
    return vehicle;
  }

  async create(user: JwtPayload, dto: CreateVehicleDto, explicitId?: string) {
    const stand = await this.prisma.stand.findUniqueOrThrow({ where: { id: user.standId } });

    if (user.role === 'vendedor' && !stand.vendedorPodeAdicionar) {
      throw new ForbiddenException({
        error: 'sem_permissao',
        message: 'Só o owner pode adicionar veículos neste stand.',
      });
    }

    const precisaAprovacao = user.role === 'vendedor' && stand.vendedorPrecisaAprovacao;
    const estadoInicial = precisaAprovacao ? 'pendente_aprovacao' : 'disponivel';

    const vehicle = await this.repo.insert(user.schemaName, explicitId ?? null, dto, user.sub, estadoInicial);
    if (!vehicle) {
      throw new BadRequestException({
        error: 'veiculo_ja_confirmado',
        message: 'Este veículo já foi confirmado anteriormente.',
      });
    }

    await this.audit.log(user.schemaName, {
      entidade: 'vehicle',
      entidadeId: vehicle.id,
      acao: 'criado',
      valorNovo: vehicle,
      feitoPor: user.sub,
    });

    return vehicle;
  }

  async update(user: JwtPayload, id: string, dto: UpdateVehicleDto) {
    const stand = await this.prisma.stand.findUniqueOrThrow({ where: { id: user.standId } });
    const existing = await this.findOne(user, id);

    let fields: Record<string, unknown> = {
      versao: dto.versao,
      cor: dto.cor,
      kms: dto.kms,
      preco_compra: dto.precoCompra,
      preco_venda_recomendado: dto.precoVendaRecomendado,
    };

    if (user.role === 'vendedor') {
      if (!stand.vendedorPodeEditarPrecoKms) {
        throw new ForbiddenException({
          error: 'sem_permissao',
          message: 'Só o owner pode editar preço/kms neste stand.',
        });
      }
      // Vendedor só pode alterar os campos explicitamente permitidos (secção 4).
      const camposDto: Record<string, unknown> = { kms: dto.kms, precoCompra: dto.precoCompra, precoVendaRecomendado: dto.precoVendaRecomendado };
      fields = {};
      for (const campo of CAMPOS_EDITAVEIS_POR_VENDEDOR) {
        if (camposDto[campo] !== undefined) {
          fields[this.toSnakeCase(campo)] = camposDto[campo];
        }
      }
    }

    fields = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    const updated = await this.repo.update(user.schemaName, id, fields);
    await this.audit.log(user.schemaName, {
      entidade: 'vehicle',
      entidadeId: id,
      acao: 'atualizado',
      valorAnterior: existing,
      valorNovo: updated,
      feitoPor: user.sub,
    });
    return updated;
  }

  async approve(user: JwtPayload, id: string) {
    const vehicle = await this.findOne(user, id);
    if (vehicle.estado !== 'pendente_aprovacao') {
      throw new BadRequestException({ error: 'estado_invalido', message: 'Este veículo não está pendente de aprovação.' });
    }
    const updated = await this.repo.setEstado(user.schemaName, id, 'disponivel', user.sub);
    await this.audit.log(user.schemaName, { entidade: 'vehicle', entidadeId: id, acao: 'aprovado', valorNovo: updated, feitoPor: user.sub });
    return updated;
  }

  async reject(user: JwtPayload, id: string) {
    const vehicle = await this.findOne(user, id);
    if (vehicle.estado !== 'pendente_aprovacao') {
      throw new BadRequestException({ error: 'estado_invalido', message: 'Este veículo não está pendente de aprovação.' });
    }
    const updated = await this.repo.setEstado(user.schemaName, id, 'rejeitado', user.sub);
    await this.audit.log(user.schemaName, { entidade: 'vehicle', entidadeId: id, acao: 'rejeitado', valorNovo: updated, feitoPor: user.sub });
    return updated;
  }

  async setReservado(user: JwtPayload, id: string, reservado: boolean) {
    const vehicle = await this.findOne(user, id);
    const estadoAtual = vehicle.estado;
    const novoEstado = reservado ? 'reservado' : 'disponivel';

    const transicaoValida =
      (reservado && estadoAtual === 'disponivel') || (!reservado && estadoAtual === 'reservado');
    if (!transicaoValida) {
      throw new BadRequestException({
        error: 'estado_invalido',
        message: `Não é possível marcar como ${novoEstado} a partir de "${estadoAtual}".`,
      });
    }

    const updated = await this.repo.setEstado(user.schemaName, id, novoEstado);
    await this.audit.log(user.schemaName, {
      entidade: 'vehicle',
      entidadeId: id,
      acao: 'estado_alterado',
      valorAnterior: { estado: estadoAtual },
      valorNovo: { estado: novoEstado },
      feitoPor: user.sub,
    });
    return updated;
  }

  async addExpense(user: JwtPayload, vehicleId: string, categoria: string, descricao: string | undefined, valor: number) {
    await this.findOne(user, vehicleId);
    const expense = await this.repo.addExpense(user.schemaName, vehicleId, categoria, descricao ?? null, valor, user.sub);
    await this.audit.log(user.schemaName, {
      entidade: 'vehicle_expense',
      entidadeId: expense.id,
      acao: 'criado',
      valorNovo: expense,
      feitoPor: user.sub,
    });
    return expense;
  }

  // Só chamado quando o utilizador confirma que as fotos do DUA já estavam
  // cortadas/prontas (mesma regra do CC, secção 23) — caso contrário nunca é
  // chamado e as fotos do DUA nunca chegam a ser guardadas, só os dados
  // extraídos preencheram o formulário do veículo.
  async addDuaPhotos(user: JwtPayload, vehicleId: string, frente: Buffer, verso: Buffer) {
    await this.findOne(user, vehicleId);

    const [frenteUrl, versoUrl] = await Promise.all([
      this.storage.upload(`${user.schemaName}/vehicles/${vehicleId}/dua-frente.jpg`, frente, 'image/jpeg'),
      this.storage.upload(`${user.schemaName}/vehicles/${vehicleId}/dua-verso.jpg`, verso, 'image/jpeg'),
    ]);

    const [frentePhoto, versoPhoto] = await Promise.all([
      this.repo.addPhoto(user.schemaName, vehicleId, frenteUrl, 'dua_frente'),
      this.repo.addPhoto(user.schemaName, vehicleId, versoUrl, 'dua_verso'),
    ]);

    return [frentePhoto, versoPhoto];
  }

  private toSnakeCase(camel: string): string {
    return camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
