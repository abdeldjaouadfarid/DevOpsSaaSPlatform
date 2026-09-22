import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthResponseDto } from './dto/auth-response.dto';
import type { JwtPayload } from './jwt.strategy';

const BCRYPT_ROUNDS = 12;
const GENERIC_INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });

    return { user, accessToken: this.signToken({ sub: user.id, email: user.email }) };
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS);
    }

    return {
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      accessToken: this.signToken({ sub: user.id, email: user.email }),
    };
  }

  private signToken(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }
}
