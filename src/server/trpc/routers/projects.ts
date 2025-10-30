// Projects Router

import { z } from "zod";
import { router, protectedProcedure, projectProcedure, ownerProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { MemberRole, RegulatoryRegime, RiskLevel } from "@prisma/client";

export const projectsRouter = router({
  // List all projects user has access to (in current organization)
  list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await ctx.prisma.project.findMany({
      where: {
        organizationId: ctx.organizationId,
        members: {
          some: {
            userId: ctx.session.user.id,
          },
        },
        archivedAt: null,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            features: true,
            testCycles: true,
            testArtifacts: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    
    return projects;
  }),
  
  // Get single project by ID
  get: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  role: true,
                },
              },
            },
          },
          features: {
            where: {
              isActive: true,
              parentId: null, // Top-level features only
            },
            orderBy: {
              order: "asc",
            },
          },
          environments: {
            orderBy: {
              order: "asc",
            },
          },
          _count: {
            select: {
              testArtifacts: true,
              testCycles: true,
              issueLinks: true,
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
      
      return project;
    }),
  
  // Create new project
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(5000).optional(),
        slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
        regulatoryRegime: z.nativeEnum(RegulatoryRegime).optional(),
        riskLevel: z.nativeEnum(RiskLevel).default(RiskLevel.MEDIUM),
        repositories: z.array(
          z.object({
            url: z.string().url(),
            branch: z.string(),
            primary: z.boolean(),
          })
        ).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if slug is unique
      const existing = await ctx.prisma.project.findUnique({
        where: { slug: input.slug },
      });
      
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Project with this slug already exists",
        });
      }
      
      // Create project in current organization and add creator as owner
      const project = await ctx.prisma.project.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          description: input.description,
          slug: input.slug,
          regulatoryRegime: input.regulatoryRegime,
          riskLevel: input.riskLevel,
          repositories: input.repositories || [],
          members: {
            create: {
              userId: ctx.session.user.id,
              role: MemberRole.OWNER,
              joinedAt: new Date(),
            },
          },
          environments: {
            create: [
              { name: "development", order: 0 },
              { name: "staging", order: 1 },
              { name: "production", order: 2 },
            ],
          },
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
          environments: true,
        },
      });
      
      return project;
    }),
  
  // Update project
  update: ownerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(5000).optional(),
        regulatoryRegime: z.nativeEnum(RegulatoryRegime).optional(),
        riskLevel: z.nativeEnum(RiskLevel).optional(),
        complianceMode: z.boolean().optional(),
        complianceConfig: z.any().optional(),
        repositories: z.array(
          z.object({
            url: z.string().url(),
            branch: z.string(),
            primary: z.boolean(),
          })
        ).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      
      const project = await ctx.prisma.project.update({
        where: { id },
        data,
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });
      
      return project;
    }),
  
  // Archive project (soft delete)
  archive: ownerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.update({
        where: { id: input.id },
        data: {
          archivedAt: new Date(),
        },
      });
      
      return project;
    }),
  
  // Add member to project
  addMember: ownerProcedure
    .input(
      z.object({
        projectId: z.string(),
        email: z.string().email(),
        role: z.nativeEnum(MemberRole).default(MemberRole.TESTER),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find user by email
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User with this email not found",
        });
      }
      
      // Check if already a member
      const existing = await ctx.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: input.projectId,
            userId: user.id,
          },
        },
      });
      
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this project",
        });
      }
      
      const member = await ctx.prisma.projectMember.create({
        data: {
          projectId: input.projectId,
          userId: user.id,
          role: input.role,
          joinedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      });
      
      return member;
    }),
  
  // Update member role
  updateMemberRole: ownerProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
        role: z.nativeEnum(MemberRole),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.projectMember.update({
        where: {
          projectId_userId: {
            projectId: input.projectId,
            userId: input.userId,
          },
        },
        data: {
          role: input.role,
        },
        include: {
          user: true,
        },
      });
      
      return member;
    }),
  
  // Remove member from project
  removeMember: ownerProcedure
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent removing the last owner
      const ownerCount = await ctx.prisma.projectMember.count({
        where: {
          projectId: input.projectId,
          role: MemberRole.OWNER,
        },
      });
      
      const memberToRemove = await ctx.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: input.projectId,
            userId: input.userId,
          },
        },
      });
      
      if (memberToRemove?.role === MemberRole.OWNER && ownerCount <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot remove the last owner",
        });
      }
      
      await ctx.prisma.projectMember.delete({
        where: {
          projectId_userId: {
            projectId: input.projectId,
            userId: input.userId,
          },
        },
      });
      
      return { success: true };
    }),
  
  // Connect GitHub repository
  connectGitHub: ownerProcedure
    .input(
      z.object({
        id: z.string(),
        installationId: z.string(),
        repoOwner: z.string(),
        repoName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.update({
        where: { id: input.id },
        data: {
          githubInstallationId: input.installationId,
          githubRepoOwner: input.repoOwner,
          githubRepoName: input.repoName,
        },
      });
      
      return project;
    }),
});
