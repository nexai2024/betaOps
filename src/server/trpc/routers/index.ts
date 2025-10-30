// Main tRPC Router

import { router } from "../init";
import { organizationsRouter } from "./organizations";
import { projectsRouter } from "./projects";
import { featuresRouter } from "./features";
import { artifactsRouter } from "./artifacts";
import { cyclesRouter } from "./cycles";
import { executionRouter } from "./execution";
import { issuesRouter } from "./issues";
import { complianceRouter } from "./compliance";

export const appRouter = router({
  organizations: organizationsRouter,
  projects: projectsRouter,
  features: featuresRouter,
  artifacts: artifactsRouter,
  cycles: cyclesRouter,
  execution: executionRouter,
  issues: issuesRouter,
  compliance: complianceRouter,
});

export type AppRouter = typeof appRouter;
