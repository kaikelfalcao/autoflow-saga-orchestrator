import * as winston from "winston";
import { utilities as nestWinstonModuleUtilities } from "nest-winston";

const serviceName = process.env.NEW_RELIC_APP_NAME ?? "autoflow";

export const winstonConfig: winston.LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: {
    service: serviceName,
    env: process.env.NODE_ENV ?? "development",
    version: process.env.APP_VERSION ?? "0.0.0",
  },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === "production"
      ? winston.format.json()
      : nestWinstonModuleUtilities.format.nestLike(serviceName, {
          prettyPrint: true,
          colors: true,
        }),
  ),
  transports: [new winston.transports.Console()],
};
