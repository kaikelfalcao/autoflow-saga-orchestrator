import type { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { of, throwError } from "rxjs";

import { OrderServiceClient } from "./order-service.client";

function makeHttp(): jest.Mocked<HttpService> {
  return {
    get: jest.fn(),
    patch: jest.fn(),
  } as unknown as jest.Mocked<HttpService>;
}

describe("OrderServiceClient", () => {
  let http: jest.Mocked<HttpService>;
  let client: OrderServiceClient;

  beforeEach(() => {
    http = makeHttp();
    const config = {
      get: (k: string) =>
        k === "ORDER_SERVICE_URL" ? "http://order:3001" : undefined,
    } as unknown as ConfigService;
    client = new OrderServiceClient(http, config);
  });

  describe("getOrder", () => {
    it("mapeia items camelCase", async () => {
      http.get.mockReturnValue(
        of({
          data: {
            id: "o1",
            status: "OPEN",
            items: [{ catalogItemId: "p1", itemType: "PART", quantity: 2 }],
          },
        }) as never,
      );

      const result = await client.getOrder("o1");
      expect(result).toEqual({
        id: "o1",
        status: "OPEN",
        items: [{ catalogItemId: "p1", itemType: "PART", quantity: 2 }],
      });
    });

    it("mapeia items snake_case e default itemType=SERVICE", async () => {
      http.get.mockReturnValue(
        of({
          data: {
            id: "o1",
            status: "OPEN",
            items: [{ catalog_item_id: "p1", quantity: 5 }],
          },
        }) as never,
      );
      const result = await client.getOrder("o1");
      expect(result.items[0]).toEqual({
        catalogItemId: "p1",
        itemType: "SERVICE",
        quantity: 5,
      });
    });

    it("retorna items vazio quando order não tem items", async () => {
      http.get.mockReturnValue(
        of({ data: { id: "o1", status: "OPEN" } }) as never,
      );
      const result = await client.getOrder("o1");
      expect(result.items).toEqual([]);
    });
  });

  describe("cancelOrder", () => {
    it("envia PATCH com motivo", async () => {
      http.patch.mockReturnValue(of({ data: {} }) as never);
      await client.cancelOrder("o1", "stock insufficient");
      expect(http.patch).toHaveBeenCalledWith(
        "http://order:3001/orders/o1/cancel",
        expect.objectContaining({ reason: "stock insufficient" }),
      );
    });

    it("repropaga erro do http", async () => {
      http.patch.mockReturnValue(throwError(() => new Error("boom")));
      await expect(client.cancelOrder("o1", "x")).rejects.toThrow("boom");
    });
  });
});
