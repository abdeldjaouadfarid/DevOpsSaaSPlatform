// Response DTOs for the /projects endpoints.
// DeploymentSummaryDto is the trimmed view we inline on GET /projects/:id
// (the full DeploymentResponseDto with logs lives in the deployments
// module — logs can be large so we keep them off the project detail view).
import { ApiProperty } from '@nestjs/swagger';
import { DeploymentStatus } from '@prisma/client';

export class DeploymentSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  commitSha!: string | null;

  @ApiProperty({ enum: DeploymentStatus })
  status!: DeploymentStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: Date | null;
}

export class ProjectResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  repoUrl!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiProperty({ type: [DeploymentSummaryDto], required: false })
  deployments?: DeploymentSummaryDto[];
}
