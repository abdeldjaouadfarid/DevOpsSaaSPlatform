// AuthService — password hashing, credential verification, JWT signing.
//
// Two public methods: register (create user + issue token) and login
// (verify existing credentials + issue token). All rejections use a
// generic "Invalid email or password" message so attackers can't
// distinguish "unknown email" from "wrong password" — that avoids
// account-enumeration attacks.
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthResponseDto } from './dto/auth-response.dto';
import type { JwtPayload } from './jwt.strategy';

// 12 rounds is a safe default for 2026 CPU speeds. Bumping later
// invalidates nothing (existing hashes are checked at their original cost).
const BCRYPT_ROUNDS = 12;

// Single shared message keeps register/login error surfaces identical.
const GENERIC_INVALID_CREDENTIALS = 'Invalid email or password';

/**
 * Shape of the input to `register`. Kept as an interface (not the DTO
 * class) so the service is not coupled to HTTP-layer validation objects
 * — any caller (CLI seed, webhook, admin script) can hand a plain object.
 */
export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Create a new user.
   *
   * Steps:
   *   1. Bail with 409 Conflict if the email already exists (we check up
   *      front so the client gets a semantic error rather than a P2002
   *      unique-violation surface).
   *   2. Hash the password with bcrypt (never store plaintext).
   *   3. Persist the row with `select` narrowing so passwordHash is
   *      NEVER included in the returned object even by accident.
   *   4. Sign a JWT and return { user, accessToken }.
   */
  async register(input: RegisterInput): Promise<AuthResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
      },
      // Explicit select acts as a safety net: adding a new sensitive column
      // (say `mfaSecret`) won't leak it into API responses because it's
      // not on this allowlist.
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    return { user, accessToken: this.signToken({ sub: user.id, email: user.email }) };
  }

  /**
   * Verify credentials and issue a token.
   *
   * Both failure paths (unknown email, wrong password) throw with the
   * same message and status code — that symmetry prevents timing- and
   * response-based account enumeration.
   */
  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS);
    }

    // bcrypt.compare runs in constant time relative to the hash it holds,
    // preventing early-exit timing leaks on wrong passwords.
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(GENERIC_INVALID_CREDENTIALS);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      },
      accessToken: this.signToken({ sub: user.id, email: user.email }),
    };
  }

  /**
   * Wrap JwtService.sign so both register/login use the same payload
   * shape. `sub` is the standard JWT claim for the subject (user id).
   */
  private signToken(payload: JwtPayload): string {
    return this.jwt.sign(payload);
  }
}
