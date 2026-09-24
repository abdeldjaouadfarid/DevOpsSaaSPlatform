// DeploymentsController — HTTP surface for reading and triggering
// deployments. Read endpoints have always existed; the POST trigger
// endpoint is what wires the API to the BullMQ pipeline.
//
// Note the empty @Controller() — this class hosts routes under both
// /projects/:projectId/deployments and /deployments/:id, so it can't
// commit to a single base path.
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { DeploymentsService } from './deployments.service';
import { DeploymentResponseDto } from './dto/deployment-response.dto';
import { TriggerDeploymentDto } from './dto/trigger-deployment.dto';

@ApiTags('deployments')
@ApiBearerAuth()
@Controller()
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  /**
   * GET /projects/:projectId/deployments
   * Returns the most recent deployments for a project (default 25,
   * capped at 100 by the service).
   */
  @Get('projects/:projectId/deployments')
  @ApiOperation({ summary: 'List deployments for a project' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ type: [DeploymentResponseDto] })
  listForProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.deployments.listForProject(user.id, projectId, limit);
  }

  /**
   * POST /projects/:projectId/deployments
   * Create a new Deployment row in PENDING and enqueue a BullMQ job to
   * run the pipeline. Explicit 201 so clients know to poll the returned
   * id rather than expecting the pipeline to have finished.
   */
  @Post('projects/:projectId/deployments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Trigger a new deployment for a project' })
  @ApiCreatedResponse({ type: DeploymentResponseDto })
  trigger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: TriggerDeploymentDto,
  ) {
    return this.deployments.trigger(user.id, projectId, dto.commitSha);
  }

  /**
   * GET /deployments/:id — single-row read (mostly for dashboard polling).
   */
  @Get('deployments/:id')
  @ApiOperation({ summary: 'Get one deployment' })
  @ApiOkResponse({ type: DeploymentResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.deployments.findOne(user.id, id);
  }
}
