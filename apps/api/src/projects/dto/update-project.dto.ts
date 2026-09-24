// Body validation for PATCH /projects/:id.
// PartialType makes every field optional — clients can send just the
// keys they want to change without repeating the whole object.
import { PartialType } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
