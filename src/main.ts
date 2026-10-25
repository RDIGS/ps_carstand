import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

// Gamas publicadas pela Cloudflare (https://www.cloudflare.com/ips/), que está
// à frente do Render.
const CLOUDFLARE_IPS = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();
  // O site público (/site/*) tem limites por visitante: sem isto o backend
  // veria o IP de um proxy e todos os visitantes partilhariam o mesmo limite.
  // Confia só em proxies conhecidos (rede interna do Render + Cloudflare): o
  // IP do visitante é o primeiro endereço desconhecido a contar do fim, nos
  // dois caminhos (direto, ou pelo rewrite do domínio da app, que tem mais
  // saltos). Um número fixo de saltos não serve aos dois e deixaria
  // falsificar o X-Forwarded-For no caminho mais curto.
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal', ...CLOUDFLARE_IPS]);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());

  // Fallback de storage local (ver StorageService) enquanto o Supabase Storage não está configurado.
  app.useStaticAssets(join(process.cwd(), 'storage'), { prefix: '/storage' });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
