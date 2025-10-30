// GitHub Webhook API Route

import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  handlePushEvent,
  handlePullRequestEvent,
  handleIssuesEvent,
  WebhookPayload,
} from "@/lib/github/webhooks";
import { prisma } from "@/server/trpc/context";

export async function POST(request: NextRequest) {
  try {
    // Get signature from headers
    const signature = request.headers.get("x-hub-signature-256");
    const event = request.headers.get("x-github-event");
    
    if (!signature || !event) {
      return NextResponse.json(
        { error: "Missing signature or event type" },
        { status: 400 }
      );
    }
    
    // Get raw body
    const body = await request.text();
    
    // Verify signature
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || "";
    const isValid = verifyWebhookSignature(body, signature, webhookSecret);
    
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }
    
    // Parse payload
    const payload: WebhookPayload = JSON.parse(body);
    
    // Handle different event types
    switch (event) {
      case "push":
        await handlePushEvent(payload, prisma);
        break;
        
      case "pull_request":
        await handlePullRequestEvent(payload, prisma);
        break;
        
      case "issues":
        await handleIssuesEvent(payload, prisma);
        break;
        
      case "ping":
        console.log("Received ping from GitHub");
        break;
        
      default:
        console.log(`Unhandled event type: ${event}`);
    }
    
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Disable body parsing for webhook verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
