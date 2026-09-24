// @Public() decorator — opt a route out of the global JwtAuthGuard.
//
// JwtAuthGuard reads this metadata via Reflector; any handler (or whole
// controller) tagged with @Public() is served without authentication.
// Used on /health, /auth/register, /auth/login.
import { SetMetadata } from '@nestjs/common';

// Key used to store the flag in Nest's metadata store. Kept in a constant
// so the guard reads back with the exact same key.
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a controller or handler as publicly accessible.
 * Usage: `@Public() @Get('health') check() { ... }`
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
