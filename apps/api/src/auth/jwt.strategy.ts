// JwtStrategy — Passport strategy that Nest's JwtAuthGuard delegates to.
//
// Passport extracts the bearer token from the Authorization header,
// verifies its signature and expiry against JWT_SECRET, then hands the
// decoded payload to validate() below. Whatever validate() returns is
// attached to req.user for the rest of the request lifecycle.
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Shape of the JWT body we sign. `sub` (subject) is the standard claim
 * for user id; email is denormalised in for convenience but not trusted
 * (we always re-look-up the user by id to make sure they still exist).
 */
export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      // Standard Bearer <token> header parsing.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Rejects tokens past their exp claim so expired sessions can't be
      // reused.
      ignoreExpiration: false,
      // getOrThrow guarantees a boot-time failure if JWT_SECRET is
      // missing rather than a mysterious runtime auth failure.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Called after signature verification. We re-fetch the user by id to
   * confirm they still exist (deleted-user tokens must not keep working).
   * The returned object becomes req.user, consumed by @CurrentUser().
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });
    if (!user) {
      // Signed by us but the user is gone — treat as an invalid session.
      throw new UnauthorizedException();
    }
    return user;
  }
}
