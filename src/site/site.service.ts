import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { CamposMarcacao, StandPublico, VeiculoPublico } from './site-html';

// Só estes estados aparecem no site; o resto (pendente de aprovação,
// rejeitado, vendido) nunca é público.
const ESTADOS_PUBLICOS = ['disponivel', 'reservado'];

// Colunas explicitamente públicas — NUNCA `v.*`. Fica de fora: preço de
// compra/final, chassis, matrícula, quem criou/aprovou, origem, dias em
// stock, dados de importação, despesas (§21: só `foto_viatura` é pública).
const COLUNAS_PUBLICAS = `
  v.id, v.marca, v.modelo, v.versao, v.kms,
  EXTRACT(YEAR FROM COALESCE(v.data_primeira_matricula_original, v.data_primeira_matricula))::int AS ano,
  v.combustivel, v.potencia_kw, v.cilindrada, v.cor, v.num_lugares, v.categoria,
  v.preco_venda_recomendado AS preco, v.estado,
  (SELECT url FROM vehicle_photos p WHERE p.vehicle_id = v.id AND p.tipo = 'foto_viatura'
    ORDER BY p.criado_em ASC LIMIT 1) AS foto_capa`;

// Máximo de pedidos aceites por stand em 24h — trava abusos mesmo que o
// limite por IP falhe (ex.: muitos IPs diferentes).
const MAX_PEDIDOS_DIA = 50;
const DIAS_MAXIMOS_ANTECEDENCIA = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface StandResolvido extends StandPublico {
  schemaName: string;
}

@Injectable()
export class SiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantService,
  ) {}

  /** `null` se o endereço não existe, o site está desligado ou a subscrição não está ativa. */
  async resolverStand(slug: string): Promise<StandResolvido | null> {
    const stand = await this.prisma.stand.findUnique({ where: { slug } });
    if (!stand || !stand.siteAtivo || !['ativo', 'em_carencia'].includes(stand.tokenEstado)) return null;
    return {
      nome: stand.nome,
      slug,
      contacto: stand.contacto,
      morada: stand.morada,
      redesSociais: stand.redesSociais,
      logoUrl: stand.logoUrl,
      schemaName: stand.schemaName,
    };
  }

  listarVeiculos(schemaName: string): Promise<VeiculoPublico[]> {
    return this.tenant.query(
      schemaName,
      `SELECT ${COLUNAS_PUBLICAS} FROM vehicles v
       WHERE v.estado = ANY($1)
       ORDER BY (v.estado = 'reservado'), v.criado_em DESC
       LIMIT 200`,
      [ESTADOS_PUBLICOS],
    );
  }

  async obterVeiculo(schemaName: string, id: string): Promise<{ veiculo: VeiculoPublico; fotos: string[] } | null> {
    if (!UUID_RE.test(id)) return null;
    const [veiculo] = await this.tenant.query(
      schemaName,
      `SELECT ${COLUNAS_PUBLICAS} FROM vehicles v WHERE v.id = $1 AND v.estado = ANY($2)`,
      [id, ESTADOS_PUBLICOS],
    );
    if (!veiculo) return null;
    const fotos = await this.tenant.query(
      schemaName,
      `SELECT url FROM vehicle_photos WHERE vehicle_id = $1 AND tipo = 'foto_viatura' ORDER BY criado_em ASC LIMIT 30`,
      [id],
    );
    return { veiculo, fotos: fotos.map((f: { url: string }) => f.url) };
  }

  /** Dia de hoje e limite máximo (formato do <input type="date">), em hora de Lisboa. */
  limitesData(): { dataMin: string; dataMax: string } {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' });
    const agora = Date.now();
    return {
      dataMin: fmt.format(agora),
      dataMax: fmt.format(agora + DIAS_MAXIMOS_ANTECEDENCIA * 86_400_000),
    };
  }

  lerCampos(body: Record<string, unknown>): CamposMarcacao & { website: string; consentimento: string } {
    const s = (k: string, max: number) => (typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : '');
    return {
      nome: s('nome', 100),
      telefone: s('telefone', 30),
      email: s('email', 120),
      data: s('data', 10),
      hora: s('hora', 5),
      mensagem: s('mensagem', 1000),
      vehicleId: s('vehicleId', 36),
      website: s('website', 200),
      consentimento: s('consentimento', 10),
    };
  }

  /**
   * Valida e grava o pedido. Devolve a lista de erros para mostrar ao
   * visitante (vazia = gravado). O campo-armadilha preenchido finge sucesso
   * sem gravar, para o robô não perceber que foi apanhado.
   */
  async criarPedido(schemaName: string, campos: ReturnType<SiteService['lerCampos']>): Promise<string[]> {
    if (campos.website) return [];

    const erros: string[] = [];
    if ((campos.nome ?? '').length < 2) erros.push('Indica o teu nome.');
    if (!campos.telefone && !campos.email) erros.push('Indica pelo menos o telefone ou o email.');
    if (campos.telefone && !/^[+\d][\d\s().-]{7,}$/.test(campos.telefone)) erros.push('O telefone não parece válido.');
    if (campos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.email)) erros.push('O email não parece válido.');
    if (campos.consentimento !== 'sim') erros.push('É preciso autorizar o contacto para enviar o pedido.');

    let dataHora: Date | null = null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.data ?? '') || !/^\d{2}:\d{2}$/.test(campos.hora ?? '')) {
      erros.push('Escolhe o dia e a hora da visita.');
    } else if (campos.hora! < '09:00' || campos.hora! > '20:00') {
      erros.push('Escolhe uma hora entre as 09:00 e as 20:00.');
    } else {
      // Converte a hora local (Lisboa, com verão/inverno) num instante exato.
      const [{ ts }] = await this.tenant.query(
        schemaName,
        `SELECT (($1 || ' ' || $2)::timestamp AT TIME ZONE 'Europe/Lisbon') AS ts`,
        [campos.data, campos.hora],
      );
      dataHora = new Date(ts);
      const agora = Date.now();
      if (dataHora.getTime() < agora + 30 * 60_000) erros.push('Escolhe um dia e hora no futuro.');
      else if (dataHora.getTime() > agora + (DIAS_MAXIMOS_ANTECEDENCIA + 1) * 86_400_000) {
        erros.push(`Só é possível marcar até ${DIAS_MAXIMOS_ANTECEDENCIA} dias de antecedência.`);
      }
    }
    if (erros.length) return erros;

    const [{ total }] = await this.tenant.query(
      schemaName,
      `SELECT count(*)::int AS total FROM visit_requests WHERE criado_em > now() - interval '24 hours'`,
    );
    if (total >= MAX_PEDIDOS_DIA) {
      return ['De momento não é possível receber mais pedidos online. Contacta o stand por telefone.'];
    }

    // Viatura só é ligada se existir e estiver visível no site.
    let vehicleId: string | null = null;
    if (campos.vehicleId && UUID_RE.test(campos.vehicleId)) {
      const [v] = await this.tenant.query(
        schemaName,
        `SELECT id FROM vehicles WHERE id = $1 AND estado = ANY($2)`,
        [campos.vehicleId, ESTADOS_PUBLICOS],
      );
      vehicleId = v?.id ?? null;
    }

    await this.tenant.query(
      schemaName,
      `INSERT INTO visit_requests (vehicle_id, nome, telefone, email, data_hora, mensagem, consentimento_em)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      [vehicleId, campos.nome, campos.telefone || null, campos.email || null, dataHora, campos.mensagem || null],
    );
    return [];
  }
}
