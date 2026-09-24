// PrismaModule exposes PrismaService to the whole app.
// Marked @Global so feature modules can inject PrismaService without
// having to add PrismaModule to their imports array every time.
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
