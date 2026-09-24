// Body validation for POST /projects.
// name is restricted to a URL-safe slug so it can appear in paths and
// deployment hostnames later without escaping. repoUrl is limited to
// https://github.com/ URLs today — GitLab/Bitbucket support is future work.
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, Matches } from 'class-validator';

const PROJECT_NAME_REGEX = /^[a-z0-9-]{1,64}$/;

export class CreateProjectDto {
  @ApiProperty({
    example: 'api-production',
    description: 'lowercase-slug (a-z, 0-9, -) up to 64 chars',
    pattern: PROJECT_NAME_REGEX.source,
  })
  @IsString()
  @Matches(PROJECT_NAME_REGEX, {
    message: 'name must be a lowercase slug (a-z, 0-9, -) up to 64 chars',
  })
  name!: string;

  @ApiProperty({
    example: 'https://github.com/user/api',
    description: 'GitHub HTTPS repo URL',
  })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @Matches(/^https:\/\/github\.com\//, { message: 'repoUrl must be an https://github.com/ URL' })
  repoUrl!: string;
}
