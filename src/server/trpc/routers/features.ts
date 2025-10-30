// Features Router

import { z } from "zod";
import { router, projectProcedure, maintainerProcedure } from "../init";
import { RiskLevel } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export const featuresRouter = router({
  // List features for a project
  list: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        includeInactive: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const features = await ctx.prisma.feature.findMany({
        where: {
          projectId: input.projectId,
          ...(input.includeInactive ? {} : { isActive: true }),
        },
        include: {
          parent: true,
          children: {
            where: {
              isActive: true,
            },
            orderBy: {
              order: "asc",
            },
          },
          _count: {
            select: {
              testArtifacts: true,
            },
          },
        },
        orderBy: [
          { parentId: "asc" },
          { order: "asc" },
        ],
      });
      
      return features;
    }),
  
  // Get feature tree (hierarchical)
  tree: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const allFeatures = await ctx.prisma.feature.findMany({
        where: {
          projectId: input.projectId,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              testArtifacts: true,
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      });
      
      // Build tree structure
      const featureMap = new Map(allFeatures.map((f) => [f.id, { ...f, children: [] as any[] }]));
      const rootFeatures: any[] = [];
      
      for (const feature of allFeatures) {
        if (feature.parentId) {
          const parent = featureMap.get(feature.parentId);
          if (parent) {
            parent.children.push(featureMap.get(feature.id));
          }
        } else {
          rootFeatures.push(featureMap.get(feature.id));
        }
      }
      
      return rootFeatures;
    }),
  
  // Get single feature
  get: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const feature = await ctx.prisma.feature.findFirst({
        where: {
          id: input.id,
          projectId: input.projectId,
        },
        include: {
          parent: true,
          children: {
            where: {
              isActive: true,
            },
            orderBy: {
              order: "asc",
            },
          },
          testArtifacts: {
            where: {
              status: {
                not: "ARCHIVED",
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 20,
          },
        },
      });
      
      if (!feature) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature not found",
        });
      }
      
      return feature;
    }),
  
  // Create feature
  create: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1).max(200),
        description: z.string().max(5000).optional(),
        tags: z.array(z.string()).default([]),
        parentId: z.string().optional(),
        riskLevel: z.nativeEnum(RiskLevel).default(RiskLevel.MEDIUM),
        order: z.number().int().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.prisma.feature.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          tags: input.tags,
          parentId: input.parentId,
          riskLevel: input.riskLevel,
          order: input.order,
        },
        include: {
          parent: true,
        },
      });
      
      return feature;
    }),
  
  // Update feature
  update: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(5000).optional(),
        tags: z.array(z.string()).optional(),
        parentId: z.string().nullable().optional(),
        riskLevel: z.nativeEnum(RiskLevel).optional(),
        order: z.number().int().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, id, ...data } = input;
      
      // Verify feature belongs to project
      const existing = await ctx.prisma.feature.findFirst({
        where: {
          id,
          projectId,
        },
      });
      
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature not found",
        });
      }
      
      const feature = await ctx.prisma.feature.update({
        where: { id },
        data,
        include: {
          parent: true,
        },
      });
      
      return feature;
    }),
  
  // Delete feature (soft delete by setting isActive: false)
  delete: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const feature = await ctx.prisma.feature.update({
        where: { id: input.id },
        data: {
          isActive: false,
        },
      });
      
      return feature;
    }),
  
  // Reorder features
  reorder: maintainerProcedure
    .input(
      z.object({
        projectId: z.string(),
        updates: z.array(
          z.object({
            id: z.string(),
            order: z.number().int(),
            parentId: z.string().nullable().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update all features in a transaction
      await ctx.prisma.$transaction(
        input.updates.map((update) =>
          ctx.prisma.feature.update({
            where: { id: update.id },
            data: {
              order: update.order,
              ...(update.parentId !== undefined && { parentId: update.parentId }),
            },
          })
        )
      );
      
      return { success: true };
    }),
});
