import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../tenant/tenant.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';
import { CrawlerAdapter, CrawlerListagem } from './crawler-adapter.interface';
import { StandVirtualAdapter } from './adapters/standvirtual.adapter';
import { OlxAdapter } from './adapters/olx.adapter';
import { CustoJustoAdapter } from './adapters/custojusto.adapter';

export interface MarketEstimateRow {
  fonte: string;
  preco_medio: string | null;
  preco_min: string | null;
  preco_max: string | null;
  num_anuncios_comparados: number | null;
  consultado_em: string;
  // Só vem preenchida numa pesquisa fresca (nunca persistida em
  // `market_estimates`) — numa resposta de cache, a app sabe que não há
  // amostra pelo array vazio e pode oferecer "atualizar" para a obter.
  amostra: CrawlerListagem[];
}

export interface EstimateOptions {
  janelaAmpliada?: boolean;
  forcarAtualizacao?: boolean;
}

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly adapters: CrawlerAdapter[];

  constructor(
    private readonly tenant: TenantService,
    private readonly config: ConfigService,
    standvirtual: StandVirtualAdapter,
    olx: OlxAdapter,
    custojusto: CustoJustoAdapter,
  ) {
    this.adapters = [standvirtual, olx, custojusto];
  }

  async getEstimateForVehicle(user: JwtPayload, vehicleId: string, options: EstimateOptions = {}) {
    const [vehicle] = await this.tenant.query<{
      id: string;
      marca: string;
      modelo: string;
      kms: number;
      data_primeira_matricula: string | null;
    }>(user.schemaName, `SELECT id, marca, modelo, kms, data_primeira_matricula FROM vehicles WHERE id = $1`, [
      vehicleId,
    ]);
    if (!vehicle) {
      throw new NotFoundException({ error: 'nao_encontrado', message: 'Veículo não encontrado.' });
    }

    const ttlHours = Number(this.config.get('CRAWLER_CACHE_TTL_HOURS', 48));
    const ano = vehicle.data_primeira_matricula ? new Date(vehicle.data_primeira_matricula).getFullYear() : undefined;

    const results = await Promise.allSettled(
      this.adapters.map((adapter) => this.getOrRefreshEstimate(user.schemaName, vehicle, adapter, ttlHours, ano, options)),
    );

    const estimates: MarketEstimateRow[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        estimates.push(result.value);
      } else if (result.status === 'rejected') {
        this.logger.warn(`Fonte "${this.adapters[i].fonte}" indisponível: ${result.reason?.message ?? result.reason}`);
      }
    });

    return { estimates, agregado: this.aggregate(estimates) };
  }

  private async getOrRefreshEstimate(
    schemaName: string,
    vehicle: { id: string; marca: string; modelo: string; kms: number },
    adapter: CrawlerAdapter,
    ttlHours: number,
    ano: number | undefined,
    options: EstimateOptions,
  ): Promise<MarketEstimateRow | null> {
    if (!options.forcarAtualizacao) {
      const cached = await this.tenant.query<Omit<MarketEstimateRow, 'amostra'>>(
        schemaName,
        `SELECT fonte, preco_medio, preco_min, preco_max, num_anuncios_comparados, consultado_em
         FROM market_estimates
         WHERE vehicle_id = $1 AND fonte = $2 AND consultado_em > now() - ($3 || ' hours')::interval
         ORDER BY consultado_em DESC LIMIT 1`,
        [vehicle.id, adapter.fonte, ttlHours],
      );
      // Uma pesquisa em cache nunca guardou a amostra de anúncios (não é
      // persistida, ver comentário em MarketEstimateRow) — a app oferece
      // "atualizar" (forcarAtualizacao) quando o utilizador quiser vê-la.
      if (cached[0]) return { ...cached[0], amostra: [] };
    }

    const result = await adapter.search({
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      kms: vehicle.kms,
      ano,
      janelaAmpliada: options.janelaAmpliada,
    });

    const [inserted] = await this.tenant.query<Omit<MarketEstimateRow, 'amostra'>>(
      schemaName,
      `INSERT INTO market_estimates (vehicle_id, fonte, preco_medio, preco_min, preco_max, num_anuncios_comparados)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING fonte, preco_medio, preco_min, preco_max, num_anuncios_comparados, consultado_em`,
      [vehicle.id, adapter.fonte, result.precoMedio, result.precoMin, result.precoMax, result.numAnunciosComparados],
    );
    return inserted ? { ...inserted, amostra: result.amostra } : null;
  }

  private aggregate(estimates: MarketEstimateRow[]) {
    const validos = estimates.filter((e) => e.preco_medio !== null);
    if (validos.length === 0) {
      return { preco_medio: null, preco_min: null, preco_max: null, num_fontes: 0, num_anuncios: 0 };
    }
    const medios = validos.map((e) => Number(e.preco_medio));
    const mins = validos.map((e) => Number(e.preco_min ?? e.preco_medio));
    const maxs = validos.map((e) => Number(e.preco_max ?? e.preco_medio));
    const numAnuncios = validos.reduce((acc, e) => acc + (e.num_anuncios_comparados ?? 0), 0);

    return {
      preco_medio: Math.round(medios.reduce((a, b) => a + b, 0) / medios.length),
      preco_min: Math.min(...mins),
      preco_max: Math.max(...maxs),
      num_fontes: validos.length,
      num_anuncios: numAnuncios,
    };
  }
}
