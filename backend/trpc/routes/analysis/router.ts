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

async function webSearch(query: string, limit: number = 6): Promise<Array<{ title: string; url: string; snippet: string }>> {
  try {
    const q = encodeURIComponent(query);
    const headers = { "User-Agent": "Mozilla/5.0 RorkBot" } as const;

    const [ddgRes, braveRes] = await Promise.allSettled([
      fetch(`https://duckduckgo.com/html/?q=${q}`, { headers }),
      fetch(`https://search.brave.com/search?q=${q}`, { headers }),
    ]);

    const items: Array<{ title: string; url: string; snippet: string }> = [];

    const parseDDG = async (resP: PromiseSettledResult<Response>) => {
      if (resP.status !== 'fulfilled') return;
      const html = await resP.value.text();
      const blocks = html.split('result__body').slice(1);
      for (const block of blocks) {
        const aMatch = block.match(/<a[^>]*class=\"result__a[^\"]*\"[^>]*href=\"([^\"]+)\"[^>]*>(.*?)<\/a>/i);
        const sMatch = block.match(/<a[^>]*class=\"result__snippet[^\"]*\"[^>]*>(.*?)<\/a>|<div[^>]*class=\"result__snippet[^\"]*\"[^>]*>(.*?)<\/div>/i);
        let url = aMatch?.[1] ?? "";
        const redirect = url.match(/uddg=([^&]+)/);
        if (redirect?.[1]) {
          try { url = decodeURIComponent(redirect[1]); } catch {}
        }
        const title = aMatch ? aMatch[2].replace(/<[^>]+>/g, " ").trim() : "";
        const snippetRaw = (sMatch?.[1] ?? sMatch?.[2] ?? "");
        const snippet = snippetRaw.replace(/<[^>]+>/g, " ").trim();
        if (url && title) items.push({ title, url, snippet });
        if (items.length >= limit) break;
      }
    };

    const parseBrave = async (resP: PromiseSettledResult<Response>) => {
      if (resP.status !== 'fulfilled') return;
      const html = await resP.value.text();
      const blocks = html.split('result-header').slice(1);
      for (const block of blocks) {
        const aMatch = block.match(/<a[^>]*href=\"([^\"]+)\"[^>]*class=\"result-header[^\"]*\"[^>]*>(.*?)<\/a>/i) || block.match(/<a[^>]*class=\"h-link[^\"]*\"[^>]*href=\"([^\"]+)\"[^>]*>(.*?)<\/a>/i);
        const sMatch = block.match(/<p[^>]*class=\"snippet[^\"]*\"[^>]*>(.*?)<\/p>/i);
        const url = aMatch?.[1] ?? "";
        const title = aMatch ? aMatch[2].replace(/<[^>]+>/g, " ").trim() : "";
        const snippet = (sMatch?.[1] ?? "").replace(/<[^>]+>/g, " ").trim();
        if (url && title) items.push({ title, url, snippet });
        if (items.length >= limit) break;
      }
    };

    await Promise.all([parseDDG(ddgRes), parseBrave(braveRes)]);

    const seen = new Set<string>();
    const deduped = items.filter((it) => {
      const key = it.url.replace(/#.*/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped.slice(0, limit);
  } catch (e) {
    console.log('[webSearch] error', e);
    return [];
  }
}

async function extractCandidatesFromImages(imagesBase64: string[], language: "en" | "tr"): Promise<string[]> {
  try {
    const sysLang = language === 'tr' ? 'Turkish' : 'English';
    const messages = [
      { role: 'system' as const, content: `From up to 4 outfit images, list the most likely FASHION HOUSES / BRANDS or DESIGNERS responsible. Focus on couture/eveningwear houses. Output STRICT JSON: { "brands": string[] } in ${sysLang}. RETURN ONLY JSON.` },
      { role: 'user' as const, content: [
        { type: 'text' as const, text: 'Identify likely brands/designers. Keep to concise canonical names (e.g., "Armani Privé", "Valentino", "Versace").' },
        ...imagesBase64.slice(0,4).map((img) => ({ type: 'image' as const, image: `data:image/jpeg;base64,${img}` })),
      ]},
    ];
    const res = await fetch("https://toolkit.rork.com/text/llm/", { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }) });
    const raw = await res.text();
    let json: any;
    try { json = JSON.parse(raw); } catch { const fb = raw.indexOf('{'); const lb = raw.lastIndexOf('}'); json = fb !== -1 && lb !== -1 ? JSON.parse(raw.slice(fb, lb + 1)) : {}; }
    const completion = json?.completion;
    const text = typeof completion === 'string' ? completion : JSON.stringify(completion ?? {});
    const fb = text.indexOf('{'); const lb = text.lastIndexOf('}');
    const parsed = fb !== -1 && lb !== -1 ? JSON.parse(text.slice(fb, lb + 1)) : {};
    const brands: string[] = Array.isArray(parsed?.brands) ? parsed.brands.map((s: unknown) => String(s)).filter((s: string) => s.length > 1) : [];
    const defaults = ["Armani Privé","Valentino","Versace","Mugler","Tom Ford","Saint Laurent","Givenchy","Balmain","Alexander McQueen","Gucci","Prada","Chanel","Dior","Schiaparelli"];
    const unique = Array.from(new Set([...brands, ...defaults.slice(0, 3)]));
    return unique.slice(0, 8);
  } catch (e) {
    console.log('[extractCandidatesFromImages] error', e);
    return ["Armani Privé", "Valentino", "Versace"]; 
  }
}

async function suggestQueriesFromImageFromMany(imagesBase64: string[], language: "en" | "tr"): Promise<string[]> {
  try {
    const sysLang = language === 'tr' ? 'Turkish' : 'English';
    const candidateBrands = await extractCandidatesFromImages(imagesBase64, language);
    const brandLine = candidateBrands.join(', ');
    const messages = [
      { role: 'system' as const, content: `Generate 8-12 precise, diverse web search queries to identify the exact brand and designer of a fashion outfit given up to 4 images. Always include: celebrity name (if any), event and year (if any), runway/collection terms (runway, couture, haute couture, red carpet, look), color/silhouette descriptors. Ensure at least one query per candidate brand from: ${brandLine}. Output STRICT JSON: { "queries": string[] } in ${sysLang}. Return ONLY JSON.` },
      { role: 'user' as const, content: [
        { type: 'text' as const, text: 'Avoid quotes. Include at least one site:vogue.com and one site:instagram.com query when celebrity/event likely.' },
        ...imagesBase64.slice(0,4).map((img) => ({ type: 'image' as const, image: `data:image/jpeg;base64,${img}` })),
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
    const arr: string[] = Array.isArray(parsed?.queries) ? parsed.queries.map((q: unknown) => String(q)).filter((s: string) => s.length > 2) : [];
    const boosted = Array.from(new Set([
      ...candidateBrands.map((b) => `${b} runway look red carpet`),
      ...arr
    ]));
    return boosted.slice(0, 12);
  } catch (e) {
    console.log('[suggestQueriesFromImage] error', e);
    return [];
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

async function getPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 RorkBot" } });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text')) return '';
    const html = await res.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, 20000);
  } catch {
    return '';
  }
}

async function buildWebEvidence(imagesBase64: string[], language: "en" | "tr"): Promise<string> {
  const queries = await suggestQueriesFromImageFromMany(imagesBase64, language);
  const candidateBrands = await extractCandidatesFromImages(imagesBase64, language);
  const unique = Array.from(new Set(queries));
  const allResults: Array<{ title: string; url: string; snippet: string, pageText?: string, score?: number }> = [];
  for (const q of unique) {
    const results = await webSearch(q, 6);
    for (const r of results) {
      const pageText = await getPageText(r.url);
      allResults.push({ ...r, pageText });
      if (allResults.length > 24) break;
    }
    if (allResults.length > 24) break;
  }
  const brandRegex = new RegExp(`(${candidateBrands.map(b => escapeRegExp(b)).join('|')})`, 'i');
  const scoreUrl = (u: string, title: string, snippet: string, pageText: string) => {
    let s = 0;
    if (/vogue\.com|vogue\.co|instagram\.com|armani\.com|valentino\.com|versace\.com|harpersbazaar|elle\.com/i.test(u)) s += 3;
    if (/runway|look|red\s*carpet|premiere|festival|couture|haute/i.test(`${u} ${title} ${snippet}`)) s += 2;
    if (brandRegex.test(u) || brandRegex.test(title) || brandRegex.test(snippet) || brandRegex.test(pageText)) s += 4;
    return s;
  };
  const sorted = allResults
    .map((r) => ({ ...r, score: scoreUrl(r.url, r.title, r.snippet, r.pageText ?? '') }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const lines = sorted.slice(0, 12).map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n   ${r.snippet}`);
  return lines.join('\n');
}

async function callModel(input: { imageBase64s: string[]; category: string; language: "en" | "tr"; plan: string; }, forceSchema: boolean) {
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
Constraints:
- exactMatch MUST be the most likely brand and designer and appear first. Include collection/season/year when possible.
- topMatches MUST be sorted by similarityPercent descending with concise rationales.
- exactMatch.evidence MUST cite 1–3 key URLs (only URLs), one per line.
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

  const webEvidence = input.category === 'designMatch' ? await buildWebEvidence(input.imageBase64s, input.language) : '';

  const messages = [
    {
      role: "system" as const,
      content: `You are a professional fashion stylist and outfit critic focused on the "${input.category}" aesthetic. OUTPUT LENGTH POLICY: ${lengthPolicy}. All outputs MUST be in ${systemLang}. For designMatch: 1) Return the exact brand and designer first (include collection/season/year when possible), 2) Then list closest suggestions ranked with percentages and short rationales, 3) Always cite 1–3 key URLs in the evidence field (URLs only, one per line). ${forceSchema ? schemaHint : "Return JSON."}`,
    },
    ...(input.category === 'designMatch' && webEvidence
      ? [{ role: 'system' as const, content: `Use the following recent web evidence to ground your answer. Prefer Vogue Runway, official brand websites (e.g., armani.com), and verified social posts. When you output evidence, include 1–3 of the strongest URLs only (one per line).\n${webEvidence}` }]
      : []),
    ...(input.category === 'designMatch'
      ? [{ role: 'system' as const, content: `Hard constraints: If multiple brands are plausible, prefer the one with corroborated URLs from Vogue Runway or the official brand domain. If confidence < 60, reflect that and do NOT assert an exact year unless present in the cited source.` }]
      : []),
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: input.category === "designMatch"
          ? `Task: 1) Identify the exact brand and designer of the outfit in the image. Include collection/season/year and piece name when possible. Output as exactMatch. EXACTMATCH MUST BE THE MOST LIKELY. 2) Then list closest suggestions under topMatches, ranked by similarityPercent with short rationales. 3) In exactMatch.evidence, cite 1–3 key URLs (URLs only, one per line). Use provided web evidence where possible; if conflicting, choose the strongest sources (e.g., Vogue Runway, official Instagram). Reflect uncertainty with lower confidence. Respond in ${systemLang}. ${forceSchema ? "Follow the schema exactly." : ""}`
          : `Analyze this outfit for the "${input.category}" style and rate out of 12. Respond in ${systemLang}. ${forceSchema ? "Follow the schema exactly." : ""}` },
        ...input.imageBase64s.slice(0,4).map((img) => ({ type: "image" as const, image: `data:image/jpeg;base64,${img}` })),
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

async function runAnalysis(jobId: string, input: { imageBase64?: string; imageBase64s?: string[]; category: string; language: "en" | "tr"; plan: string; }) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "processing";
  job.updatedAt = Date.now();
  jobs.set(jobId, job);

  try {
    const imgs = (input.imageBase64s && Array.isArray(input.imageBase64s) ? input.imageBase64s : (input.imageBase64 ? [input.imageBase64] : [])).filter((s) => typeof s === 'string' && s.length > 10);
    if (imgs.length === 0) throw new Error('no_image');

    const payload: { imageBase64s: string[]; category: string; language: "en" | "tr"; plan: string } = {
      imageBase64s: imgs,
      category: input.category,
      language: input.language,
      plan: input.plan,
    };
    let analysisData: unknown = await callModel(payload, input.category === 'designMatch' ? true : false);

    let valid = input.category === "rate" ? validateAllCategories(analysisData) : input.category === "designMatch" ? validateDesignMatch(analysisData) : validateSingleCategory(analysisData);

    if (!valid) {
      analysisData = await callModel(payload, true);
      valid = input.category === "rate" ? validateAllCategories(analysisData) : input.category === "designMatch" ? validateDesignMatch(analysisData) : validateSingleCategory(analysisData);
    }

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
                analysis: input.language === "tr" ? "Bu kategori için detaylı analiz oluşturulamadı. Lütfen farklı bir fotoğraf deneyin." : "No analysis available for this category. Please try a different photo.",
                suggestions: [],
              });
            }
            return {
              overallScore: Number(base?.overallScore ?? 6),
              overallAnalysis: String(base?.overallAnalysis ?? (input.language === "tr" ? "Genel stil analizi oluşturulamadı. Bu görsel için analiz yapılamıyor olabilir." : "Overall style analysis could not be generated. This image may not be suitable for analysis.")),
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
              rationale: String(m?.rationale ?? (input.language === "tr" ? "Bu tasarım için detaylı açıklama oluşturulamadı." : "No detailed explanation available for this design."))
            }));
            while (normalized.length < 3) {
              const i = normalized.length;
              normalized.push({
                rank: i + 1,
                brand: "Unknown",
                designer: "Unknown",
                similarityPercent: 0,
                rationale: input.language === "tr" ? "Bu tasarım için detaylı açıklama oluşturulamadı." : "No detailed explanation available for this design."
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
                evidence: String(base?.exactMatch?.evidence ?? (input.language === "tr" ? "Bu tasarım için web kanıtı bulunamadı. Görsel analiz edilememiş olabilir." : "No web evidence found for this design. The image may not be analyzable."))
              },
              topMatches: normalized,
            };
          }
          const base = typeof analysisData === "object" && analysisData ? (analysisData as any) : {};
          return {
            style: String(base?.style ?? (input.language === "tr" ? "Bu görseldeki stil analiz edilemedi. Görsel net olmayabilir veya kıyafet detayları yetersiz olabilir." : "The style in this image could not be analyzed. The image may not be clear or clothing details may be insufficient.")),
            colorCoordination: String(base?.colorCoordination ?? (input.language === "tr" ? "Renk koordinasyonu analizi oluşturulamadı. Görseldeki renkler net görünmüyor olabilir." : "Color coordination analysis could not be generated. The colors in the image may not be clearly visible.")),
            accessories: String(base?.accessories ?? (input.language === "tr" ? "Aksesuar analizi oluşturulamadı. Görseldeki aksesuarlar net görünmüyor olabilir." : "Accessories analysis could not be generated. The accessories in the image may not be clearly visible.")),
            harmony: String(base?.harmony ?? (input.language === "tr" ? "Genel uyum analizi oluşturulamadı. Kıyafet kombinasyonu net değerlendirilemedi." : "Overall harmony analysis could not be generated. The outfit combination could not be clearly evaluated.")),
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
  imageBase64: z.string().min(10).optional(),
  imageBase64s: z.array(z.string().min(10)).min(1).max(4).optional(),
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
