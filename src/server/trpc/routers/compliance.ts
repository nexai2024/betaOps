// Compliance & Audit Router

import { z } from "zod";
import { router, projectProcedure, ownerProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";

export const complianceRouter = router({
  // Get audit events
  getAuditLog: ownerProcedure
    .input(
      z.object({
        projectId: z.string(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        action: z.string().optional(),
        actorId: z.string().optional(),
        limit: z.number().min(1).max(1000).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const events = await ctx.prisma.auditEvent.findMany({
        where: {
          projectId: input.projectId,
          ...(input.startDate && {
            createdAt: {
              gte: input.startDate,
            },
          }),
          ...(input.endDate && {
            createdAt: {
              lte: input.endDate,
            },
          }),
          ...(input.action && { action: input.action }),
          ...(input.actorId && { actorId: input.actorId }),
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
      });
      
      return events;
    }),
  
  // Export audit bundle for compliance
  exportAuditBundle: ownerProcedure
    .input(
      z.object({
        projectId: z.string(),
        cycleId: z.string(),
        includeEvidence: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.testCycle.findFirst({
        where: {
          id: input.cycleId,
          projectId: input.projectId,
        },
        include: {
          project: true,
          plan: true,
          testCaseInstances: {
            include: {
              artifact: true,
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              environment: true,
              signOffs: {
                include: {
                  signedBy: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
              attachments: input.includeEvidence,
              issueLinks: {
                include: {
                  syncEvents: true,
                },
              },
            },
          },
        },
      });
      
      if (!cycle) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Test cycle not found",
        });
      }
      
      // Get audit events for this cycle
      const auditEvents = await ctx.prisma.auditEvent.findMany({
        where: {
          projectId: input.projectId,
          createdAt: {
            gte: cycle.createdAt,
            ...(cycle.completedAt && { lte: cycle.completedAt }),
          },
          OR: [
            { resource: "test_cycle", resourceId: cycle.id },
            {
              resource: "test_case_instance",
              resourceId: {
                in: cycle.testCaseInstances.map((tci) => tci.id),
              },
            },
          ],
        },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });
      
      // Build audit bundle
      const bundle = {
        exportedAt: new Date().toISOString(),
        exportedBy: {
          id: ctx.session.user.id,
          name: ctx.session.user.name,
          email: ctx.session.user.email,
        },
        project: {
          id: cycle.project.id,
          name: cycle.project.name,
          regulatoryRegime: cycle.project.regulatoryRegime,
          riskLevel: cycle.project.riskLevel,
          complianceMode: cycle.project.complianceMode,
        },
        cycle: {
          id: cycle.id,
          name: cycle.name,
          version: cycle.version,
          branch: cycle.branch,
          commitSha: cycle.commitSha,
          status: cycle.status,
          startAt: cycle.startAt,
          completedAt: cycle.completedAt,
          qualityGatesPassed: cycle.qualityGatesPassed,
        },
        testResults: cycle.testCaseInstances.map((tci) => ({
          id: tci.id,
          testCase: {
            id: tci.artifact.id,
            title: tci.artifact.title,
            type: tci.artifact.type,
            content: tci.artifact.content,
          },
          status: tci.status,
          assignee: tci.assignee,
          environment: tci.environment?.name,
          startedAt: tci.startedAt,
          completedAt: tci.completedAt,
          duration: tci.duration,
          executionNotes: tci.executionNotes,
          reproSteps: tci.reproSteps,
          signOffs: tci.signOffs.map((so) => ({
            signedBy: so.signedBy,
            signedAt: so.signedAt,
            attestation: so.attestation,
            signature: so.signature,
            version: so.version,
            environment: so.environment,
            commitSha: so.commitSha,
          })),
          evidence: input.includeEvidence
            ? tci.attachments.map((att) => ({
                filename: att.filename,
                mimeType: att.mimeType,
                size: att.size,
                url: att.url,
                hasPII: att.hasPII,
                redactionApplied: att.redactionApplied,
                uploadedAt: att.uploadedAt,
              }))
            : [],
          issueLinks: tci.issueLinks.map((il) => ({
            githubIssueNumber: il.githubIssueNumber,
            githubIssueUrl: il.githubIssueUrl,
            githubIssueTitle: il.githubIssueTitle,
            githubIssueState: il.githubIssueState,
          })),
        })),
        auditEvents: auditEvents.map((ae) => ({
          id: ae.id,
          actor: ae.actor,
          action: ae.action,
          resource: ae.resource,
          resourceId: ae.resourceId,
          payload: ae.payload,
          createdAt: ae.createdAt,
        })),
        statistics: {
          totalTests: cycle.testCaseInstances.length,
          passed: cycle.testCaseInstances.filter((tci) => tci.status === "PASSED")
            .length,
          failed: cycle.testCaseInstances.filter((tci) => tci.status === "FAILED")
            .length,
          blocked: cycle.testCaseInstances.filter((tci) => tci.status === "BLOCKED")
            .length,
          signedOff: cycle.testCaseInstances.filter(
            (tci) => tci.signOffs.length > 0
          ).length,
          issuesCreated: cycle.testCaseInstances.flatMap((tci) => tci.issueLinks)
            .length,
        },
      };
      
      // Generate bundle signature
      const bundleJson = JSON.stringify(bundle, null, 2);
      const signature = createHash("sha256").update(bundleJson).digest("hex");
      
      const signedBundle = {
        ...bundle,
        signature: `sha256:${signature}`,
      };
      
      // Store bundle export record
      await ctx.prisma.auditEvent.create({
        data: {
          projectId: input.projectId,
          actorId: ctx.session.user.id,
          action: "compliance.export_audit_bundle",
          resource: "test_cycle",
          resourceId: cycle.id,
          payload: {
            cycleId: cycle.id,
            includeEvidence: input.includeEvidence,
            bundleSignature: signature,
          },
        },
      });
      
      return signedBundle;
    }),
  
  // Get quality gates
  getQualityGates: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const gates = await ctx.prisma.qualityGate.findMany({
        where: {
          projectId: input.projectId,
        },
        orderBy: {
          order: "asc",
        },
      });
      
      return gates;
    }),
  
  // Update quality gate
  updateQualityGate: ownerProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        conditions: z.any().optional(),
        onFail: z.enum(["block", "warn"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, id, ...data } = input;
      
      const gate = await ctx.prisma.qualityGate.update({
        where: { id },
        data,
      });
      
      return gate;
    }),
});
