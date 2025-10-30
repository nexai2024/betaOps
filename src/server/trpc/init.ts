// tRPC Initialization

import { initTRPC, TRPCError } from "@trpc/server";
import { type Context } from "./context";
import superjson from "superjson";
import { ZodError } from "zod";
import { MemberRole, UserRole } from "@prisma/client";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ============================================================================
// Middleware
// ============================================================================

// Auth middleware - requires user to be authenticated
const isAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

// Project access middleware - checks if user has access to project
const hasProjectAccess = t.middleware(async ({ ctx, next, input }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  
  const projectId = (input as any).projectId || (input as any).id;
  
  if (!projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Project ID is required",
    });
  }
  
  // Check if user is a member of the project
  const membership = await ctx.prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: ctx.session.user.id,
      },
    },
    include: {
      project: true,
    },
  });
  
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have access to this project",
    });
  }
  
  return next({
    ctx: {
      ...ctx,
      membership,
      project: membership.project,
    },
  });
});

// Role-based access middleware
const hasRole = (requiredRole: MemberRole) => {
  return t.middleware(async ({ ctx, next, input }) => {
    if (!ctx.session?.user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    
    const projectId = (input as any).projectId || (input as any).id;
    
    if (!projectId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Project ID is required",
      });
    }
    
    const membership = await ctx.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: ctx.session.user.id,
        },
      },
    });
    
    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have access to this project",
      });
    }
    
    // Role hierarchy: OWNER > MAINTAINER > TESTER
    const roleHierarchy = {
      [MemberRole.OWNER]: 3,
      [MemberRole.MAINTAINER]: 2,
      [MemberRole.TESTER]: 1,
    };
    
    if (roleHierarchy[membership.role] < roleHierarchy[requiredRole]) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires ${requiredRole} role`,
      });
    }
    
    return next({
      ctx: {
        ...ctx,
        membership,
      },
    });
  });
};

// Audit logging middleware
const auditLog = t.middleware(async ({ ctx, next, path, type, input }) => {
  const result = await next();
  
  // Log mutation actions for audit trail
  if (type === "mutation" && ctx.session?.user?.id) {
    const projectId = (input as any)?.projectId || (input as any)?.id;
    
    // Non-blocking audit log
    ctx.prisma.auditEvent
      .create({
        data: {
          projectId: projectId || null,
          actorId: ctx.session.user.id,
          action: path,
          resource: path.split(".")[0],
          resourceId: (input as any)?.id || null,
          payload: input as any,
          ipAddress: null, // Would get from request in real implementation
          userAgent: null,
        },
      })
      .catch((error) => {
        console.error("Failed to create audit log:", error);
      });
  }
  
  return result;
});

// ============================================================================
// Procedure Types
// ============================================================================

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuth).use(auditLog);
export const projectProcedure = t.procedure
  .use(isAuth)
  .use(hasProjectAccess)
  .use(auditLog);
export const maintainerProcedure = t.procedure
  .use(isAuth)
  .use(hasRole(MemberRole.MAINTAINER))
  .use(auditLog);
export const ownerProcedure = t.procedure
  .use(isAuth)
  .use(hasRole(MemberRole.OWNER))
  .use(auditLog);
