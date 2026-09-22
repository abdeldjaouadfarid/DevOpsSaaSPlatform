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
