import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

type Bag = Record<string, unknown>;

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<Bag>();

  enter(initial: Bag = {}): void {
    this.storage.enterWith(initial);
  }

  set(key: string, value: unknown): void {
    const store = this.storage.getStore();
    if (store) store[key] = value;
  }

  get<T = unknown>(key: string): T | undefined {
    return this.storage.getStore()?.[key] as T | undefined;
  }

  snapshot(): Bag {
    const store = this.storage.getStore();
    return store ? { ...store } : {};
  }
}
