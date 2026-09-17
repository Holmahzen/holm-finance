import { describe, it, expect } from "vitest";
import { updateEntrySchema } from "@/domain/schemas/entry";

describe("updateEntrySchema", () => {
  it("accepts fixedCostId, to link a standalone entry back to its fixed cost", () => {
    const parsed = updateEntrySchema.parse({ fixedCostId: "fc_123" });
    expect(parsed.fixedCostId).toBe("fc_123");
  });

  it("accepts creditCardPurchaseId, for the same reason", () => {
    const parsed = updateEntrySchema.parse({ creditCardPurchaseId: "ccp_123" });
    expect(parsed.creditCardPurchaseId).toBe("ccp_123");
  });

  it("allows unlinking with null", () => {
    const parsed = updateEntrySchema.parse({ fixedCostId: null });
    expect(parsed.fixedCostId).toBeNull();
  });
});
