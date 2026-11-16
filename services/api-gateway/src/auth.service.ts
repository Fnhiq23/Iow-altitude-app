import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { sign, type SignOptions } from 'jsonwebtoken';
import { Database } from './database';

@Injectable()
export class AuthService {
  constructor(private readonly db: Database) {}

  async login(email: string, password: string) {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be set to at least 32 characters');
    }

    const found = await this.db.query(
      `SELECT u.id, u.org_id, u.email, u.full_name, u.password_hash, u.status,
              COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.org_id = u.org_id
       LEFT JOIN roles r ON r.id = ur.role_id AND r.org_id = u.org_id
       WHERE lower(u.email) = lower($1)
       GROUP BY u.id`,
      [email]
    );

    const user = found.rows[0];
    if (!user || user.status !== 'active' || !(await compare(password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const signOptions: SignOptions = {
      subject: user.id,
      expiresIn: (process.env.JWT_TTL ?? '8h') as SignOptions['expiresIn'],
      issuer: 'iow-altitude-app',
    };
    const accessToken = sign({ orgId: user.org_id }, jwtSecret, signOptions);

    return {
      accessToken,
      user: {
        id: user.id,
        orgId: user.org_id,
        email: user.email,
        fullName: user.full_name,
        roles: user.roles,
      },
    };
  }

  async bootstrap(dto: { organizationName: string; slug: string; email: string; password: string; fullName: string }) {
    const client = await (this.db as any).pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT id FROM organizations LIMIT 1');
      if (existing.rowCount) throw new ConflictException('Bootstrap is only available before the first organization is created');

      const org = await client.query('INSERT INTO organizations(name, slug) VALUES($1, $2) RETURNING id', [dto.organizationName, dto.slug.toLowerCase()]);
      const user = await client.query(
        'INSERT INTO users(org_id, username, email, password_hash, full_name) VALUES($1, $2, lower($3), $4, $5) RETURNING id',
        [org.rows[0].id, dto.email, dto.email, await hash(dto.password, 12), dto.fullName]
      );
      const role = await client.query("INSERT INTO roles(org_id, name, description) VALUES($1, 'org_admin', 'Organization administrator') RETURNING id", [org.rows[0].id]);
      await client.query('INSERT INTO user_roles(user_id, role_id, org_id) VALUES($1, $2, $3)', [user.rows[0].id, role.rows[0].id, org.rows[0].id]);

      await client.query('COMMIT');
      return {
        organizationId: org.rows[0].id,
        userId: user.rows[0].id,
        message: 'Bootstrap complete. Remove BOOTSTRAP_KEY after setup.',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
