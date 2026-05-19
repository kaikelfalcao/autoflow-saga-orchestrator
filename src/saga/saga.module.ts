import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { OrderServiceClient } from "./clients/order-service.client";
import { SagaOrmEntity } from "./entities/saga.orm-entity";
import { CatalogCommandsPublisher } from "./messaging/catalog-commands.publisher";
import { CatalogRepliesConsumer } from "./messaging/catalog-replies.consumer";
import { OrderEventsConsumer } from "./messaging/order-events.consumer";
import { SagaService } from "./saga.service";

@Module({
  imports: [TypeOrmModule.forFeature([SagaOrmEntity]), HttpModule],
  providers: [
    SagaService,
    CatalogCommandsPublisher,
    OrderServiceClient,
    OrderEventsConsumer,
    CatalogRepliesConsumer,
  ],
  exports: [SagaService],
})
export class SagaModule {}
