import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Actor, JwtAuthGuard, Roles } from './security';
import { ResourcesService } from './resources.service';

class BaseResourceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mission_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  priority?: string;

  @IsOptional()
  @IsString()
  planned_start_at?: string;

  @IsOptional()
  @IsString()
  planned_end_at?: string;

  @IsOptional()
  @IsString()
  location_text?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assignee_id?: string;

  @IsOptional()
  @IsUUID()
  asset_id?: string;

  @IsOptional()
  @IsIn(['available', 'in_use', 'maintenance', 'broken', 'retired'])
  status?: string;

  @IsOptional()
  @IsString()
  asset_type?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serial_number?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  severity?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  incident_type?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('missions')
export class MissionsController {
  constructor(private readonly service: ResourcesService) {}

  @Get()
  list(@Req() req: { actor: Actor }, @Query('status') status?: string) {
    return this.service.list(req.actor, 'missions', status);
  }

  @Get(':id')
  get(@Req() req: { actor: Actor }, @Param('id') id: string) {
    return this.service.get(req.actor, 'missions', id);
  }

  @Roles('org_admin', 'manager', 'operator')
  @Post()
  create(@Req() req: { actor: Actor }, @Body() dto: BaseResourceDto) {
    return this.service.create(req.actor, 'missions', dto as Record<string, unknown>);
  }

  @Roles('org_admin', 'manager', 'operator')
  @Patch(':id')
  update(
    @Req() req: { actor: Actor },
    @Param('id') id: string,
    @Body() dto: BaseResourceDto,
  ) {
    return this.service.update(req.actor, 'missions', id, dto as Record<string, unknown>);
  }

  @Roles('org_admin', 'manager', 'operator')
  @Post(':id/status')
  transition(
    @Req() req: { actor: Actor },
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.service.transitionMission(req.actor, id, status);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly service: ResourcesService) {}

  @Get()
  list(@Req() req: { actor: Actor }, @Query('status') status?: string) {
    return this.service.list(req.actor, 'assets', status);
  }

  @Get(':id')
  get(@Req() req: { actor: Actor }, @Param('id') id: string) {
    return this.service.get(req.actor, 'assets', id);
  }

  @Roles('org_admin', 'manager', 'operator')
  @Post()
  create(@Req() req: { actor: Actor }, @Body() dto: BaseResourceDto) {
    return this.service.create(req.actor, 'assets', dto as Record<string, unknown>);
  }

  @Roles('org_admin', 'manager', 'operator')
  @Patch(':id')
  update(
    @Req() req: { actor: Actor },
    @Param('id') id: string,
    @Body() dto: BaseResourceDto,
  ) {
    return this.service.update(req.actor, 'assets', id, dto as Record<string, unknown>);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly service: ResourcesService) {}

  @Get()
  list(@Req() req: { actor: Actor }, @Query('status') status?: string) {
    return this.service.list(req.actor, 'incidents', status);
  }

  @Get(':id')
  get(@Req() req: { actor: Actor }, @Param('id') id: string) {
    return this.service.get(req.actor, 'incidents', id);
  }

  @Roles('org_admin', 'manager', 'operator')
  @Post()
  create(@Req() req: { actor: Actor }, @Body() dto: BaseResourceDto) {
    return this.service.create(req.actor, 'incidents', dto as Record<string, unknown>);
  }

  @Roles('org_admin', 'manager', 'operator')
  @Patch(':id')
  update(
    @Req() req: { actor: Actor },
    @Param('id') id: string,
    @Body() dto: BaseResourceDto,
  ) {
    return this.service.update(req.actor, 'incidents', id, dto as Record<string, unknown>);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly service: ResourcesService) {}

  @Roles('org_admin', 'auditor')
  @Get()
  list(
    @Req() req: { actor: Actor },
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.service.audit(req.actor, entityType, entityId);
  }
}
