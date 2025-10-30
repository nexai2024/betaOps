// tRPC Context

import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { type Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/utils/auth";
import { PrismaClient } from "@prisma/client";

// Singleton Prisma instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type CreateContextOptions = {
  session: Session | null;
};

const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
  };
};

export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const { req, res } = opts;
  
  // Get session from NextAuth
  const session = await getServerSession(req, res, authOptions);
  
  return createInnerTRPCContext({
    session,
  });
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
