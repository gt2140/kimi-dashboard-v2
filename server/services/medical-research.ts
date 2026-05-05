export type MedicalResearchSource = "pubmed" | "clinicaltrials";

export type MedicalResearchHit = {
  source: MedicalResearchSource;
  title: string;
  url: string;
  summary: string;
  citation: string;
  publishedAt?: string;
};

type PubMedSearchResponse = {
  esearchresult?: {
    idlist?: string[];
  };
};

type PubMedSummaryResponse = {
  result?: Record<
    string,
    {
      uid?: string;
      title?: string;
      pubdate?: string;
      authors?: Array<{ name?: string }>;
      articleids?: Array<{ idtype?: string; value?: string }>;
      fulljournalname?: string;
    }
  > & { uids?: string[] };
};

type ClinicalTrialsResponse = {
  studies?: Array<{
    protocolSection?: {
      identificationModule?: {
        nctId?: string;
        briefTitle?: string;
      };
      statusModule?: {
        overallStatus?: string;
      };
      descriptionModule?: {
        briefSummary?: string;
      };
    };
  }>;
};

function truncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function compact(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export class MedicalResearchService {
  async search(query: string): Promise<MedicalResearchHit[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const [pubmedHits, trialHits] = await Promise.all([
      this.searchPubMed(normalizedQuery),
      this.searchClinicalTrials(normalizedQuery),
    ]);

    return [...pubmedHits, ...trialHits];
  }

  private async searchPubMed(query: string): Promise<MedicalResearchHit[]> {
    const searchUrl = new URL(
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
    );
    searchUrl.searchParams.set("db", "pubmed");
    searchUrl.searchParams.set("retmode", "json");
    searchUrl.searchParams.set("retmax", "3");
    searchUrl.searchParams.set("sort", "relevance");
    searchUrl.searchParams.set("term", query);

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`PubMed search failed with ${searchResponse.status}.`);
    }

    const searchPayload =
      (await searchResponse.json()) as PubMedSearchResponse;
    const ids = searchPayload.esearchresult?.idlist ?? [];
    if (ids.length === 0) {
      return [];
    }

    const summaryUrl = new URL(
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi",
    );
    summaryUrl.searchParams.set("db", "pubmed");
    summaryUrl.searchParams.set("retmode", "json");
    summaryUrl.searchParams.set("id", ids.join(","));

    const summaryResponse = await fetch(summaryUrl);
    if (!summaryResponse.ok) {
      throw new Error(`PubMed summary failed with ${summaryResponse.status}.`);
    }

    const summaryPayload =
      (await summaryResponse.json()) as PubMedSummaryResponse;

    return ids
      .map(id => summaryPayload.result?.[id])
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map(entry => {
        const doi =
          entry.articleids?.find(articleId => articleId.idtype === "doi")
            ?.value ?? "";
        const authors = (entry.authors ?? [])
          .map(author => compact(author.name))
          .filter(Boolean);
        const authorLabel =
          authors.length === 0
            ? "Unknown authors"
            : authors.length === 1
              ? authors[0]
              : `${authors[0]} et al.`;
        const journal = compact(entry.fulljournalname) || "PubMed record";
        const publishedAt = compact(entry.pubdate);

        return {
          source: "pubmed" as const,
          title: compact(entry.title) || "Untitled PubMed article",
          url: doi ? `https://doi.org/${doi}` : `https://pubmed.ncbi.nlm.nih.gov/${entry.uid}/`,
          summary: truncate(
            `${journal}${publishedAt ? `, ${publishedAt}` : ""}. ${authorLabel}.`,
            220,
          ),
          citation: truncate(
            `${authorLabel}. ${compact(entry.title)}. ${journal}${publishedAt ? ` (${publishedAt})` : ""}${doi ? `. DOI: ${doi}` : ""}.`,
            280,
          ),
          publishedAt,
        };
      });
  }

  private async searchClinicalTrials(
    query: string,
  ): Promise<MedicalResearchHit[]> {
    const url = new URL("https://clinicaltrials.gov/api/query/studies");
    url.searchParams.set("format", "json");
    url.searchParams.set("query.term", query);
    url.searchParams.set("pageSize", "3");
    url.searchParams.set(
      "fields",
      [
        "protocolSection.identificationModule.nctId",
        "protocolSection.identificationModule.briefTitle",
        "protocolSection.statusModule.overallStatus",
        "protocolSection.descriptionModule.briefSummary",
      ].join(","),
    );

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `ClinicalTrials.gov search failed with ${response.status}.`,
      );
    }

    const payload = (await response.json()) as ClinicalTrialsResponse;
    return (payload.studies ?? []).flatMap(study => {
      const identification = study.protocolSection?.identificationModule;
      if (!identification?.nctId) {
        return [];
      }

      const status =
        compact(study.protocolSection?.statusModule?.overallStatus) ||
        "Unknown status";
      const summary =
        compact(study.protocolSection?.descriptionModule?.briefSummary) ||
        "No brief summary available.";

      return [
        {
          source: "clinicaltrials" as const,
          title: compact(identification.briefTitle) || identification.nctId,
          url: `https://clinicaltrials.gov/study/${identification.nctId}`,
          summary: truncate(`${status}. ${summary}`, 220),
          citation: truncate(
            `${identification.nctId}. ${compact(identification.briefTitle) || "Clinical trial record"}. Status: ${status}.`,
            280,
          ),
        },
      ];
    });
  }
}
