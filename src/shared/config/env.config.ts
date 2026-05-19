import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

class EnvConfig {
  @IsInt()
  @Min(1)
  @IsOptional()
  PORT: number = 3002;

  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsIn(['info', 'debug', 'warn', 'error'])
  @IsOptional()
  LOG_LEVEL: string = 'info';

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  DATABASE_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DATABASE_USER: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME: string;

  @IsString()
  @IsNotEmpty()
  RABBITMQ_URL: string;

  @IsString()
  @IsUrl({ require_tld: false, require_protocol: true })
  @IsOptional()
  ORDER_SERVICE_URL: string = 'http://localhost:3001';

  @IsString()
  @IsOptional()
  CORRELATION_ID_HEADER: string = 'x-correlation-id';
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvConfig {
  const validated = plainToInstance(EnvConfig, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }
  return validated;
}
