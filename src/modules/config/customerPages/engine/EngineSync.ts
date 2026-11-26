import type { EngineData } from "./model";
type Selector = { index: number; zone: string };
type Input = {
  revision: unknown;
  desired: EngineData;
  actual: EngineData;
  selection: string | null;
  engineSelection: string | null;
  selector: (id: string) => Selector | undefined;
};
type Decision =
  | { type: "data"; data: EngineData }
  | { type: "selection"; selector: Selector | null }
  | { type: "notify"; id: string | null }
  | null;
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, ordered(child)]),
    );
  return value;
}
export const engineSignature = (data: EngineData) =>
  JSON.stringify(ordered(data));
export class EngineSync {
  private revision: unknown;
  private externalSelection: string | null | undefined;
  private emittedSignature?: string;
  private lastEngineSelection: string | null = null;
  private pending?: {
    signature: string;
    data: EngineData;
    selection: string | null;
  };
  emitted(signature: string) {
    this.emittedSignature = signature;
  }
  reconcile(input: Input): Decision {
    const desired = engineSignature(input.desired),
      actual = engineSignature(input.actual);
    if (
      input.revision !== this.revision ||
      input.selection !== this.externalSelection
    ) {
      const engineOrigin =
        desired === this.emittedSignature &&
        input.selection === this.externalSelection;
      this.pending = {
        signature: desired,
        data: input.desired,
        selection: engineOrigin ? input.engineSelection : input.selection,
      };
      this.revision = input.revision;
      this.externalSelection = input.selection;
      this.emittedSignature = undefined;
    }
    if (this.pending) {
      if (actual !== this.pending.signature)
        return { type: "data", data: this.pending.data };
      const selector = this.pending.selection
        ? input.selector(this.pending.selection) || null
        : null;
      const selection = selector ? this.pending.selection : null;
      this.pending.selection = selection;
      if (input.engineSelection !== selection)
        return { type: "selection", selector };
      this.pending = undefined;
      this.lastEngineSelection = selection;
      return selection !== input.selection
        ? { type: "notify", id: selection }
        : null;
    }
    if (input.engineSelection !== this.lastEngineSelection) {
      this.lastEngineSelection = input.engineSelection;
      if (input.engineSelection !== input.selection)
        return { type: "notify", id: input.engineSelection };
    }
    return null;
  }
}
