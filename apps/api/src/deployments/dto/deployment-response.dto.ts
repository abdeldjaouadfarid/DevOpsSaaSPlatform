import { ApiProperty } from '@nestjs/swagger';
import { DeploymentStatus } from '@prisma/client';

export class DeploymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  projectId!: string;

  @ApiProperty({ nullable: true })
  commitSha!: string | null;

  @ApiProperty({ enum: DeploymentStatus })
  status!: DeploymentStatus;

  @ApiProperty({ nullable: true })
  logs!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt!: Date | null;
}
