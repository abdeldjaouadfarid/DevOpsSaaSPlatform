// ProjectsController — HTTP surface for CRUD on Project rows.
// Every route is authenticated (bearer JWT) and every operation is
// scoped to the caller via ProjectsService.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** GET /projects — list the caller's projects (newest first). */
  @Get()
  @ApiOperation({ summary: 'List projects owned by the current user' })
  @ApiOkResponse({ type: [ProjectResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.projects.list(user.id);
  }

  /** POST /projects — create a new project owned by the caller. */
  @Post()
  @ApiOperation({ summary: 'Create a project' })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user.id, dto);
  }

  /**
   * GET /projects/:id — fetch one project plus its last 10 deployments.
   * ParseUUIDPipe rejects malformed ids at the pipe level so the
   * service never sees garbage input.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get one project (with last 10 deployments)' })
  @ApiOkResponse({ type: ProjectResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.findOne(user.id, id);
  }

  /** PATCH /projects/:id — partial update (name, repoUrl). */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiOkResponse({ type: ProjectResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(user.id, id, dto);
  }

  /**
   * DELETE /projects/:id — 204 on success. Cascade removes deployments
   * per the Prisma schema; no soft-delete.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiNoContentResponse()
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.remove(user.id, id);
  }
}
