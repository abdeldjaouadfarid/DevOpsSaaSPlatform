// Body validation for POST /auth/register.
// class-validator decorators enforce the rules at request time;
// @ApiProperty gives Swagger a schema to render.
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'super-secret-passphrase', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Jane', minLength: 1, maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  firstName!: string;

  @ApiProperty({ example: 'Doe', minLength: 1, maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lastName!: string;
}
