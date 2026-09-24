// AuthModule — wires up Passport, JwtModule (async so we can read the
// secret from ConfigService), the controller, service, and strategy.
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    // Declares 'jwt' as the default Passport strategy for AuthGuard('jwt').
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Async factory so JWT_SECRET / JWT_EXPIRES_IN come from validated
    // config, not from process.env directly.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // Export AuthService so future modules (webhook handler, admin) can
  // call it without going through HTTP.
  exports: [AuthService],
})
export class AuthModule {}
