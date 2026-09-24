// DeploymentsModule — wires the deployments controller + service.
// Note: DeploymentQueueService is provided by the @Global QueueModule
// so we don't need to import QueueModule here explicitly.
import { Module } from '@nestjs/common';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';

@Module({
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
