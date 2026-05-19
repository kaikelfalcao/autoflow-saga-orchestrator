// eslint-disable-next-line @typescript-eslint/no-require-imports
const newrelic = require("newrelic") as {
  recordCustomEvent: (
    eventType: string,
    attrs: Record<string, unknown>,
  ) => void;
};

type AttrValue = string | number | boolean | Date | null | undefined;
type Attrs = Record<string, AttrValue>;

export function recordBusinessEvent(
  eventName: string,
  attrs: Attrs = {},
): void {
  try {
    const sanitized: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      sanitized[k] = v instanceof Date ? v.toISOString() : v;
    }
    newrelic.recordCustomEvent("AutoflowBizEvent", {
      eventName,
      service: process.env.NEW_RELIC_APP_NAME ?? "unknown",
      ...sanitized,
    });
  } catch {
    /* intentionally silent */
  }
}

export function recordSagaCompensation(params: {
  orderId: string;
  reason: string;
  step: string;
}): void {
  recordBusinessEvent("SagaCompensation", params);
}
