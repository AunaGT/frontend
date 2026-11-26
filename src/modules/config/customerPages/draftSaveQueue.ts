import type {
  DraftRecord,
  PortalDesign,
} from "@/components/customer-pages/types";
type Local = { name: string; design: PortalDesign };
type Write = Local & { expectedRevision: number; requestId: string };
export class DraftSaveQueue {
  record: DraftRecord;
  local: Local;
  state: "saved" | "dirty" | "saving" | "error" = "saved";
  conflict = false;
  error = "";
  private saved: string;
  private inFlight: Promise<DraftRecord> | null = null;
  private disposed = false;
  private retry: Write | null = null;
  constructor(
    record: DraftRecord,
    private write: (input: Write) => Promise<DraftRecord>,
    private notify: () => void,
  ) {
    this.record = record;
    this.local = { name: record.name, design: record.design };
    this.saved = JSON.stringify(this.local);
  }
  get dirty() {
    return this.saved !== JSON.stringify(this.local);
  }
  edit(value: Local) {
    this.local = value;
    this.state = this.dirty ? "dirty" : "saved";
    this.notify();
  }
  flush(): Promise<DraftRecord> {
    if (this.disposed)
      return Promise.reject(new DOMException("Cancelado", "AbortError"));
    if (this.inFlight) return this.inFlight;
    if (this.conflict)
      return Promise.reject(Error("Resuelve el conflicto antes de guardar"));
    if (!this.dirty) return Promise.resolve(this.record);
    const snapshot = structuredClone(this.local),
      signature = JSON.stringify(snapshot);
    const input =
      this.retry &&
      JSON.stringify({ name: this.retry.name, design: this.retry.design }) ===
        signature
        ? this.retry
        : {
            ...snapshot,
            expectedRevision: this.record.revision,
            requestId: crypto.randomUUID(),
          };
    this.retry = input;
    this.state = "saving";
    this.error = "";
    this.notify();
    const pending = this.write(input)
      .then(async (result) => {
        if (this.disposed) return this.record;
        this.record = result;
        this.saved = signature;
        this.retry = null;
        this.inFlight = null;
        this.state = this.dirty ? "dirty" : "saved";
        this.notify();
        return this.dirty ? this.flush() : result;
      })
      .catch((error) => {
        if (!this.disposed) {
          this.state = "error";
          this.error = error.message;
          this.conflict = error.status === 409;
          this.notify();
        }
        throw error;
      })
      .finally(() => {
        if (this.inFlight === pending) this.inFlight = null;
      });
    this.inFlight = pending;
    return pending;
  }
  dispose() {
    this.disposed = true;
  }
}
