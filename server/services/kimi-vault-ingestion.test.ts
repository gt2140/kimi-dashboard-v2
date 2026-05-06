import { describe, expect, it, vi } from "vitest";
import {
  createKimiVaultIngestionService,
  extractVaultTextLocally,
} from "./kimi-vault-ingestion.js";

describe("kimi-vault-ingestion", () => {
  it("extracts plain-text vault files locally without requiring Kimi upload", async () => {
    const repository = {
      createPendingFile: vi.fn().mockResolvedValue({ id: 41 }),
      updateOriginalReference: vi.fn().mockResolvedValue(undefined),
      markReady: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      insertChunks: vi.fn().mockResolvedValue(undefined),
      getFileById: vi.fn().mockResolvedValue({
        id: 41,
        status: "ready",
        extractionStatus: "ready",
        filename: "bloodwork.txt",
      }),
    };

    const kimiClient = {
      uploadFile: vi.fn(),
      getFileContent: vi.fn(),
    };

    const service = createKimiVaultIngestionService({
      repository,
      kimiClient,
      storeOriginalVaultFile: vi.fn().mockResolvedValue("data:text/plain;base64,QQ=="),
      extractVaultTextLocally: vi
        .fn()
        .mockResolvedValue("Hemoglobin 14.1\nFerritin 82"),
    });

    const result = await service.ingest({
      headers: new Headers(),
      userId: 1,
      filename: "bloodwork.txt",
      fileType: "TXT",
      category: "bloodwork",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("Hemoglobin 14.1\nFerritin 82"),
    });

    expect(kimiClient.uploadFile).not.toHaveBeenCalled();
    expect(repository.markReady).toHaveBeenCalledWith(
      41,
      expect.objectContaining({
        status: "ready",
        extractionStatus: "ready",
        extractedText: expect.stringContaining("Hemoglobin 14.1"),
        remoteFileId: null,
      }),
    );
    expect(repository.insertChunks).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 41,
        status: "ready",
      }),
    );
  });

  it("keeps the file saved locally when remote extraction fails", async () => {
    const repository = {
      createPendingFile: vi.fn().mockResolvedValue({ id: 77 }),
      updateOriginalReference: vi.fn().mockResolvedValue(undefined),
      markReady: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      insertChunks: vi.fn().mockResolvedValue(undefined),
      getFileById: vi.fn().mockResolvedValue({
        id: 77,
        status: "failed",
        extractionStatus: "failed",
        encryptedUrl: "supabase://vault-files/77/report.pdf",
        extractionError: "Kimi request timed out while calling /files.",
      }),
    };

    const kimiClient = {
      uploadFile: vi
        .fn()
        .mockRejectedValue(new Error("Kimi request timed out while calling /files.")),
      getFileContent: vi.fn(),
    };

    const service = createKimiVaultIngestionService({
      repository,
      kimiClient,
      storeOriginalVaultFile: vi
        .fn()
        .mockResolvedValue("supabase://vault-files/77/report.pdf"),
      extractVaultTextLocally: vi.fn().mockResolvedValue(null),
    });

    const result = await service.ingest({
      headers: new Headers(),
      userId: 1,
      filename: "report.pdf",
      fileType: "PDF",
      category: "bloodwork",
      contentType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(repository.markFailed).toHaveBeenCalledWith(
      77,
      expect.objectContaining({
        status: "failed",
        extractionStatus: "failed",
        extractionError: expect.stringContaining("timed out"),
      }),
    );
    expect(repository.insertChunks).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 77,
        status: "failed",
        encryptedUrl: "supabase://vault-files/77/report.pdf",
      }),
    );
  });

  it("extracts utf-8 text locally for csv, markdown, and text payloads", async () => {
    const bytes = new TextEncoder().encode("marker,value\nApoB,72");

    expect(
      await extractVaultTextLocally({
        filename: "labs.csv",
        contentType: "text/csv",
        bytes,
      }),
    ).toContain("ApoB,72");
  });

  it("uses a local pdf extractor when available before falling back to Kimi upload", async () => {
    const repository = {
      createPendingFile: vi.fn().mockResolvedValue({ id: 81 }),
      updateOriginalReference: vi.fn().mockResolvedValue(undefined),
      markReady: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      insertChunks: vi.fn().mockResolvedValue(undefined),
      getFileById: vi.fn().mockResolvedValue({
        id: 81,
        status: "ready",
        extractionStatus: "ready",
        filename: "study.pdf",
      }),
    };

    const kimiClient = {
      uploadFile: vi.fn(),
      getFileContent: vi.fn(),
    };

    const service = createKimiVaultIngestionService({
      repository,
      kimiClient,
      storeOriginalVaultFile: vi
        .fn()
        .mockResolvedValue("supabase://vault-files/81/study.pdf"),
      extractVaultTextLocally: vi
        .fn()
        .mockResolvedValue("Glucose 88\nHbA1c 5.1"),
    });

    await service.ingest({
      headers: new Headers(),
      userId: 1,
      filename: "study.pdf",
      fileType: "PDF",
      category: "bloodwork",
      contentType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3]),
    });

    expect(kimiClient.uploadFile).not.toHaveBeenCalled();
    expect(repository.markReady).toHaveBeenCalledWith(
      81,
      expect.objectContaining({
        extractedText: expect.stringContaining("Glucose 88"),
      }),
    );
  });

  it("still creates a vault row when original-file persistence fails before extraction", async () => {
    const repository = {
      createPendingFile: vi.fn().mockResolvedValue({ id: 91 }),
      updateOriginalReference: vi.fn().mockResolvedValue(undefined),
      markReady: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      insertChunks: vi.fn().mockResolvedValue(undefined),
      getFileById: vi.fn().mockResolvedValue({
        id: 91,
        status: "ready",
        extractionStatus: "ready",
        filename: "labs.csv",
        encryptedUrl: null,
      }),
    };

    const kimiClient = {
      uploadFile: vi.fn(),
      getFileContent: vi.fn(),
    };

    const service = createKimiVaultIngestionService({
      repository,
      kimiClient,
      storeOriginalVaultFile: vi
        .fn()
        .mockRejectedValue(new Error("Supabase storage upload failed.")),
      extractVaultTextLocally: vi
        .fn()
        .mockResolvedValue("marker,value\nApoB,72"),
    });

    const result = await service.ingest({
      headers: new Headers(),
      userId: 1,
      filename: "labs.csv",
      fileType: "CSV",
      category: "bloodwork",
      contentType: "text/csv",
      bytes: new TextEncoder().encode("marker,value\nApoB,72"),
    });

    expect(repository.createPendingFile).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedUrl: null,
      }),
    );
    expect(repository.updateOriginalReference).not.toHaveBeenCalled();
    expect(repository.markReady).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 91,
        status: "ready",
        encryptedUrl: null,
      }),
    );
  });
});
