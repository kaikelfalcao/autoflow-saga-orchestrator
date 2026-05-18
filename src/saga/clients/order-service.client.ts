import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface OrderItemDto {
  catalogItemId: string;
  itemType: 'PART' | 'SERVICE';
  quantity: number;
}

export interface OrderDetailsDto {
  id: string;
  status: string;
  items: OrderItemDto[];
}

interface RawOrderItem {
  id?: string;
  catalogItemId?: string;
  catalog_item_id?: string;
  itemType?: string;
  item_type?: string;
  quantity: number;
}

interface RawOrder {
  id: string;
  status: string;
  items?: RawOrderItem[];
}

@Injectable()
export class OrderServiceClient {
  private readonly logger = new Logger(OrderServiceClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('ORDER_SERVICE_URL') ?? 'http://localhost:3001';
  }

  async getOrder(orderId: string): Promise<OrderDetailsDto> {
    const response = await firstValueFrom(
      this.http.get<RawOrder>(`${this.baseUrl}/orders/${orderId}`),
    );
    const data = response.data;
    const items: OrderItemDto[] = (data.items ?? []).map((i) => ({
      catalogItemId: (i.catalogItemId ?? i.catalog_item_id ?? '') as string,
      itemType: ((i.itemType ?? i.item_type) as 'PART' | 'SERVICE') ?? 'SERVICE',
      quantity: i.quantity,
    }));
    return { id: data.id, status: data.status, items };
  }

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.baseUrl}/orders/${orderId}/cancel`, {
          changedBy: 'saga-orchestrator',
          reason,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to cancel order ${orderId}: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
