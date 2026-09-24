// @CurrentUser() param decorator — pulls the authenticated user off the
// request without controllers having to reach into req.user manually.
//
// JwtStrategy.validate populates req.user with a { id, email } object; this
// decorator surfaces it as a strongly-typed argument.
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Shape of the object the JWT strategy attaches to every authenticated
 * request. Kept minimal on purpose — anything more (roles, tenant id)
 * should be fetched on demand.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Extract the current user from the underlying HTTP request. Any
 * @Public() route that uses this decorator will get `undefined` since no
 * strategy runs there — callers should be aware of that when mixing.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
