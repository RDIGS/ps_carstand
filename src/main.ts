import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();
  // O site público (/site/*) tem limites por visitante: sem isto o backend
  // veria sempre o IP do proxy do Render e todos os visitantes partilhariam o
  // mesmo limite. Número de proxies confiáveis à frente (Cloudflare + Render),
  // configurável porque depende do caminho; ver GET /health (campo ip).
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 2));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  // Fallback de storage local (ver StorageService) enquanto o Supabase Storage não está configurado.
  app.useStaticAssets(join(process.cwd(), 'storage'), { prefix: '/storage' });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
