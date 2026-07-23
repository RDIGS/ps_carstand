import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { DocumentsService } from '../documents/documents.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { IdentityExtractionService } from '../ocr/identity-extraction.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { isValidNif } from '../common/utils/nif.util';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
    private readonly vehiclesRepo: VehiclesRepository,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly identityExtraction: IdentityExtractionService,
  ) {}

  // Transitório: só usado para pré-preencher o formulário de venda (secção
  // 23) — nunca grava nada, tal como /vehicles/from-dua.
  extractIdentity(fotoFrenteBase64: string, fotoVersoBase64: string) {
    return this.identityExtraction.extract(fotoFrenteBase64, fotoVersoBase64);
  }

  // Só chamado quando o utilizador confirma que as fotos já estavam
  // cortadas/prontas (secção 23) — caso contrário nunca se chega a guardar
  // nenhuma imagem, só os dados extraídos preenchem o formulário.
  async attachIdentityDocuments(
    user: JwtPayload,
    saleId: string,
    tipoDocumento: string,
    frente: Buffer,
    verso: Buffer,
  ) {
    const [sale] = await this.tenant.query<{ id: string; comprador_nome: string; vendedor_id: string }>(
      user.schemaName,
      `SELECT * FROM sales WHERE id = $1`,
      [saleId],
    );
    if (!sale) throw new NotFoundException({ error: 'nao_encontrado', message: 'Venda não encontrada.' });
    if (user.role === 'vendedor' && sale.vendedor_id !== user.sub) {
      throw new ForbiddenException({ error: 'sem_permissao', message: 'Só podes anexar documentos às tuas vendas.' });
    }

    const [frenteUrl, versoUrl] = await Promise.all([
      this.storage.upload(`${user.schemaName}/sales/${saleId}/identificacao-frente.jpg`, frente, 'image/jpeg'),
      this.storage.upload(`${user.schemaName}/sales/${saleId}/identificacao-verso.jpg`, verso, 'image/jpeg'),
    ]);
    const combinadoUrl = await this.documents.generateIdentityDocument(user.schemaName, saleId, {
      tipoDocumento,
      compradorNome: sale.comprador_nome,
      frenteJpeg: frente,
      versoJpeg: verso,
    });

    const [updated] = await this.tenant.query(
      user.schemaName,
      `UPDATE sales SET identificacao_frente_url = $2, identificacao_verso_url = $3, identificacao_documento_combinado_url = $4
       WHERE id = $1 RETURNING *`,
      [saleId, frenteUrl, versoUrl, combinadoUrl],
    );

    await this.audit.log(user.schemaName, {
      entidade: 'sale',
      entidadeId: saleId,
      acao: 'identificacao_anexada',
      valorNovo: { identificacao_documento_combinado_url: combinadoUrl },
      feitoPor: user.sub,
    });

    return updated;
  }

  async create(user: JwtPayload, dto: CreateSaleDto) {
    if (!isValidNif(dto.compradorNif)) {
      throw new BadRequestException({
        error: 'nif_invalido',
        message: 'NIF do comprador inválido.',
        campo: 'compradorNif',
      });
    }

    const vehicle = await this.vehiclesRepo.findById(user.schemaName, dto.vehicleId);
    if (!vehicle) {
      throw new NotFoundException({ error: 'nao_encontrado', message: 'Veículo não encontrado.' });
    }
    if (vehicle.estado === 'vendido') {
      throw new BadRequestException({ error: 'estado_invalido', message: 'Este veículo já foi vendido.' });
    }

    const client = await this.tenant.getClient(user.schemaName);
    let sale: any;
    try {
      await client.query('BEGIN');

      const saleResult = await client.query(
        `INSERT INTO sales (
           vehicle_id, comprador_nome, comprador_nif, comprador_morada, comprador_cp,
           comprador_identificacao_tipo, comprador_identificacao_numero, preco_final,
           vendedor_id, comissao_vendedor
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          dto.vehicleId,
          dto.compradorNome,
          dto.compradorNif,
          dto.compradorMorada ?? null,
          dto.compradorCp ?? null,
          dto.compradorIdentificacaoTipo ?? null,
          dto.compradorIdentificacaoNumero ?? null,
          dto.precoFinal,
          user.sub,
          dto.comissaoVendedor ?? null,
        ],
      );
      sale = saleResult.rows[0];

      await client.query(
        `UPDATE vehicles SET estado = 'vendido', preco_venda_final = $2, atualizado_em = now() WHERE id = $1`,
        [dto.vehicleId, dto.precoFinal],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const stand = await this.prisma.stand.findUniqueOrThrow({ where: { id: user.standId } });
    const docUrl = await this.documents.generateRegistoCompra(user.schemaName, sale.id, {
      stand: { nome: stand.nome, nif: stand.nif, morada: stand.morada },
      vehicle: {
        matricula: vehicle.matricula,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        versao: vehicle.versao,
        chassis: vehicle.chassis,
        categoria: vehicle.categoria,
      },
      sale: {
        compradorNome: dto.compradorNome,
        compradorNif: dto.compradorNif,
        compradorMorada: dto.compradorMorada,
        compradorCp: dto.compradorCp,
        compradorIdentificacaoTipo: dto.compradorIdentificacaoTipo,
        compradorIdentificacaoNumero: dto.compradorIdentificacaoNumero,
        precoFinal: dto.precoFinal,
        dataVenda: new Date(sale.data_venda).toLocaleDateString('pt-PT'),
      },
    });

    await this.tenant.query(user.schemaName, `UPDATE sales SET doc_registo_compra_url = $2 WHERE id = $1`, [
      sale.id,
      docUrl,
    ]);

    await this.audit.log(user.schemaName, {
      entidade: 'sale',
      entidadeId: sale.id,
      acao: 'criado',
      valorNovo: { ...sale, doc_registo_compra_url: docUrl },
      feitoPor: user.sub,
    });
    await this.audit.log(user.schemaName, {
      entidade: 'vehicle',
      entidadeId: dto.vehicleId,
      acao: 'estado_alterado',
      valorAnterior: { estado: vehicle.estado },
      valorNovo: { estado: 'vendido' },
      feitoPor: user.sub,
    });

    return { id: sale.id, doc_registo_compra_url: docUrl, vehicle_estado: 'vendido' };
  }

  async revert(user: JwtPayload, saleId: string) {
    const [sale] = await this.tenant.query(user.schemaName, `SELECT * FROM sales WHERE id = $1`, [saleId]);
    if (!sale) throw new NotFoundException({ error: 'nao_encontrado', message: 'Venda não encontrada.' });
    if (sale.estado !== 'concluida') {
      throw new BadRequestException({ error: 'estado_invalido', message: 'Esta venda já foi revertida.' });
    }

    const client = await this.tenant.getClient(user.schemaName);
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE sales SET estado = 'revertida' WHERE id = $1`, [saleId]);
      await client.query(
        `UPDATE vehicles SET estado = 'disponivel', preco_venda_final = NULL, atualizado_em = now() WHERE id = $1`,
        [sale.vehicle_id],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.audit.log(user.schemaName, {
      entidade: 'sale',
      entidadeId: saleId,
      acao: 'revertida',
      valorAnterior: { estado: 'concluida' },
      valorNovo: { estado: 'revertida' },
      feitoPor: user.sub,
    });

    return { id: saleId, estado: 'revertida', vehicle_estado: 'disponivel' };
  }

  async list(user: JwtPayload, vendedorIdFilter?: string) {
    // Vendedor só vê "as minhas vendas" (V7), mesmo que tente filtrar por outro vendedor_id.
    const vendedorId = user.role === 'vendedor' ? user.sub : vendedorIdFilter;

    if (vendedorId) {
      return this.tenant.query(user.schemaName, `SELECT * FROM sales WHERE vendedor_id = $1 ORDER BY data_venda DESC`, [
        vendedorId,
      ]);
    }
    if (user.role !== 'owner') {
      throw new ForbiddenException({ error: 'sem_permissao', message: 'Só o owner pode ver todas as vendas.' });
    }
    return this.tenant.query(user.schemaName, `SELECT * FROM sales ORDER BY data_venda DESC`);
  }
}
