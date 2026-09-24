// Response shapes for auth endpoints. UserResponseDto is also reused by
// GET /users/me so both surfaces describe the same "safe" user object.
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({ description: 'JWT bearer token' })
  accessToken!: string;
}
