import { Body, Controller, Get, Headers, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Actor, JwtAuthGuard } from './security';

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}

class BootstrapDto {
  @IsNotEmpty() organizationName!: string;
  @IsNotEmpty() slug!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
  @IsNotEmpty() fullName!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('bootstrap')
  bootstrap(@Headers('x-bootstrap-key') key: string, @Body() dto: BootstrapDto) {
    if (!process.env.BOOTSTRAP_KEY || key !== process.env.BOOTSTRAP_KEY) {
      throw new UnauthorizedException('Invalid bootstrap key');
    }
    return this.auth.bootstrap(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { actor: Actor }) {
    return req.actor;
  }
}
