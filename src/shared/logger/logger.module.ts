import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { WinstonModule } from "nest-winston";

import { CanonicalLogInterceptor } from "./canonical-log.interceptor";
import { RequestContextService } from "./request-context.service";
import { winstonConfig } from "./winston.config";

@Global()
@Module({
  imports: [WinstonModule.forRoot(winstonConfig)],
  providers: [
    RequestContextService,
    { provide: APP_INTERCEPTOR, useClass: CanonicalLogInterceptor },
  ],
  exports: [RequestContextService, WinstonModule],
})
export class LoggerModule {}
