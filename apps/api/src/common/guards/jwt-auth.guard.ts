// JwtAuthGuard — global authentication guard.
//
// Registered via APP_GUARD in AppModule so it runs on every request.
// It delegates to Passport's 'jwt' strategy (jwt.strategy.ts) UNLESS the
// route is decorated with @Public(), in which case authentication is
// skipped entirely.
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Called by Nest for every request. Reads the @Public() marker (checking
   * both the handler and the whole controller class), and short-circuits
   * authentication if it's set. Otherwise falls through to Passport's
   * base implementation, which triggers JwtStrategy.validate.
   */
  canActivate(context: ExecutionContext) {
    // getAllAndOverride: handler-level metadata wins over class-level.
    // Useful when a controller is entirely protected except for one
    // specific @Public() endpoint on it (or vice versa).
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
