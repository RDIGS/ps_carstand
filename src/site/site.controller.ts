import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SiteService, StandResolvido } from './site.service';
import { paginaFicha, paginaLista, paginaMarcar, paginaNaoEncontrada, paginaObrigado, VeiculoPublico } from './site-html';

// Tipo real da imagem pelos primeiros bytes (o logótipo é gravado como .jpg
// mas pode ser PNG/WebP).
function tipoImagem(b: Buffer): string {
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return 'image/jpeg';
}

// Site público do stand (secção nova, 2026-10-25). O visitante vê estas
// páginas em `ps-carstand-app.onrender.com/:slug` — uma regra de rewrite do
// Static Site no Render encaminha para `/site/:slug` aqui. Os links dentro
// das páginas apontam sempre para SITE_PUBLIC_BASE_URL, para continuarem no
// domínio da app.
@Public()
@Controller()
export class SiteController {
  constructor(
    private readonly site: SiteService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private get base(): string {
    return this.config.get<string>('SITE_PUBLIC_BASE_URL', 'https://ps-carstand-app.onrender.com').replace(/\/$/, '');
  }

  // Cabeçalhos de segurança: o HTML já é todo escapado e não tem JS, isto é
  // defesa extra — nada de scripts, imagens só do próprio site, formulários
  // só para o próprio site, não pode ser metido numa iframe de outro site.
  private html(res: Response, status: number, corpo: string, cache = false) {
    const origem = new URL(this.base).origin;
    res
      .status(status)
      .type('html')
      .set('Cache-Control', cache ? 'public, max-age=60' : 'no-store')
      .set(
        'Content-Security-Policy',
        `default-src 'none'; img-src 'self' ${origem}; style-src 'unsafe-inline'; form-action 'self' ${origem}; base-uri 'none'; frame-ancestors 'none'`,
      )
      .set('X-Content-Type-Options', 'nosniff')
      .set('Referrer-Policy', 'strict-origin-when-cross-origin')
      .send(corpo);
  }

  // Fotos e logótipo saem por endereços do próprio site (`/<slug>/foto/<id>`,
  // `/<slug>/logo`) — o visitante nunca vê o Storage nem a sua estrutura.
  private standPublico(stand: StandResolvido): StandResolvido {
    return { ...stand, logoUrl: stand.logoUrl ? `${this.base}/${encodeURIComponent(stand.slug)}/logo` : null };
  }

  private fotoUrl(slug: string, fotoId: string): string {
    return `${this.base}/${encodeURIComponent(slug)}/foto/${fotoId}`;
  }

  private comFotos(slug: string, veiculos: VeiculoPublico[]): VeiculoPublico[] {
    return veiculos.map((v) => ({ ...v, foto_capa: v.foto_capa ? this.fotoUrl(slug, v.foto_capa) : null }));
  }

  private async imagem(res: Response, ref: string | null) {
    const bytes = ref ? await this.storage.descarregar(ref) : null;
    if (!bytes) return res.status(404).set('Cache-Control', 'no-store').send();
    res
      .status(200)
      .type(tipoImagem(bytes))
      .set('Cache-Control', 'public, max-age=3600')
      .set('X-Content-Type-Options', 'nosniff')
      .send(bytes);
  }

  // Limite alto: uma página de lista pede uma imagem por carro.
  @Get('site/:slug/foto/:fotoId')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async foto(@Param('slug') slug: string, @Param('fotoId') fotoId: string, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    return this.imagem(res, stand ? await this.site.refFotoPublica(stand.schemaName, fotoId) : null);
  }

  @Get('site/:slug/logo')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async logo(@Param('slug') slug: string, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    return this.imagem(res, stand?.logoUrl ?? null);
  }

  // Usado pelo pedido periódico que mantém o Render e o Supabase acordados
  // (faz uma query real).
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }

  @Get('site/:slug')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async lista(@Param('slug') slug: string, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    if (!stand) return this.html(res, 404, paginaNaoEncontrada());
    const veiculos = await this.site.listarVeiculos(stand.schemaName);
    this.html(res, 200, paginaLista(this.base, this.standPublico(stand), this.comFotos(slug, veiculos)), true);
  }

  @Get('site/:slug/v/:vehicleId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async ficha(@Param('slug') slug: string, @Param('vehicleId') vehicleId: string, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    const resultado = stand ? await this.site.obterVeiculo(stand.schemaName, vehicleId) : null;
    if (!stand || !resultado) return this.html(res, 404, paginaNaoEncontrada());
    this.html(res, 200, paginaFicha(
        this.base,
        this.standPublico(stand),
        resultado.veiculo,
        resultado.fotos.map((id) => this.fotoUrl(slug, id)),
      ), true);
  }

  @Get('site/:slug/marcar')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async formulario(@Param('slug') slug: string, @Query('v') vehicleId: string | undefined, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    if (!stand) return this.html(res, 404, paginaNaoEncontrada());
    const veiculos = await this.site.listarVeiculos(stand.schemaName);
    this.html(res, 200, paginaMarcar(this.base, this.standPublico(stand), veiculos, { vehicleId }, [], this.site.limitesData()));
  }

  // Corpo é um objeto simples (não um DTO) de propósito: os erros voltam ao
  // visitante dentro do próprio formulário, não como JSON de erro.
  @Post('site/:slug/marcar')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  async marcar(@Param('slug') slug: string, @Body() body: Record<string, unknown>, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    if (!stand) return this.html(res, 404, paginaNaoEncontrada());
    const campos = this.site.lerCampos(body ?? {});
    const erros = await this.site.criarPedido(stand.schemaName, campos);
    if (erros.length) {
      const veiculos = await this.site.listarVeiculos(stand.schemaName);
      return this.html(res, 400, paginaMarcar(this.base, this.standPublico(stand), veiculos, campos, erros, this.site.limitesData()));
    }
    res.redirect(303, `${this.base}/${encodeURIComponent(stand.slug)}/obrigado`);
  }

  @Get('site/:slug/obrigado')
  async obrigado(@Param('slug') slug: string, @Res() res: Response) {
    const stand = await this.site.resolverStand(slug);
    if (!stand) return this.html(res, 404, paginaNaoEncontrada());
    this.html(res, 200, paginaObrigado(this.base, this.standPublico(stand)));
  }
}
