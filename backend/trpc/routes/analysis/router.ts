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

function validateSingleCategory(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const a = data as Record<string, unknown>;
  return (
    isFiniteScore(a.score) &&
    isNonEmptyString(a.style, 10) &&
    isNonEmptyString(a.colorCoordination, 10) &&
    isNonEmptyString(a.accessories, 10) &&
    isNonEmptyString(a.harmony, 10)
  );
}

const sevenCats = ["sexy", "elegant", "casual", "naive", "trendy", "anime", "sixties"] as const;

type SevenCat = typeof sevenCats[number];

function validateAllCategories(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const a = data as Record<string, unknown>;
  if (!isFiniteScore(a.overallScore)) return false;
  if (!isNonEmptyString(a.overallAnalysis, 20)) return false;
  const results = a.results as unknown;
  if (!Array.isArray(results) || results.length !== 7) return false;
  let ok = true;
  for (const r of results) {
    if (!r || typeof r !== "object") return false;
    const rr = r as Record<string, unknown>;
    if (!isNonEmptyString(rr.category) || !(sevenCats as readonly string[]).includes(String(rr.category))) ok = false;
    if (!isFiniteScore(rr.score)) ok = false;
    if (!isNonEmptyString(rr.analysis, 10)) ok = false;
  }
  return ok;
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

  const messages = [
    {
      role: "system" as const,
      content: `You are a professional fashion stylist and outfit critic focused on the "${input.category}" aesthetic. OUTPUT LENGTH POLICY: ${lengthPolicy}. All outputs MUST be in ${systemLang}. ${forceSchema ? schemaHint : "Return JSON."}`,
    },
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: `Analyze this outfit for the "${input.category}" style and rate out of 12. Respond in ${systemLang}. ${forceSchema ? "Follow the schema exactly." : ""}` },
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

    const valid = input.category === "rate" ? validateAllCategories(analysisData) : validateSingleCategory(analysisData);

    if (!valid) {
      analysisData = await callModel(input, true);
      const valid2 = input.category === "rate" ? validateAllCategories(analysisData) : validateSingleCategory(analysisData);
      if (!valid2) throw new Error("schema_validation_failed");
    }

    job.status = "succeeded";
    job.result = analysisData;
    job.updatedAt = Date.now();
    jobs.set(jobId, job);
  } catch (e: unknown) {
    const err = e as { message?: string } | undefined;
    const j = jobs.get(jobId);
    if (j) {
      j.status = "failed";
      j.error = err?.message ?? "unknown_error";
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
