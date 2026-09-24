// Body validation for POST /projects/:id/deployments.
// commitSha is optional today (the webhook will set it once we wire that
// up). Passing "FAIL" is a test hook that the processor recognises to
// simulate a broken pipeline for retry/failure-path testing.
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TriggerDeploymentDto {
  @ApiProperty({
    required: false,
    example: 'a1b2c3d',
    description: 'Optional commit SHA. Pass "FAIL" to force a simulated failure.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  commitSha?: string;
}
