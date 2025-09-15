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

async function runAnalysis(jobId: string, input: { imageBase64: string; category: string; language: "en" | "tr"; plan: string; }) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "processing";
  job.updatedAt = Date.now();
  jobs.set(jobId, job);

  try {
    const lengthPolicy = input.plan === "ultimate"
      ? "very long (7+ sentences, detailed and thorough)"
      : input.plan === "premium"
      ? "long (5-6 sentences, well-developed)"
      : input.plan === "basic"
      ? "short (1-2 sentences, concise)"
      : "very short (1-2 sentences, brief)";

    const systemLang = input.language === "tr" ? "Turkish" : "English";

    const res = await fetch("https://toolkit.rork.com/text/llm/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are a professional fashion stylist and outfit critic focused on the "${input.category}" aesthetic. OUTPUT LENGTH POLICY: ${lengthPolicy}. Return strict JSON.`
          },
          { role: "system", content: `All outputs MUST be in ${systemLang}.` },
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this outfit for the "${input.category}" style and rate out of 12. Respond in ${systemLang}.` },
              { type: "image", image: `data:image/jpeg;base64,${input.imageBase64}` },
            ]
          }
        ]
      })
    });

    const data = await res.json();
    let analysisData: unknown = undefined;

    try {
      const completion = (data?.completion ?? "") as unknown;
      if (typeof completion === "object" && completion !== null) {
        analysisData = completion as unknown;
      } else if (typeof completion === "string") {
        let text = completion.trim();
        if (text.startsWith("```") ) {
          text = text.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "").trim();
        }
        const firstBrace = text.indexOf("{");
        const lastBrace = text.lastIndexOf("}");
        const slice = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace ? text.slice(firstBrace, lastBrace + 1) : text;
        analysisData = JSON.parse(slice);
      } else {
        throw new Error("invalid_completion");
      }
    } catch (e) {
      job.status = "failed";
      job.error = "parse_error";
      job.updatedAt = Date.now();
      jobs.set(jobId, job);
      return;
    }

    job.status = "succeeded";
    job.result = analysisData;
    job.updatedAt = Date.now();
    jobs.set(jobId, job);
  } catch (e: unknown) {
    const err = e as { message?: string } | undefined;
    const job = jobs.get(jobId);
    if (job) {
      job.status = "failed";
      job.error = err?.message ?? "unknown_error";
      job.updatedAt = Date.now();
      jobs.set(jobId, job);
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
    // Fire-and-forget async job
    runAnalysis(id, input);
    return { jobId: id } as const;
  }),
  status: publicProcedure.input(statusInput).query(async ({ input }) => {
    const job = jobs.get(input.jobId);
    if (!job) {
      return { status: "failed" as JobStatus, error: "not_found" } as const;
    }
    // Auto-expire jobs after 30 minutes to avoid memory bloat
    const THIRTY_MIN = 30 * 60 * 1000;
    if (Date.now() - job.createdAt > THIRTY_MIN) {
      jobs.delete(input.jobId);
    }
    return { status: job.status, result: job.result, error: job.error } as const;
  }),
});

export default analysisRouter;
