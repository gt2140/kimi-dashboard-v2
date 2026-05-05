import { afterEach, describe, expect, it, vi } from "vitest";
import { MedicalResearchService } from "./medical-research.js";

describe("MedicalResearchService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("combines PubMed and ClinicalTrials results into normalized hits", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = String(input);

      if (url.includes("esearch.fcgi")) {
        return new Response(
          JSON.stringify({
            esearchresult: { idlist: ["101"] },
          }),
          { status: 200 },
        );
      }

      if (url.includes("esummary.fcgi")) {
        return new Response(
          JSON.stringify({
            result: {
              "101": {
                uid: "101",
                title: "Omega-3 and inflammation",
                pubdate: "2025",
                authors: [{ name: "Smith J" }],
                fulljournalname: "Nutrition Journal",
                articleids: [{ idtype: "doi", value: "10.1000/example" }],
              },
            },
          }),
          { status: 200 },
        );
      }

      if (url.includes("clinicaltrials.gov")) {
        return new Response(
          JSON.stringify({
            studies: [
              {
                protocolSection: {
                  identificationModule: {
                    nctId: "NCT00000001",
                    briefTitle: "Omega-3 supplementation trial",
                  },
                  statusModule: {
                    overallStatus: "RECRUITING",
                  },
                  descriptionModule: {
                    briefSummary: "Evaluates inflammation outcomes.",
                  },
                },
              },
            ],
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch URL in test: ${url}`);
    });

    const service = new MedicalResearchService();
    const hits = await service.search("omega 3 inflammation");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      source: "pubmed",
      title: "Omega-3 and inflammation",
    });
    expect(hits[1]).toMatchObject({
      source: "clinicaltrials",
      title: "Omega-3 supplementation trial",
    });
  });
});
