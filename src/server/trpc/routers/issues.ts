// GitHub Issues Router

import { z } from "zod";
import { router, projectProcedure, maintainerProcedure } from "../init";
import { IssueSyncStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { Octokit } from "octokit";

export const issuesRouter = router({
  // List issue links for project
  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        state: z.enum(["open", "closed", "all"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const issueLinks = await ctx.prisma.issueLink.findMany({
        where: {
          projectId: input.projectId,
          ...(input.state !== "all" && {
            githubIssueState: input.state,
          }),
        },
        include: {
          testCaseInstance: {
            include: {
              artifact: true,
              cycle: true,
            },
          },
          attachments: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      
      return issueLinks;
    }),
  
  // Get single issue link
  get: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const issueLink = await ctx.prisma.issueLink.findFirst({
        where: {
          id: input.id,
          projectId: input.projectId,
        },
        include: {
          testCaseInstance: {
            include: {
              artifact: true,
              cycle: true,
              assignee: true,
            },
          },
          attachments: true,
          syncEvents: {
            orderBy: {
              createdAt: "desc",
            },
            take: 20,
          },
        },
      });
      
      if (!issueLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue link not found",
        });
      }
      
      return issueLink;
    }),
  
  // Create GitHub issue from test failure
  createFromTest: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        testCaseInstanceId: z.string(),
        title: z.string().min(1).max(200),
        body: z.string().min(1),
        labels: z.array(z.string()).default([]),
        assignees: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { testCaseInstanceId, ...issueData } = input;
      
      // Get test case instance
      const instance = await ctx.prisma.testCaseInstance.findFirst({
        where: {
          id: testCaseInstanceId,
          cycle: {
            projectId: input.projectId,
          },
        },
        include: {
          artifact: true,
          cycle: true,
          environment: true,
        },
      });
      
      if (!instance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Test case instance not found",
        });
      }
      
      // Get project GitHub config
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      
      if (!project?.githubRepoOwner || !project?.githubRepoName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub repository not connected",
        });
      }
      
      // Create GitHub issue
      const octokit = new Octokit({
        auth: process.env.GITHUB_APP_TOKEN,
      });
      
      const issueBody = `
${issueData.body}

---

**Test Details:**
- Test Case: ${instance.artifact.title}
- Cycle: ${instance.cycle.name} (${instance.cycle.version})
- Environment: ${instance.environment?.name || "N/A"}
- Commit: ${instance.cycle.commitSha || "N/A"}

**Reproduction Steps:**
${instance.reproSteps || "See test case for details"}

**Execution Notes:**
${instance.executionNotes || "None provided"}

---
*Created automatically from BetaOps test execution*
`;
      
      const { data: issue } = await octokit.rest.issues.create({
        owner: project.githubRepoOwner,
        repo: project.githubRepoName,
        title: issueData.title,
        body: issueBody,
        labels: [...issueData.labels, "betaops", "test-failure"],
        assignees: issueData.assignees,
      });
      
      // Create issue link
      const issueLink = await ctx.prisma.issueLink.create({
        data: {
          projectId: input.projectId,
          testCaseInstanceId,
          githubIssueNumber: issue.number,
          githubIssueUrl: issue.html_url,
          githubIssueTitle: issue.title,
          githubIssueState: issue.state,
          syncStatus: IssueSyncStatus.SYNCED,
          labels: issue.labels.map((l: any) => l.name),
          assignees: issue.assignees?.map((a: any) => a.login) || [],
        },
      });
      
      // Create sync event
      await ctx.prisma.issueSyncEvent.create({
        data: {
          issueLinkId: issueLink.id,
          eventType: "created",
          eventData: {
            issueNumber: issue.number,
            url: issue.html_url,
          },
        },
      });
      
      return issueLink;
    }),
  
  // Sync issue status from GitHub
  sync: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const issueLink = await ctx.prisma.issueLink.findFirst({
        where: {
          id: input.id,
          projectId: input.projectId,
        },
      });
      
      if (!issueLink) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Issue link not found",
        });
      }
      
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
      });
      
      if (!project?.githubRepoOwner || !project?.githubRepoName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GitHub repository not connected",
        });
      }
      
      // Fetch issue from GitHub
      const octokit = new Octokit({
        auth: process.env.GITHUB_APP_TOKEN,
      });
      
      const { data: issue } = await octokit.rest.issues.get({
        owner: project.githubRepoOwner,
        repo: project.githubRepoName,
        issue_number: issueLink.githubIssueNumber,
      });
      
      // Update issue link
      const updated = await ctx.prisma.issueLink.update({
        where: { id: input.id },
        data: {
          githubIssueState: issue.state,
          githubIssueTitle: issue.title,
          labels: issue.labels.map((l: any) => l.name),
          assignees: issue.assignees?.map((a: any) => a.login) || [],
          syncStatus: IssueSyncStatus.SYNCED,
          lastSyncedAt: new Date(),
        },
      });
      
      // Create sync event
      await ctx.prisma.issueSyncEvent.create({
        data: {
          issueLinkId: issueLink.id,
          eventType: issue.state === "closed" ? "closed" : "updated",
          eventData: {
            state: issue.state,
            closedAt: issue.closed_at,
          },
        },
      });
      
      // If issue was closed, mark test for retest
      if (issue.state === "closed" && issueLink.githubIssueState === "open") {
        await ctx.prisma.testCaseInstance.update({
          where: { id: issueLink.testCaseInstanceId },
          data: {
            status: "RETEST_REQUIRED",
          },
        });
      }
      
      return updated;
    }),
});
