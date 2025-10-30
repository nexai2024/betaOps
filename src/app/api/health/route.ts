// Health Check API Route

import { NextResponse } from "next/server";
import { prisma } from "@/server/trpc/context";

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        api: "running",
      },
      version: "1.0.0",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        services: {
          database: "disconnected",
          api: "running",
        },
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
