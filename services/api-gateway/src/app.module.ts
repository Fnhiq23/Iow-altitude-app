import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { Database } from './database';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './security';
import {
  MissionsController,
  AssetsController,
  IncidentsController,
  AuditController,
} from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  controllers: [
    HealthController,
    AuthController,
    MissionsController,
    AssetsController,
    IncidentsController,
    AuditController,
  ],
  providers: [Database, AuthService, JwtAuthGuard, ResourcesService],
})
export class AppModule {}
