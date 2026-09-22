import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DeploymentsService } from './deployments.service';
import { DeploymentResponseDto } from './dto/deployment-response.dto';

@ApiTags('deployments')
@ApiBearerAuth()
@Controller()
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

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

  @Get('deployments/:id')
  @ApiOperation({ summary: 'Get one deployment' })
  @ApiOkResponse({ type: DeploymentResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.deployments.findOne(user.id, id);
  }
}
