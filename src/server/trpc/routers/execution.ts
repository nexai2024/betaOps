// Test Execution Router

import { z } from "zod";
import { router, projectProcedure } from "../init";
import { TestCaseStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";

export const executionRouter = router({
  // Get test case instance for execution
  getInstance: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const instance = await ctx.prisma.testCaseInstance.findFirst({
        where: {
          id: input.id,
          cycle: {
            projectId: input.projectId,
          },
        },
        include: {
          artifact: true,
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          cycle: true,
          environment: true,
          attachments: {
            orderBy: {
              uploadedAt: "desc",
            },
          },
          signOffs: {
            include: {
              signedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
            orderBy: {
              signedAt: "desc",
            },
          },
          issueLinks: {
            include: {
              attachments: true,
            },
          },
        },
      });
      
      if (!instance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Test case instance not found",
        });
      }
      
      return instance;
    }),
  
  // Start test execution
  start: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.testCaseInstance.update({
        where: { id: input.id },
        data: {
          status: TestCaseStatus.IN_PROGRESS,
          startedAt: new Date(),
          assigneeId: ctx.session.user.id,
        },
      });
      
      return instance;
    }),
  
  // Update execution status
  updateStatus: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
        status: z.nativeEnum(TestCaseStatus),
        executionNotes: z.string().optional(),
        reproSteps: z.string().optional(),
        browserInfo: z.string().optional(),
        deviceInfo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, projectId, status, ...data } = input;
      
      const updateData: any = {
        status,
        ...data,
      };
      
      // If completing, set completedAt and duration
      if (
        [
          TestCaseStatus.PASSED,
          TestCaseStatus.FAILED,
          TestCaseStatus.BLOCKED,
          TestCaseStatus.SKIPPED,
        ].includes(status)
      ) {
        const instance = await ctx.prisma.testCaseInstance.findUnique({
          where: { id },
          select: { startedAt: true },
        });
        
        if (instance?.startedAt) {
          const duration = Math.floor(
            (Date.now() - instance.startedAt.getTime()) / 1000
          );
          updateData.completedAt = new Date();
          updateData.duration = duration;
        }
      }
      
      const instance = await ctx.prisma.testCaseInstance.update({
        where: { id },
        data: updateData,
      });
      
      return instance;
    }),
  
  // Upload evidence attachment
  uploadEvidence: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        testCaseInstanceId: z.string(),
        filename: z.string(),
        originalFilename: z.string(),
        mimeType: z.string(),
        size: z.number(),
        url: z.string().url(),
        hasPII: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { testCaseInstanceId, ...attachmentData } = input;
      
      const attachment = await ctx.prisma.attachment.create({
        data: {
          ownerType: "test_case_instance",
          ownerId: testCaseInstanceId,
          ...attachmentData,
          redactionApplied: false,
        },
      });
      
      return attachment;
    }),
  
  // Delete attachment
  deleteAttachment: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.attachment.delete({
        where: { id: input.id },
      });
      
      return { success: true };
    }),
  
  // Sign off on test
  signOff: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        testCaseInstanceId: z.string(),
        attestation: z.string().min(1),
        version: z.string().min(1),
        environment: z.string().min(1),
        commitSha: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { testCaseInstanceId, ...signOffData } = input;
      
      // Generate signature (hash of attestation + timestamp + user)
      const signatureInput = `${signOffData.attestation}:${Date.now()}:${ctx.session.user.id}`;
      const signature = createHash("sha256").update(signatureInput).digest("hex");
      
      const signOff = await ctx.prisma.signOff.create({
        data: {
          testCaseInstanceId,
          signedById: ctx.session.user.id,
          ...signOffData,
          signature,
          ipAddress: null, // Would get from request
          userAgent: null,
        },
        include: {
          signedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });
      
      return signOff;
    }),
  
  // Get AI suggestions for test
  getAISuggestions: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        testCaseInstanceId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const instance = await ctx.prisma.testCaseInstance.findFirst({
        where: {
          id: input.testCaseInstanceId,
          cycle: {
            projectId: input.projectId,
          },
        },
        include: {
          artifact: true,
          cycle: true,
        },
      });
      
      if (!instance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Test case instance not found",
        });
      }
      
      // Return cached suggestions if available
      if (instance.aiSuggestions) {
        return instance.aiSuggestions;
      }
      
      // Generate new suggestions (simplified - would use AI in real implementation)
      const testContent = JSON.parse(instance.artifact.content);
      
      const suggestions = {
        additionalSteps: [
          "Verify accessibility with screen reader",
          "Test with keyboard navigation only",
          "Check mobile responsiveness",
        ],
        edgeCases: [
          "Test with empty input",
          "Test with maximum length input",
          "Test with special characters",
        ],
        securityConsiderations: [
          "Verify XSS protection",
          "Check for SQL injection vulnerabilities",
          "Ensure proper authentication",
        ],
      };
      
      // Cache suggestions
      await ctx.prisma.testCaseInstance.update({
        where: { id: input.testCaseInstanceId },
        data: {
          aiSuggestions: suggestions,
        },
      });
      
      return suggestions;
    }),
  
  // Analyze failure with AI
  analyzeFailure: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        testCaseInstanceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const instance = await ctx.prisma.testCaseInstance.findFirst({
        where: {
          id: input.testCaseInstanceId,
          cycle: {
            projectId: input.projectId,
          },
        },
        include: {
          artifact: true,
          cycle: true,
          attachments: true,
        },
      });
      
      if (!instance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Test case instance not found",
        });
      }
      
      if (instance.status !== TestCaseStatus.FAILED) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only analyze failed tests",
        });
      }
      
      // In real implementation, would call AI provider
      // For now, return mock analysis
      const analysis = {
        summary: "Test failed due to unexpected error response",
        likelyCauses: [
          {
            description: "API endpoint returning 500 error",
            likelihood: 0.8,
            evidence: ["Error logs show internal server error"],
            suggestedFix: "Check server logs and fix API endpoint",
          },
          {
            description: "Timeout due to slow database query",
            likelihood: 0.5,
            evidence: ["Long response time observed"],
            suggestedFix: "Optimize database query or add indexes",
          },
        ],
        relatedCommits: [instance.cycle.commitSha || ""],
        recommendedActions: [
          "Review server logs",
          "Check database performance",
          "Verify API endpoint configuration",
        ],
        confidence: 0.75,
      };
      
      return analysis;
    }),
});
