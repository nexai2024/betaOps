// Organizations Router (Multi-Tenancy)

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../init";
import { TRPCError } from "@trpc/server";
import { OrganizationRole } from "@prisma/client";

export const organizationsRouter = router({
  // List organizations user belongs to
  list: protectedProcedure.query(async ({ ctx }) => {
    // Remove organization requirement for this endpoint
    const organizations = await ctx.prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId: ctx.session.user.id,
          },
        },
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
            projects: true,
            members: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    
    return organizations;
  }),
  
  // Get current organization
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.organizationId) {
      return null;
    }
    
    const organization = await ctx.prisma.organization.findUnique({
      where: { id: ctx.organizationId },
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
            projects: true,
          },
        },
      },
    });
    
    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }
    
    return organization;
  }),
  
  // Switch current organization
  switch: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify user is a member
      const membership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: ctx.session.user.id,
          },
        },
      });
      
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }
      
      // Update user's current organization
      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          currentOrganizationId: input.organizationId,
        },
      });
      
      return { success: true };
    }),
  
  // Create new organization
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
        description: z.string().max(5000).optional(),
        plan: z.string().default("free"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if slug is unique
      const existing = await ctx.prisma.organization.findUnique({
        where: { slug: input.slug },
      });
      
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Organization with this slug already exists",
        });
      }
      
      // Create organization and add creator as owner
      const organization = await ctx.prisma.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          description: input.description,
          plan: input.plan,
          members: {
            create: {
              userId: ctx.session.user.id,
              role: OrganizationRole.OWNER,
              joinedAt: new Date(),
            },
          },
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });
      
      // Set as current organization if user doesn't have one
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.session.user.id },
        select: { currentOrganizationId: true },
      });
      
      if (!user?.currentOrganizationId) {
        await ctx.prisma.user.update({
          where: { id: ctx.session.user.id },
          data: {
            currentOrganizationId: organization.id,
          },
        });
      }
      
      return organization;
    }),
  
  // Update organization
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(5000).optional(),
        logo: z.string().url().optional(),
        primaryColor: z.string().optional(),
        settings: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      
      // Check if user is owner/admin
      const membership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: id,
            userId: ctx.session.user.id,
          },
        },
      });
      
      if (
        !membership ||
        (membership.role !== OrganizationRole.OWNER &&
          membership.role !== OrganizationRole.ADMIN)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners and admins can update the organization",
        });
      }
      
      const organization = await ctx.prisma.organization.update({
        where: { id },
        data,
      });
      
      return organization;
    }),
  
  // Invite member to organization
  inviteMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        email: z.string().email(),
        role: z.nativeEnum(OrganizationRole).default(OrganizationRole.MEMBER),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner/admin
      const membership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: ctx.session.user.id,
          },
        },
      });
      
      if (
        !membership ||
        (membership.role !== OrganizationRole.OWNER &&
          membership.role !== OrganizationRole.ADMIN)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners and admins can invite members",
        });
      }
      
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
      const existing = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: user.id,
          },
        },
      });
      
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this organization",
        });
      }
      
      const member = await ctx.prisma.organizationMember.create({
        data: {
          organizationId: input.organizationId,
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
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
        role: z.nativeEnum(OrganizationRole),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner
      const membership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: ctx.session.user.id,
          },
        },
      });
      
      if (!membership || membership.role !== OrganizationRole.OWNER) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can change member roles",
        });
      }
      
      const member = await ctx.prisma.organizationMember.update({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
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
  
  // Remove member from organization
  removeMember: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is owner/admin
      const membership = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: ctx.session.user.id,
          },
        },
      });
      
      if (
        !membership ||
        (membership.role !== OrganizationRole.OWNER &&
          membership.role !== OrganizationRole.ADMIN)
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners and admins can remove members",
        });
      }
      
      // Prevent removing the last owner
      const memberToRemove = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });
      
      if (memberToRemove?.role === OrganizationRole.OWNER) {
        const ownerCount = await ctx.prisma.organizationMember.count({
          where: {
            organizationId: input.organizationId,
            role: OrganizationRole.OWNER,
          },
        });
        
        if (ownerCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the last owner",
          });
        }
      }
      
      await ctx.prisma.organizationMember.delete({
        where: {
          organizationId_userId: {
            organizationId: input.organizationId,
            userId: input.userId,
          },
        },
      });
      
      // If user removed themselves and it was their current org, clear it
      if (input.userId === ctx.session.user.id) {
        await ctx.prisma.user.update({
          where: { id: ctx.session.user.id },
          data: {
            currentOrganizationId: null,
          },
        });
      }
      
      return { success: true };
    }),
});
