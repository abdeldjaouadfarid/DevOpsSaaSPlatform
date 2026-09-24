// UsersModule — wires the users controller + service.
// UsersService is exported so future modules (e.g., an admin panel) can
// reuse the lookup logic.
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
