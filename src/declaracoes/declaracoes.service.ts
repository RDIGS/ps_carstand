import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { EmitirDeclaracaoDto } from './dto/emitir-declaracao.dto';

/** Tipos que se emitem a pedido; a de venda é gerada no próprio fluxo de venda. */
export const TIPOS_A_PEDIDO = ['compra', 'circulacao', 'caracteristicas'] as const;
export type TipoAPedido = (typeof TIPOS_A_PEDIDO)[number];

/**
 * Declarações do veículo (secção nova, 2026-10-26): compra (stand compra ao
 * cliente — a app propõe-na ao inserir o veículo), circulação e
 * características (quando o utilizador quiser). Cada emissão fica no
 * histórico `documentos_gerados`.
 */
@Injectable()
export class DeclaracoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
    private readonly vehicles: VehiclesService,
  ) {}

  async emitir(user: JwtPayload, vehicleId: string, tipo: string, dto: EmitirDeclaracaoDto) {
    if (!(TIPOS_A_PEDIDO as readonly string[]).includes(tipo)) {
      throw new BadRequestException({ error: 'pedido_invalido', message: 'Tipo de declaração desconhecido.' });
    }
    // Mesma verificação de acesso da ficha do veículo (vendedor não vê vendidos).
    const veiculo = await this.vehicles.findOne(user, vehicleId);
    const stand = await this.prisma.stand.findUniqueOrThrow({ where: { id: user.standId } });

    const url = await this.documents.gerarDeclaracao(user.schemaName, vehicleId, {
      tipo: tipo as TipoAPedido,
      stand,
      veiculo,
      pessoa: { nome: dto.nome.trim(), morada: dto.morada?.trim() || null, nif: dto.nif?.trim() || null },
      // Na de compra, o valor é o preço a que o stand comprou o veículo.
      preco: tipo === 'compra' && veiculo.preco_compra != null ? Number(veiculo.preco_compra) : null,
      pneusDianteiros: dto.pneusDianteiros?.trim() || null,
      pneusTraseiros: dto.pneusTraseiros?.trim() || null,
    });

    const [registo] = await this.tenant.query(
      user.schemaName,
      `INSERT INTO documentos_gerados (vehicle_id, tipo, url, cliente_nome, criado_por)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [vehicleId, tipo, url, dto.nome.trim(), user.sub],
    );
    await this.audit.log(user.schemaName, {
      entidade: 'vehicle',
      entidadeId: vehicleId,
      acao: `declaracao_${tipo}`,
      valorNovo: { documento_id: registo.id },
      feitoPor: user.sub,
    });
    return registo;
  }

  async listar(user: JwtPayload, vehicleId: string) {
    await this.vehicles.findOne(user, vehicleId);
    return this.tenant.query(
      user.schemaName,
      `SELECT id, tipo, url, cliente_nome, sale_id, criado_em FROM documentos_gerados
       WHERE vehicle_id = $1 ORDER BY criado_em DESC`,
      [vehicleId],
    );
  }
}
