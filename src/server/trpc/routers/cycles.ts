// Test Cycles Router

import { z } from "zod";
import { router, projectProcedure, maintainerProcedure } from "../init";
import { TestCycleStatus, TestCaseStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const cyclesRouter = router({
  // List cycles
  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: z.nativeEnum(TestCycleStatus).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const cycles = await ctx.prisma.testCycle.findMany({
        where: {
          projectId: input.projectId,
          ...(input.status && { status: input.status }),
        },
        include: {
          plan: true,
          _count: {
            select: {
              testCaseInstances: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
      });
      
      // Calculate stats for each cycle
      const cyclesWithStats = await Promise.all(
        cycles.map(async (cycle) => {
          const stats = await ctx.prisma.testCaseInstance.groupBy({
            by: ["status"],
            where: {
              cycleId: cycle.id,
            },
            _count: true,
          });
          
          const statusCounts = stats.reduce(
            (acc, stat) => {
              acc[stat.status] = stat._count;
              return acc;
            },
            {} as Record<string, number>
          );
          
          return {
            ...cycle,
            stats: {
              total: cycle._count.testCaseInstances,
              passed: statusCounts[TestCaseStatus.PASSED] || 0,
              failed: statusCounts[TestCaseStatus.FAILED] || 0,
              blocked: statusCounts[TestCaseStatus.BLOCKED] || 0,
              inProgress: statusCounts[TestCaseStatus.IN_PROGRESS] || 0,
              todo: statusCounts[TestCaseStatus.TODO] || 0,
            },
          };
        })
      );
      
      return cyclesWithStats;
    }),
  
  // Get single cycle with details
  get: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.testCycle.findFirst({
        where: {
          id: input.id,
          projectId: input.projectId,
        },
        include: {
          plan: {
            include: {
              template: true,
            },
          },
          testCaseInstances: {
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
              environment: true,
              _count: {
                select: {
                  attachments: true,
                  signOffs: true,
                  issueLinks: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
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
      
      return cycle;
    }),
  
  // Create cycle
  create: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        planId: z.string().optional(),
        name: z.string().min(1).max(200),
        description: z.string().max(5000).optional(),
        version: z.string().min(1).max(50),
        branch: z.string().optional(),
        commitSha: z.string().optional(),
        commitMessage: z.string().optional(),
        artifactIds: z.array(z.string()),
        startAt: z.date().optional(),
        endAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { artifactIds, ...cycleData } = input;
      
      // Create cycle
      const cycle = await ctx.prisma.testCycle.create({
        data: {
          ...cycleData,
          status: TestCycleStatus.PLANNED,
        },
      });
      
      // Create test case instances for each artifact
      await ctx.prisma.$transaction(
        artifactIds.map((artifactId) =>
          ctx.prisma.testCaseInstance.create({
            data: {
              cycleId: cycle.id,
              artifactId,
              status: TestCaseStatus.TODO,
            },
          })
        )
      );
      
      return cycle;
    }),
  
  // Start cycle
  start: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.testCycle.update({
        where: { id: input.id },
        data: {
          status: TestCycleStatus.IN_PROGRESS,
          startAt: new Date(),
        },
      });
      
      // TODO: Send notifications
      
      return cycle;
    }),
  
  // Complete cycle
  complete: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if all test cases are complete
      const incompleteCount = await ctx.prisma.testCaseInstance.count({
        where: {
          cycleId: input.id,
          status: {
            in: [TestCaseStatus.TODO, TestCaseStatus.IN_PROGRESS],
          },
        },
      });
      
      if (incompleteCount > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot complete cycle: ${incompleteCount} test case(s) still incomplete`,
        });
      }
      
      // Evaluate quality gates
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          qualityGates: {
            where: {
              isActive: true,
            },
          },
        },
      });
      
      const qualityGatesPassed = await evaluateQualityGates(
        ctx.prisma,
        input.id,
        project?.qualityGates || []
      );
      
      const cycle = await ctx.prisma.testCycle.update({
        where: { id: input.id },
        data: {
          status: TestCycleStatus.COMPLETED,
          completedAt: new Date(),
          qualityGatesPassed,
          qualityGateResults: {}, // Would contain detailed results
        },
      });
      
      return cycle;
    }),
  
  // Assign test cases to testers
  assignTests: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        cycleId: z.string(),
        assignments: z.array(
          z.object({
            testCaseInstanceId: z.string(),
            assigneeId: z.string(),
            environmentId: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.assignments.map((assignment) =>
          ctx.prisma.testCaseInstance.update({
            where: { id: assignment.testCaseInstanceId },
            data: {
              assigneeId: assignment.assigneeId,
              environmentId: assignment.environmentId,
            },
          })
        )
      );
      
      return { success: true };
    }),
  
  // Get cycle stats
  stats: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const cycle = await ctx.prisma.testCycle.findFirst({
        where: {
          id: input.id,
          projectId: input.projectId,
        },
        include: {
          testCaseInstances: {
            include: {
              artifact: true,
              signOffs: true,
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
      
      const stats = {
        total: cycle.testCaseInstances.length,
        byStatus: {} as Record<string, number>,
        byPriority: {} as Record<string, number>,
        signedOff: 0,
        avgDuration: 0,
      };
      
      let totalDuration = 0;
      let durationCount = 0;
      
      for (const instance of cycle.testCaseInstances) {
        // Count by status
        stats.byStatus[instance.status] =
          (stats.byStatus[instance.status] || 0) + 1;
        
        // Count by priority
        const priority = (instance.artifact.metadata as any)?.priority || "MEDIUM";
        stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
        
        // Count signed off
        if (instance.signOffs.length > 0) {
          stats.signedOff++;
        }
        
        // Average duration
        if (instance.duration) {
          totalDuration += instance.duration;
          durationCount++;
        }
      }
      
      if (durationCount > 0) {
        stats.avgDuration = Math.round(totalDuration / durationCount);
      }
      
      return stats;
    }),
});

// Helper to evaluate quality gates
async function evaluateQualityGates(
  prisma: any,
  cycleId: string,
  gates: any[]
): Promise<boolean> {
  if (gates.length === 0) return true;
  
  const results = await Promise.all(
    gates.map(async (gate) => {
      const conditions = gate.conditions as any[];
      
      for (const condition of conditions) {
        switch (condition.type) {
          case "criticalTestsPassing": {
            const criticalFailed = await prisma.testCaseInstance.count({
              where: {
                cycleId,
                status: {
                  in: [TestCaseStatus.FAILED, TestCaseStatus.BLOCKED],
                },
                artifact: {
                  metadata: {
                    path: ["priority"],
                    equals: "CRITICAL",
                  },
                },
              },
            });
            
            if (criticalFailed > 0) return false;
            break;
          }
          
          case "coverageByFeature": {
            // Would implement feature coverage check
            break;
          }
          
          case "mandatorySignOffs": {
            // Would check for required sign-offs
            break;
          }
          
          case "noBlockingIssues": {
            // Would check for blocking issues
            break;
          }
        }
      }
      
      return true;
    })
  );
  
  return results.every((r) => r);
}
