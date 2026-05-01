import { describe, expect, it } from "vitest";
import {
  buildInlineVaultFileReference,
  decodeInlineVaultFileReference,
  parseVaultFileReference,
} from "./vault-original-file.js";

describe("vault original file references", () => {
  it("round-trips inline file references for preview fallback", () => {
    const reference = buildInlineVaultFileReference({
      contentType: "application/pdf",
      bytes: new Uint8Array([65, 66, 67]),
    });

    expect(parseVaultFileReference(reference)).toEqual({
      kind: "inline",
      contentType: "application/pdf",
    });

    const decoded = decodeInlineVaultFileReference(reference);
    expect(decoded.contentType).toBe("application/pdf");
    expect(Array.from(decoded.bytes)).toEqual([65, 66, 67]);
  });

  it("recognizes storage references separately from inline data", () => {
    expect(
      parseVaultFileReference("supabase://vault-files/user-7/report.pdf"),
    ).toEqual({
      kind: "storage",
      bucket: "vault-files",
      objectPath: "user-7/report.pdf",
    });
  });
});
