import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plataforma } from '@prisma/client';
import { UpsertAppVersionDto } from './dto/upsert-app-version.dto';
import { isBelowMinimum, parseMajorMinor } from './version-compare.util';

const PLATAFORMAS_VALIDAS: readonly string[] = ['windows', 'android', 'ios_pwa', 'macos_pwa'];

@Injectable()
export class AppVersionService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /app/version-check (secção 22) — chamado no arranque da app, antes
  // de qualquer outro pedido, por isso é sempre @Public().
  async versionCheck(plataformaRaw: string | undefined, versaoAtualRaw: string | undefined) {
    if (!plataformaRaw || !PLATAFORMAS_VALIDAS.includes(plataformaRaw)) {
      throw new BadRequestException({
        error: 'plataforma_invalida',
        message: 'plataforma deve ser uma de: windows, android, ios_pwa, macos_pwa.',
        campo: 'plataforma',
      });
    }
    if (!versaoAtualRaw || !parseMajorMinor(versaoAtualRaw)) {
      throw new BadRequestException({
        error: 'versao_invalida',
        message: 'versao_atual deve seguir o formato X.Y.Z.',
        campo: 'versao_atual',
      });
    }

    const config = await this.prisma.appVersion.findUnique({
      where: { plataforma: plataformaRaw as Plataforma },
    });

    // Sem configuração para a plataforma ainda (ex.: acabou de ser adicionada
    // e o super-admin ainda não definiu a versão mínima) — nunca bloqueia por
    // omissão, só não há aviso de recomendada.
    if (!config) {
      return { obrigatoria: false, versao_minima_obrigatoria: null, versao_recomendada: null, changelog_url: null };
    }

    return {
      obrigatoria: isBelowMinimum(versaoAtualRaw, config.versaoMinimaObrigatoria),
      versao_minima_obrigatoria: config.versaoMinimaObrigatoria,
      versao_recomendada: config.versaoRecomendada,
      changelog_url: config.changelogUrl,
    };
  }

  // Admin (super-admin, secção 22): define/atualiza a versão mínima por
  // plataforma. 1 linha por plataforma — upsert, não histórico.
  list() {
    return this.prisma.appVersion.findMany({ orderBy: { plataforma: 'asc' } });
  }

  upsert(plataformaRaw: string, dto: UpsertAppVersionDto) {
    if (!PLATAFORMAS_VALIDAS.includes(plataformaRaw)) {
      throw new BadRequestException({
        error: 'plataforma_invalida',
        message: 'plataforma deve ser uma de: windows, android, ios_pwa, macos_pwa.',
        campo: 'plataforma',
      });
    }
    const plataforma = plataformaRaw as Plataforma;
    return this.prisma.appVersion.upsert({
      where: { plataforma },
      create: {
        plataforma,
        versaoMinimaObrigatoria: dto.versaoMinimaObrigatoria,
        versaoRecomendada: dto.versaoRecomendada,
        changelogUrl: dto.changelogUrl,
      },
      update: {
        versaoMinimaObrigatoria: dto.versaoMinimaObrigatoria,
        versaoRecomendada: dto.versaoRecomendada,
        changelogUrl: dto.changelogUrl,
      },
    });
  }
}
