// HealthController — cheap liveness endpoint used by load balancers,
// docker healthchecks, monitoring tools. Stays deliberately simple: no
// DB round-trip, no external dependency check. If the process can
// respond, it's "alive". Deeper readiness checks belong on a separate
// endpoint later.
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * GET /health — always returns { status: 'ok' } when the process is up.
   * @Public() so probes don't need a token to check us.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  check() {
    return { status: 'ok' };
  }
}
