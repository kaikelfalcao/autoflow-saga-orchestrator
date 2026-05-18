import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable, catchError, tap, throwError } from 'rxjs';
import type { Request, Response } from 'express';
import type { Logger } from 'winston';

import { RequestContextService } from './request-context.service';

@Injectable()
export class CanonicalLogInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly requestCtx: RequestContextService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();

    const httpCtx = ctx.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();
    const start = Date.now();
    const requestId =
      (req.headers['x-correlation-id'] as string | undefined) ?? 'unknown';

    this.requestCtx.enter({ request_id: requestId });

    return next.handle().pipe(
      tap(() => this.emit(req, res, start, requestId, null)),
      catchError((err: unknown) => {
        this.emit(req, res, start, requestId, err);
        return throwError(() => err);
      }),
    );
  }

  private emit(
    req: Request,
    res: Response,
    start: number,
    requestId: string,
    err: unknown,
  ): void {
    const errObj = err as {
      name?: string;
      message?: string;
      status?: number;
      code?: string;
    } | null;
    const status = err ? (errObj?.status ?? 500) : res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const path = (req as Request & { route?: { path?: string } }).route?.path
      ?? req.path
      ?? req.url;

    const accrued = this.requestCtx.snapshot();
    delete accrued.request_id;

    this.logger.log({
      level,
      message: 'request',
      request_id: requestId,
      method: req.method,
      path,
      status_code: status,
      duration_ms: Date.now() - start,
      ...(err
        ? {
            error: {
              type: errObj?.name ?? 'Error',
              message: errObj?.message ?? String(err),
              code: errObj?.code,
            },
          }
        : {}),
      ...accrued,
    });
  }
}
