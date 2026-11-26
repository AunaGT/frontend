import type { PortalDesign } from "@/components/customer-pages/types";
import { serializePageSource, type PageSource } from "./pageSource";
export class PageSourceDraft {
  source: PageSource;
  busy = false;
  private baseline: string;
  private generation = 0;
  private design: PortalDesign;
  constructor(design: PortalDesign) {
    this.design = structuredClone(design);
    this.source = serializePageSource(design);
    this.baseline = JSON.stringify(this.source);
  }
  get dirty() {
    return JSON.stringify(this.source) !== this.baseline;
  }
  edit(source: PageSource) {
    this.source = source;
    this.generation++;
  }
  cancel() {
    this.generation++;
  }
  async apply(
    compile: (
      source: PageSource,
      design: PortalDesign,
    ) => Promise<PortalDesign>,
    currentDesign: () => PortalDesign,
    onApply: (design: PortalDesign) => boolean,
  ): Promise<boolean> {
    if (this.busy) return false;
    const generation = this.generation,
      fingerprint = JSON.stringify(currentDesign());
    if (fingerprint !== JSON.stringify(this.design)) return false;
    this.busy = true;
    try {
      const design = await compile({ ...this.source }, this.design);
      if (
        generation !== this.generation ||
        fingerprint !== JSON.stringify(currentDesign())
      )
        return false;
      if (!onApply(design)) return false;
      const accepted = currentDesign();
      this.design = structuredClone(accepted);
      this.source = serializePageSource(accepted);
      this.baseline = JSON.stringify(this.source);
      return true;
    } finally {
      this.busy = false;
    }
  }
}
