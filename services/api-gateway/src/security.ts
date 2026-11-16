import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';
import { Database } from './database';

export const ROLES_KEY = 'allowed_roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export interface Actor {
  id: string;
  orgId: string;
  email: string;
  roles: string[];
}

const JWT_ISSUER = 'iow-altitude-app';
const JWT_AUDIENCE = 'iow-altitude-api';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly db: Database,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = request.path ?? '';

    if (path === '/api/health' || path === '/api/auth/login' || path === '/api/auth/bootstrap') {
      return true;
    }

    const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    const secret = process.env.JWT_SECRET;
    if (!token || !secret || secret.length < 32) {
      throw new UnauthorizedException('Authentication required');
    }

    let claims: any;
    try {
      claims = verify(token, secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (
      !claims ||
      typeof claims !== 'object' ||
      typeof claims.sub !== 'string' ||
      typeof claims.orgId !== 'string' ||
      claims.tokenUse !== 'access'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const result = await this.db.query(
      `SELECT u.id, u.org_id, u.email,
              COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.org_id = u.org_id
       LEFT JOIN roles r ON r.id = ur.role_id AND r.org_id = u.org_id
       WHERE u.id = $1 AND u.org_id = $2 AND u.status = 'active'
       GROUP BY u.id`,
      [claims.sub, claims.orgId],
    );

    if (!result.rowCount) {
      throw new UnauthorizedException('Account is inactive');
    }

    request.actor = {
      id: result.rows[0].id,
      orgId: result.rows[0].org_id,
      email: result.rows[0].email,
      roles: result.rows[0].roles ?? [],
    } as Actor;

    const allowed = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allowed?.length && !allowed.some((role) => request.actor.roles.includes(role))) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
