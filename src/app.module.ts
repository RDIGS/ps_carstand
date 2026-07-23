import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { StorageModule } from './storage/storage.module';

import { AuthModule } from './auth/auth.module';
import { AppVersionModule } from './app-version/app-version.module';
import { StandsModule } from './stands/stands.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ChecklistModule } from './checklist/checklist.module';
import { LegalModule } from './legal/legal.module';
import { SalesModule } from './sales/sales.module';
import { TeamModule } from './team/team.module';
import { FinanceModule } from './finance/finance.module';
import { AuditModule } from './audit/audit.module';
import { OcrModule } from './ocr/ocr.module';
import { CrawlersModule } from './crawlers/crawlers.module';
import { DocumentsModule } from './documents/documents.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { StandThrottlerGuard } from './common/guards/stand-throttler.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Rate limit geral (secção 21): 100 pedidos/minuto por stand.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    PrismaModule,
    TenantModule,
    StorageModule,

    AuthModule,
    AppVersionModule,
    StandsModule,
    OcrModule,
    CrawlersModule,
    DocumentsModule,
    VehiclesModule,
    ChecklistModule,
    LegalModule,
    SalesModule,
    TeamModule,
    FinanceModule,
    AuditModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: StandThrottlerGuard },
  ],
})
export class AppModule {}
