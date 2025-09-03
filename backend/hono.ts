import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

// app will be mounted at /api
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());

// Mount tRPC router at /trpc
app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

// In-memory HTML store for temporary exports
const htmlStore = new Map<string, { html: string; createdAt: number }>();

app.post("/export/html", async (c) => {
  try {
    const body = await c.req.json<{ html: string }>();
    const html = (body?.html ?? '').toString();
    if (!html || html.length < 20) {
      return c.json({ error: "invalid_html" }, 400);
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    htmlStore.set(id, { html, createdAt: Date.now() });
    return c.json({ id, url: `${new URL(c.req.url).origin}/api/export/html/${id}` });
  } catch (e) {
    return c.json({ error: "bad_request" }, 400);
  }
});

app.get("/export/html/:id", (c) => {
  const id = c.req.param("id");
  const rec = htmlStore.get(id);
  if (!rec) return c.text("Not found", 404);
  return new Response(rec.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

// Simple health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

export default app;