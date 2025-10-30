// Test Artifacts Router

import { z } from "zod";
import { router, projectProcedure, maintainerProcedure } from "../init";
import { TestArtifactType, ArtifactSource, ArtifactStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { getDefaultProvider } from "@/lib/ai";

export const artifactsRouter = router({
  // List artifacts
  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        type: z.nativeEnum(TestArtifactType).optional(),
        status: z.nativeEnum(ArtifactStatus).optional(),
        featureId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { projectId, type, status, featureId, limit, cursor } = input;
      
      const artifacts = await ctx.prisma.testArtifact.findMany({
        where: {
          projectId,
          ...(type && { type }),
          ...(status && { status }),
          ...(featureId && {
            featureIds: {
              array_contains: [featureId],
            },
          }),
          archivedAt: null,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          _count: {
            select: {
              testCaseInstances: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit + 1,
        ...(cursor && {
          cursor: {
            id: cursor,
          },
          skip: 1,
        }),
      });
      
      let nextCursor: string | undefined = undefined;
      if (artifacts.length > limit) {
        const nextItem = artifacts.pop();
        nextCursor = nextItem!.id;
      }
      
      return {
        items: artifacts,
        nextCursor,
      };
    }),
  
  // Get single artifact
  get: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const artifact = await ctx.prisma.testArtifact.findFirst({
        where: {
          id: input.id,
          projectId: input.projectId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          previousVersion: true,
          nextVersions: {
            orderBy: {
              version: "desc",
            },
          },
        },
      });
      
      if (!artifact) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Test artifact not found",
        });
      }
      
      return artifact;
    }),
  
  // Create artifact manually
  create: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        type: z.nativeEnum(TestArtifactType),
        title: z.string().min(1).max(200),
        content: z.string().min(1),
        featureIds: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const artifact = await ctx.prisma.testArtifact.create({
        data: {
          projectId: input.projectId,
          type: input.type,
          title: input.title,
          content: input.content,
          featureIds: input.featureIds,
          tags: input.tags,
          metadata: input.metadata,
          source: ArtifactSource.MANUAL,
          status: ArtifactStatus.DRAFT,
          createdById: ctx.session.user.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });
      
      return artifact;
    }),
  
  // Generate artifacts with AI
  generateWithAI: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        type: z.enum(["user_stories", "test_cases"]),
        context: z.object({
          featureIds: z.array(z.string()).optional(),
          commitSha: z.string().optional(),
          diff: z.string().optional(),
          userStoryId: z.string().optional(), // For generating test cases
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, type, context } = input;
      
      // Get project and features
      const project = await ctx.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          features: {
            where: {
              ...(context.featureIds?.length
                ? { id: { in: context.featureIds } }
                : {}),
              isActive: true,
            },
          },
        },
      });
      
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      
      const aiProvider = getDefaultProvider();
      
      if (type === "user_stories") {
        // Generate user stories
        const projectContext = {
          projectId: project.id,
          name: project.name,
          description: project.description || "",
          regulatoryRegime: project.regulatoryRegime || undefined,
          riskLevel: project.riskLevel as any,
          repositories: Array.isArray(project.repositories) ? project.repositories as any : [],
          recentCommits: [], // Would fetch from GitHub in real implementation
          features: project.features.map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description || "",
            tags: Array.isArray(f.tags) ? f.tags as string[] : [],
            riskLevel: f.riskLevel as any,
            parentId: f.parentId || undefined,
          })),
          existingStories: [],
          existingTestCases: [],
          testConstraints: {},
        };
        
        const stories = await aiProvider.generateUserStories(projectContext);
        
        // Create artifacts
        const artifacts = await ctx.prisma.$transaction(
          stories.map((story) =>
            ctx.prisma.testArtifact.create({
              data: {
                projectId,
                type: TestArtifactType.USER_STORY,
                title: story.title,
                content: JSON.stringify({
                  description: story.description,
                  acceptanceCriteria: story.acceptanceCriteria,
                }),
                featureIds: story.featureIds,
                tags: story.tags,
                source: ArtifactSource.AI,
                aiModel: aiProvider.name,
                status: ArtifactStatus.REVIEW,
                createdById: ctx.session.user.id,
                metadata: {
                  riskLevel: story.riskLevel,
                  estimatedComplexity: story.estimatedComplexity,
                },
              },
            })
          )
        );
        
        return { artifacts, count: artifacts.length };
      } else {
        // Generate test cases from user story
        if (!context.userStoryId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User story ID required for test case generation",
          });
        }
        
        const userStory = await ctx.prisma.testArtifact.findFirst({
          where: {
            id: context.userStoryId,
            projectId,
            type: TestArtifactType.USER_STORY,
          },
        });
        
        if (!userStory) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User story not found",
          });
        }
        
        const storyContent = JSON.parse(userStory.content);
        
        const testCases = await aiProvider.generateTestCases(
          {
            title: userStory.title,
            description: storyContent.description,
            acceptanceCriteria: storyContent.acceptanceCriteria,
            featureIds: Array.isArray(userStory.featureIds) ? userStory.featureIds as string[] : [],
            tags: Array.isArray(userStory.tags) ? userStory.tags as string[] : [],
            riskLevel: (userStory.metadata as any)?.riskLevel || "MEDIUM",
          },
          {} // constraints
        );
        
        const artifacts = await ctx.prisma.$transaction(
          testCases.map((tc) =>
            ctx.prisma.testArtifact.create({
              data: {
                projectId,
                type: TestArtifactType.TEST_CASE,
                title: tc.title,
                content: JSON.stringify({
                  description: tc.description,
                  preconditions: tc.preconditions,
                  steps: tc.steps,
                  expectedResult: tc.expectedResult,
                }),
                featureIds: tc.featureIds,
                tags: tc.tags,
                source: ArtifactSource.AI,
                aiModel: aiProvider.name,
                status: ArtifactStatus.REVIEW,
                createdById: ctx.session.user.id,
                metadata: {
                  priority: tc.priority,
                  type: tc.type,
                },
              },
            })
          )
        );
        
        return { artifacts, count: artifacts.length };
      }
    }),
  
  // Update artifact
  update: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        content: z.string().min(1).optional(),
        featureIds: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        status: z.nativeEnum(ArtifactStatus).optional(),
        metadata: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, id, ...data } = input;
      
      const artifact = await ctx.prisma.testArtifact.update({
        where: { id },
        data,
      });
      
      return artifact;
    }),
  
  // Archive artifact
  archive: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const artifact = await ctx.prisma.testArtifact.update({
        where: { id: input.id },
        data: {
          status: ArtifactStatus.ARCHIVED,
          archivedAt: new Date(),
        },
      });
      
      return artifact;
    }),
});
