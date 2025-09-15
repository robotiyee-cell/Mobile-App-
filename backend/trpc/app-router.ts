import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import analysisRouter from "./routes/analysis/router";

export const appRouter = createTRPCRouter({
  example: createTRPCRouter({
    hi: hiRoute,
  }),
  analysis: analysisRouter,
});

export type AppRouter = typeof appRouter;