import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[HEADER] as string | undefined;
    const id = incoming && incoming.length > 0 ? incoming : uuidv4();
    req.headers[HEADER] = id;
    res.setHeader(HEADER, id);
    next();
  }
}
