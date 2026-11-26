export type VisualMessage =
  | { kind: "ready" | "error" }
  | { kind: "resize"; height: number };
type Limiter = { start: number; count: number };
export const createMessageLimiter = (): Limiter => ({ start: 0, count: 0 });
export function parseSandboxMessage(
  event: Pick<MessageEvent, "source" | "data" | "origin">,
  {
    source,
    channelId,
    now,
    limiter,
  }: {
    source: MessageEventSource | null;
    channelId: string;
    now: number;
    limiter: Limiter;
  },
): VisualMessage | null {
  if (!source || event.source !== source || event.origin !== "null")
    return null;
  const data = event.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (
    keys.some((k) => !["kind", "channelId", "height"].includes(k)) ||
    data.channelId !== channelId ||
    !["ready", "error", "resize"].includes(data.kind)
  )
    return null;
  if (
    data.kind === "resize"
      ? !Number.isInteger(data.height) || data.height < 80 || data.height > 800
      : data.height !== undefined
  )
    return null;
  if (now - limiter.start >= 1000 || now < limiter.start) {
    limiter.start = now;
    limiter.count = 0;
  }
  if (limiter.count >= 10) return null;
  limiter.count++;
  return data.kind === "resize"
    ? { kind: "resize", height: data.height }
    : { kind: data.kind };
}
