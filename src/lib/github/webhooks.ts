// GitHub Webhook Handlers

import { createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import { getGitHubClient } from "./client";

export interface WebhookPayload {
  action?: string;
  installation?: {
    id: number;
  };
  repository?: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender?: {
    login: string;
  };
  [key: string]: any;
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  
  return signature === digest;
}

// Handle push event
export async function handlePushEvent(
  payload: WebhookPayload,
  prisma: PrismaClient
): Promise<void> {
  const { repository, commits, ref, after } = payload;
  
  if (!repository || !commits) {
    console.log("Invalid push payload");
    return;
  }
  
  // Find project with this repository
  const project = await prisma.project.findFirst({
    where: {
      githubRepoOwner: repository.owner.login,
      githubRepoName: repository.name,
    },
    include: {
      features: {
        where: {
          isActive: true,
        },
      },
    },
  });
  
  if (!project) {
    console.log(`No project found for repository ${repository.full_name}`);
    return;
  }
  
  console.log(`Processing push to ${project.name}`);
  
  // Get commit details
  const githubClient = getGitHubClient();
  const commitSha = after;
  
  try {
    const commit = await githubClient.getCommit(
      project.githubInstallationId!,
      repository.owner.login,
      repository.name,
      commitSha
    );
    
    const diff = await githubClient.getCommitDiff(
      project.githubInstallationId!,
      repository.owner.login,
      repository.name,
      commitSha
    );
    
    // Analyze changes and suggest impacted features
    const changedFiles = commit.files?.map((f) => f.filename) || [];
    const impactedFeatures = analyzeImpactedFeatures(
      changedFiles,
      project.features
    );
    
    // Create AI-suggested test cycle (draft)
    if (impactedFeatures.length > 0) {
      await prisma.testCycle.create({
        data: {
          projectId: project.id,
          name: `Auto-suggested for ${commitSha.substring(0, 7)}`,
          description: `Automatically suggested based on code changes in commit ${commitSha}`,
          version: ref.replace("refs/heads/", ""),
          branch: ref.replace("refs/heads/", ""),
          commitSha,
          commitMessage: commit.commit.message,
          status: "DRAFT",
          suggestedByAI: true,
          impactedFeatures: impactedFeatures.map((f) => f.id),
        },
      });
      
      console.log(
        `Created suggested test cycle for ${project.name} with ${impactedFeatures.length} impacted features`
      );
    }
  } catch (error) {
    console.error("Error processing push event:", error);
  }
}

// Handle pull request event
export async function handlePullRequestEvent(
  payload: WebhookPayload,
  prisma: PrismaClient
): Promise<void> {
  const { action, repository, pull_request } = payload;
  
  if (!repository || !pull_request) {
    console.log("Invalid pull request payload");
    return;
  }
  
  // Find project
  const project = await prisma.project.findFirst({
    where: {
      githubRepoOwner: repository.owner.login,
      githubRepoName: repository.name,
    },
  });
  
  if (!project) {
    console.log(`No project found for repository ${repository.full_name}`);
    return;
  }
  
  console.log(`Processing PR ${pull_request.number} (${action}) for ${project.name}`);
  
  if (action === "opened" || action === "synchronize") {
    // Get PR files
    const githubClient = getGitHubClient();
    
    try {
      const files = await githubClient.getPullRequestFiles(
        project.githubInstallationId!,
        repository.owner.login,
        repository.name,
        pull_request.number
      );
      
      // Find related test cycles
      const relatedCycles = await prisma.testCycle.findMany({
        where: {
          projectId: project.id,
          branch: pull_request.head.ref,
          status: {
            in: ["COMPLETED"],
          },
        },
        include: {
          testCaseInstances: {
            include: {
              artifact: true,
            },
          },
        },
        orderBy: {
          completedAt: "desc",
        },
        take: 1,
      });
      
      // Create check run
      if (relatedCycles.length > 0) {
        const cycle = relatedCycles[0];
        const passed = cycle.testCaseInstances.filter(
          (tci) => tci.status === "PASSED"
        ).length;
        const total = cycle.testCaseInstances.length;
        
        await githubClient.createCheckRun(
          project.githubInstallationId!,
          repository.owner.login,
          repository.name,
          {
            name: "BetaOps Tests",
            head_sha: pull_request.head.sha,
            status: "completed",
            conclusion: passed === total ? "success" : "failure",
            output: {
              title: `Test Results: ${passed}/${total} passed`,
              summary: `Test cycle: ${cycle.name}\n\nPassed: ${passed}\nFailed: ${total - passed}`,
            },
          }
        );
      } else {
        // No tests run yet
        await githubClient.createCheckRun(
          project.githubInstallationId!,
          repository.owner.login,
          repository.name,
          {
            name: "BetaOps Tests",
            head_sha: pull_request.head.sha,
            status: "completed",
            conclusion: "neutral",
            output: {
              title: "No tests run",
              summary: "No test cycles found for this branch",
            },
          }
        );
      }
    } catch (error) {
      console.error("Error processing pull request event:", error);
    }
  }
}

// Handle issues event
export async function handleIssuesEvent(
  payload: WebhookPayload,
  prisma: PrismaClient
): Promise<void> {
  const { action, repository, issue } = payload;
  
  if (!repository || !issue) {
    console.log("Invalid issues payload");
    return;
  }
  
  // Find project
  const project = await prisma.project.findFirst({
    where: {
      githubRepoOwner: repository.owner.login,
      githubRepoName: repository.name,
    },
  });
  
  if (!project) {
    return;
  }
  
  // Find issue link
  const issueLink = await prisma.issueLink.findUnique({
    where: {
      projectId_githubIssueNumber: {
        projectId: project.id,
        githubIssueNumber: issue.number,
      },
    },
  });
  
  if (!issueLink) {
    return;
  }
  
  console.log(`Syncing issue ${issue.number} (${action}) for ${project.name}`);
  
  // Update issue link
  await prisma.issueLink.update({
    where: {
      id: issueLink.id,
    },
    data: {
      githubIssueState: issue.state,
      githubIssueTitle: issue.title,
      lastSyncedAt: new Date(),
    },
  });
  
  // Create sync event
  await prisma.issueSyncEvent.create({
    data: {
      issueLinkId: issueLink.id,
      eventType: action,
      eventData: {
        state: issue.state,
        title: issue.title,
        closedAt: issue.closed_at,
      },
    },
  });
  
  // If issue was closed, mark test for retest
  if (action === "closed") {
    await prisma.testCaseInstance.update({
      where: {
        id: issueLink.testCaseInstanceId,
      },
      data: {
        status: "RETEST_REQUIRED",
      },
    });
  }
  
  // If issue was reopened, mark test as failed
  if (action === "reopened") {
    await prisma.testCaseInstance.update({
      where: {
        id: issueLink.testCaseInstanceId,
      },
      data: {
        status: "FAILED",
      },
    });
  }
}

// Analyze impacted features based on changed files
function analyzeImpactedFeatures(
  changedFiles: string[],
  features: any[]
): any[] {
  // Simple heuristic: match file paths to feature names/tags
  const impactedFeatures: any[] = [];
  
  for (const feature of features) {
    const featureName = feature.name.toLowerCase();
    const featureTags = Array.isArray(feature.tags)
      ? feature.tags.map((t: string) => t.toLowerCase())
      : [];
    
    for (const file of changedFiles) {
      const fileLower = file.toLowerCase();
      
      // Check if file path contains feature name or tags
      if (
        fileLower.includes(featureName) ||
        featureTags.some((tag) => fileLower.includes(tag))
      ) {
        if (!impactedFeatures.find((f) => f.id === feature.id)) {
          impactedFeatures.push(feature);
        }
        break;
      }
    }
  }
  
  // If no specific features matched, consider all features
  if (impactedFeatures.length === 0 && changedFiles.length > 0) {
    // For major changes, suggest testing all critical features
    return features.filter((f) => f.riskLevel === "HIGH" || f.riskLevel === "CRITICAL");
  }
  
  return impactedFeatures;
}
