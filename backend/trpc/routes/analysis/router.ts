import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../../create-context";

type JobStatus = "pending" | "processing" | "succeeded" | "failed";

interface AnalysisJobRecord {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  result?: unknown;
  error?: string;
}

const jobs = new Map<string, AnalysisJobRecord>();

function isNonEmptyString(v: unknown, min = 1): v is string {
  return typeof v === "string" && v.replace(/\s+/g, " ").trim().length >= min;
}

function isFiniteScore(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 12;
}

function isPercent(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
}

function validateSingleCategory(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const a = data as Record<string, unknown>;
  return (
    isFiniteScore(a.score) &&
    isNonEmptyString(a.style, 5) &&
    isNonEmptyString(a.colorCoordination, 5) &&
    isNonEmptyString(a.accessories, 5) &&
    isNonEmptyString(a.harmony, 5)
  );
}

const sevenCats = ["sexy", "elegant", "casual", "naive", "trendy", "anime", "sixties"] as const;

type SevenCat = typeof sevenCats[number];

function validateAllCategories(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const a = data as Record<string, unknown>;
  if (!isFiniteScore(a.overallScore)) return false;
  if (!isNonEmptyString(a.overallAnalysis, 10)) return false;
  const results = a.results as unknown;
  if (!Array.isArray(results) || results.length < 5) return false;
  let ok = true;
  for (const r of results) {
    if (!r || typeof r !== "object") return false;
    const rr = r as Record<string, unknown>;
    if (!isNonEmptyString(rr.category)) ok = false;
    if (!isFiniteScore(rr.score)) ok = false;
    if (!isNonEmptyString(rr.analysis, 5)) ok = false;
  }
  return ok;
}

function validateDesignMatch(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const a = data as Record<string, unknown>;
  const exact = a.exactMatch as Record<string, unknown> | undefined;
  const top = a.topMatches as unknown;
  if (!exact || typeof exact !== "object") return false;
  if (!isNonEmptyString(exact.brand, 2)) return false;
  if (!isNonEmptyString(exact.designer, 2)) return false;
  if (exact.year !== undefined && typeof exact.year !== "number") return false;
  if (exact.confidence !== undefined && !isPercent(exact.confidence)) return false;
  if (!Array.isArray(top) || top.length < 3) return false;
  for (const m of top) {
    if (!m || typeof m !== "object") return false;
    const mm = m as Record<string, unknown>;
    if (!isNonEmptyString(mm.brand, 2)) return false;
    if (!isNonEmptyString(mm.designer, 2)) return false;
    if (!isPercent(mm.similarityPercent)) return false;
    if (!isNonEmptyString(mm.rationale, 5)) return false;
  }
  return true;
}

async function webSearch(query: string, limit: number = 5): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const q = encodeURIComponent(query);
    const res = await fetch(`https://duckduckgo.com/html/?q=${q}`, {
      headers: { "User-Agent": "Mozilla/5.0 RorkBot" },
    });
    const html = await res.text();
    const items: Array<{ title: string; url: string; snippet: string }> = [];
    const resultBlocks = html.split('result__body').slice(1);
    for (const block of resultBlocks) {
      const aMatch = block.match(/<a[^>]*class=\"result__a[^\"]*\"[^>]*href=\"([^\"]+)\"[^>]*>(.*?)<\/a>/i);
      const sMatch = block.match(/<a[^>]*class=\"result__snippet[^\"]*\"[^>]*>(.*?)<\/a>|<div[^>]*class=\"result__snippet[^\"]*\"[^>]*>(.*?)<\/div>/i);
      const url = aMatch?.[1] ?? "";
      const title = aMatch ? aMatch[2].replace(/<[^>]+>/g, " ").trim() : "";
      const snippetRaw = (sMatch?.[1] ?? sMatch?.[2] ?? "");
      const snippet = snippetRaw.replace(/<[^>]+>/g, " ").trim();
      if (url && title) items.push({ title, url, snippet });
      if (items.length >= limit) break;
    }
    return items;
  } catch (e) {
    console.log('[webSearch] error', e);
    return [];
  }
}

async function suggestQueriesFromImage(imageBase64: string, language: "en" | "tr"): Promise<string[]> {
  try {
    const sysLang = language === 'tr' ? 'Turkish' : 'English';
    const messages = [
      { role: 'system' as const, content: `You generate 3-5 concise web search queries to identify the exact brand/designer of a fashion outfit in an image. Output STRICT JSON: { "queries": string[] } in ${sysLang}. Return ONLY JSON.` },
      { role: 'user' as const, content: [
        { type: 'text' as const, text: 'Generate the best web search queries (include celebrity/event guesses if any). Avoid quotes.' },
        { type: 'image' as const, image: `data:image/jpeg;base64,${imageBase64}` },
      ]},
    ];
    const res = await fetch("https://toolkit.rork.com/text/llm/", {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages })
    });
    const raw = await res.text();
    let json: any;
    try { json = JSON.parse(raw); } catch {
      const fb = raw.indexOf('{'); const lb = raw.lastIndexOf('}');
      json = fb !== -1 && lb !== -1 ? JSON.parse(raw.slice(fb, lb + 1)) : {};
    }
    const completion = json?.completion;
    const text = typeof completion === 'string' ? completion : JSON.stringify(completion ?? {});
    const fb = text.indexOf('{'); const lb = text.lastIndexOf('}');
    const parsed = fb !== -1 && lb !== -1 ? JSON.parse(text.slice(fb, lb + 1)) : {};
    const arr = Array.isArray(parsed?.queries) ? parsed.queries.map((q: unknown) => String(q)).filter((s: string) => s.length > 2) : [];
    return arr.slice(0, 5);
  } catch (e) {
    console.log('[suggestQueriesFromImage] error', e);
    return [];
  }
}

async function buildWebEvidence(imageBase64: string, language: "en" | "tr"): Promise<string> {
  const queries = await suggestQueriesFromImage(imageBase64, language);
  const unique = Array.from(new Set(queries));
  const allResults: Array<{ title: string; url: string; snippet: string }> = [];
  for (const q of unique) {
    const results = await webSearch(q, 4);
    allResults.push(...results);
    if (allResults.length > 12) break;
  }
  const lines = allResults.map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n   ${r.snippet}`);
  return lines.join('\n');
}

async function callModel(input: { imageBase64: string; category: string; language: "en" | "tr"; plan: string; }, forceSchema: boolean) {
  const lengthPolicy = input.plan === "ultimate"
    ? "very long (7+ sentences, detailed and thorough)"
    : input.plan === "premium"
    ? "long (5-6 sentences, well-developed)"
    : input.plan === "basic"
    ? "short (1-2 sentences, concise)"
    : "very short (1-2 sentences, brief)";

  const systemLang = input.language === "tr" ? "Turkish" : "English";

  const schemaHint = input.category === "rate"
    ? `Output STRICT JSON with the following shape:
{
  "overallScore": number (1..12),
  "overallAnalysis": string,
  "results": [
    { "category": "sexy"|"elegant"|"casual"|"naive"|"trendy"|"anime"|"sixties", "score": number (1..12), "analysis": string, "suggestions": string[] }
  ] (exactly 7 items, one per category in the union, no extra categories)
}
Return ONLY JSON, no code fences.`
    : input.category === "designMatch"
    ? `Output STRICT JSON with the following shape:
{
  "exactMatch": {
    "brand": string,
    "designer": string,
    "collection"?: string,
    "season"?: string,
    "year"?: number,
    "pieceName"?: string,
    "confidence": number (0..100),
    "evidence": string
  },
  "topMatches": [
    { "rank": number (1..10), "brand": string, "designer": string, "collection"?: string, "season"?: string, "year"?: number, "similarityPercent": number (0..100), "rationale": string }
  ] (min 3, max 7)
}
Return ONLY JSON, no code fences.`
    : `Output STRICT JSON with the following shape:
{
  "style": string,
  "colorCoordination": string,
  "accessories": string,
  "harmony": string,
  "score": number (1..12),
  "suggestions": string[]
}
Return ONLY JSON, no code fences.`;

  const webEvidence = input.category === 'designMatch' ? await buildWebEvidence(input.imageBase64, input.language) : '';

  const messages = [
    {
      role: "system" as const,
      content: `You are a professional fashion stylist and outfit critic focused on the "${input.category}" aesthetic. OUTPUT LENGTH POLICY: ${lengthPolicy}. All outputs MUST be in ${systemLang}. ${forceSchema ? schemaHint : "Return JSON."}`,
    },
    ...(input.category === 'designMatch' && webEvidence
      ? [{ role: 'system' as const, content: `Use the following recent web evidence to ground your answer. Prefer sources that explicitly name brand/designer, event, and year. Cite key URLs in the evidence field.\n${webEvidence}` }]
      : []),
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: input.category === "designMatch"
          ? `Task: 1) Identify the exact brand and designer of the outfit in the image. If known, include collection/season/year and the specific piece name. 2) Then rank the closest alternative brands/designs with similarity percentages and concise rationales. Ground claims in the provided web evidence when possible. If unsure, reflect uncertainty with lower confidence. Respond in ${systemLang}. ${forceSchema ? "Follow the schema exactly." : ""}`
          : `Analyze this outfit for the "${input.category}" style and rate out of 12. Respond in ${systemLang}. ${forceSchema ? "Follow the schema exactly." : ""}` },
        { type: "image" as const, image: `data:image/jpeg;base64,${input.imageBase64}` },
      ],
    },
  ];

  const res = await fetch("https://toolkit.rork.com/text/llm/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`llm_http_${res.status}${raw ? `: ${raw.slice(0, 120)}` : ""}`);
  }
  let data: any = undefined;
  try {
    data = JSON.parse(raw);
  } catch {
    try {
      const firstBrace = raw.indexOf("{");
      const lastBrace = raw.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const slice = raw.slice(firstBrace, lastBrace + 1);
        data = JSON.parse(slice);
      }
    } catch {
      const hint = contentType.includes("html") || raw.trim().startsWith("<") ? "llm_html_response" : "llm_json_parse_error";
      throw new Error(`${hint}: ${raw.slice(0, 120)}`);
    }
  }
  const completion = data?.completion as unknown;
  if (typeof completion === "object" && completion !== null) return completion;
  if (typeof completion === "string") {
    let text = completion.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "").trim();
    }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    const slice = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text;
    return JSON.parse(slice);
  }
  throw new Error("invalid_completion");
}

async function runAnalysis(jobId: string, input: { imageBase64: string; category: string; language: "en" | "tr"; plan: string; }) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "processing";
  job.updatedAt = Date.now();
  jobs.set(jobId, job);

  try {
    let analysisData: unknown = await callModel(input, false);

    let valid = input.category === "rate" ? validateAllCategories(analysisData) : input.category === "designMatch" ? validateDesignMatch(analysisData) : validateSingleCategory(analysisData);

    if (!valid) {
      analysisData = await callModel(input, true);
      valid = input.category === "rate" ? validateAllCategories(analysisData) : input.category === "designMatch" ? validateDesignMatch(analysisData) : validateSingleCategory(analysisData);
    }

    // Last-resort coercion: if still invalid, try to coerce minimal shape so UI can render instead of failing hard
    if (!valid) {
      const safeCoerce = (() => {
        try {
          if (input.category === "rate") {
            const base = typeof analysisData === "object" && analysisData ? (analysisData as any) : {};
            const results = Array.isArray(base.results) ? base.results : [];
            const normalized = results.slice(0, 7).map((r: any, i: number) => ({
              category: String(r?.category ?? sevenCats[i % sevenCats.length]),
              score: Number(r?.score ?? 6),
              analysis: String(r?.analysis ?? ""),
              suggestions: Array.isArray(r?.suggestions) ? r.suggestions : [],
            }));
            while (normalized.length < 7) {
              const idx = normalized.length;
              normalized.push({
                category: sevenCats[idx] ?? "sexy",
                score: 6,
                analysis: input.language === "tr" ? "Özet bulunamadı." : "No analysis.",
                suggestions: [],
              });
            }
            return {
              overallScore: Number(base?.overallScore ?? 6),
              overallAnalysis: String(base?.overallAnalysis ?? (input.language === "tr" ? "Kısa özet oluşturulamadı." : "No overall analysis.")),
              results: normalized,
            };
          }
          if (input.category === "designMatch") {
            const base = typeof analysisData === "object" && analysisData ? (analysisData as any) : {};
            const top = Array.isArray(base?.topMatches) ? base.topMatches : [];
            const normalized = top.slice(0, 7).map((m: any, i: number) => ({
              rank: Number(m?.rank ?? i + 1),
              brand: String(m?.brand ?? "Unknown"),
              designer: String(m?.designer ?? "Unknown"),
              collection: m?.collection ? String(m.collection) : undefined,
              season: m?.season ? String(m.season) : undefined,
              year: typeof m?.year === "number" ? m.year : undefined,
              similarityPercent: isPercent(m?.similarityPercent) ? m.similarityPercent : 0,
              rationale: String(m?.rationale ?? (input.language === "tr" ? "Açıklama yok." : "No rationale.")),
            }));
            while (normalized.length < 3) {
              const i = normalized.length;
              normalized.push({
                rank: i + 1,
                brand: "Unknown",
                designer: "Unknown",
                similarityPercent: 0,
                rationale: input.language === "tr" ? "Açıklama yok." : "No rationale.",
              });
            }
            return {
              exactMatch: {
                brand: String(base?.exactMatch?.brand ?? "Unknown"),
                designer: String(base?.exactMatch?.designer ?? "Unknown"),
                collection: base?.exactMatch?.collection ? String(base.exactMatch.collection) : undefined,
                season: base?.exactMatch?.season ? String(base.exactMatch.season) : undefined,
                year: typeof base?.exactMatch?.year === "number" ? base.exactMatch.year : undefined,
                pieceName: base?.exactMatch?.pieceName ? String(base.exactMatch.pieceName) : undefined,
                confidence: isPercent(base?.exactMatch?.confidence) ? base.exactMatch.confidence : 0,
                evidence: String(base?.exactMatch?.evidence ?? (input.language === "tr" ? "Kanıt belirtilmedi." : "No evidence provided.")),
              },
              topMatches: normalized,
            };
          }
          // single category
          const base = typeof analysisData === "object" && analysisData ? (analysisData as any) : {};
          return {
            style: String(base?.style ?? (input.language === "tr" ? "Görseldeki stil kısaca tanımlanamadı." : "Style summary unavailable.")),
            colorCoordination: String(base?.colorCoordination ?? (input.language === "tr" ? "Renk uyumu kısaca oluşturulamadı." : "Color coordination unavailable.")),
            accessories: String(base?.accessories ?? (input.language === "tr" ? "Aksesuar önerileri kısaca oluşturulamadı." : "Accessories insight unavailable.")),
            harmony: String(base?.harmony ?? (input.language === "tr" ? "Genel uyum kısaca oluşturulamadı." : "Overall harmony unavailable.")),
            score: Number(base?.score ?? 6),
            suggestions: Array.isArray(base?.suggestions) ? base.suggestions : [],
          };
        } catch {
          return null;
        }
      })();
      if (safeCoerce) {
        analysisData = safeCoerce;
        valid = true;
      }
    }

    if (!valid) throw new Error("schema_validation_failed");

    job.status = "succeeded";
    job.result = analysisData;
    job.updatedAt = Date.now();
    jobs.set(jobId, job);
  } catch (e: unknown) {
    const err = e as { message?: string } | undefined;
    const j = jobs.get(jobId);
    if (j) {
      j.status = "failed";
      j.error = err?.message ?? "unknown_error"; console.log('[analysis] failed', j.error);
      j.updatedAt = Date.now();
      jobs.set(jobId, j);
    }
  }
}

const startInput = z.object({
  imageBase64: z.string().min(10),
  category: z.string().min(1),
  language: z.enum(["en", "tr"]),
  plan: z.string().min(1),
});

const statusInput = z.object({ jobId: z.string().min(1) });

const analysisRouter = createTRPCRouter({
  start: publicProcedure.input(startInput).mutation(async ({ input }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const rec: AnalysisJobRecord = {
      id,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    jobs.set(id, rec);
    runAnalysis(id, input);
    return { jobId: id } as const;
  }),
  status: publicProcedure.input(statusInput).query(async ({ input }) => {
    const job = jobs.get(input.jobId);
    if (!job) {
      return { status: "failed" as JobStatus, error: "not_found" } as const;
    }
    const THIRTY_MIN = 30 * 60 * 1000;
    if (Date.now() - job.createdAt > THIRTY_MIN) {
      jobs.delete(input.jobId);
    }
    return { status: job.status, result: job.result, error: job.error } as const;
  }),
});

export default analysisRouter;
