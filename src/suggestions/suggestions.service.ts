import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/types/jwt-payload.interface';

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(user: JwtPayload, texto: string) {
    return this.prisma.suggestion.create({
      data: { standId: user.standId, personId: user.sub, texto },
    });
  }

  // Painel de super-admin: todas as sugestões de todos os stands, mais
  // recentes primeiro, com o nome do stand/pessoa para dar contexto.
  list() {
    return this.prisma.suggestion.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        stand: { select: { nome: true } },
        person: { select: { nome: true, email: true } },
      },
    });
  }
}
