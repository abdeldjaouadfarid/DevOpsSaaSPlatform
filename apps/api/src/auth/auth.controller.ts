// AuthController — HTTP surface for account creation and login.
// Both routes are @Public() so the global JwtAuthGuard does not require
// a token to reach them.
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * POST /auth/register
   * Creates a new user account and returns a signed JWT so the client can
   * immediately start making authenticated requests without a second
   * round-trip through /auth/login.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user account' })
  @ApiOkResponse({ type: AuthResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  /**
   * POST /auth/login
   * Exchange email + password for a JWT.
   *
   * The @Throttle override tightens the global 100 req/min ceiling to
   * 5/min per IP on this endpoint specifically — slowing credential
   * stuffing without making legitimate typos annoying.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange credentials for a JWT' })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto.email, dto.password);
  }
}
