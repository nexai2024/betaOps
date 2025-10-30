// AI Provider Types and Interfaces

import { z } from "zod";

// ============================================================================
// Core Types
// ============================================================================

export interface AIProvider {
  name: string;
  models: string[];
  generateUserStories(context: ProjectContext): Promise<UserStory[]>;
  generateTestCases(
    story: UserStory,
    constraints: TestConstraints
  ): Promise<TestCase[]>;
  analyzeFailure(
    test: TestCase,
    evidence: FailureEvidence
  ): Promise<RootCauseAnalysis>;
  summarizeWeekly(
    project: ProjectSummaryContext,
    metrics: ProjectMetrics
  ): Promise<WeeklySummary>;
  suggestTestScope(
    changes: CodeChange[],
    features: Feature[]
  ): Promise<TestScopeRec ommendation>;
}

// ============================================================================
// Context & Input Types
// ============================================================================

export interface ProjectContext {
  projectId: string;
  name: string;
  description?: string;
  regulatoryRegime?: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  
  // Source control context
  repositories: Repository[];
  recentCommits: Commit[];
  
  // Feature context
  features: Feature[];
  
  // Existing artifacts
  existingStories: UserStory[];
  existingTestCases: TestCase[];
  
  // Constraints
  testConstraints: TestConstraints;
}

export interface Repository {
  url: string;
  branch: string;
  readme?: string;
  changelog?: string;
}

export interface Commit {
  sha: string;
  message: string;
  diff: string;
  author: string;
  timestamp: Date;
  filesChanged: string[];
}

export interface Feature {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  parentId?: string;
}

export interface TestConstraints {
  browsers?: string[];
  devices?: string[];
  performanceSLOs?: PerformanceSLO[];
  dataSensitivity?: "public" | "internal" | "confidential" | "restricted";
  hasPII?: boolean;
  complianceRequirements?: string[];
}

export interface PerformanceSLO {
  metric: string;
  threshold: number;
  unit: string;
}

// ============================================================================
// Output Types
// ============================================================================

export interface UserStory {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  featureIds: string[];
  tags: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimatedComplexity?: number;
}

export interface TestCase {
  title: string;
  description: string;
  preconditions?: string[];
  steps: TestStep[];
  expectedResult: string;
  featureIds: string[];
  tags: string[];
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: "functional" | "security" | "performance" | "accessibility" | "integration";
}

export interface TestStep {
  order: number;
  action: string;
  expectedBehavior?: string;
  data?: Record<string, any>;
}

export interface FailureEvidence {
  testCaseId: string;
  testCaseName: string;
  status: "FAILED" | "BLOCKED";
  executionNotes?: string;
  reproSteps?: string;
  errorMessages: string[];
  logs: string[];
  screenshots?: string[];
  environment: {
    name: string;
    url?: string;
    browser?: string;
    device?: string;
  };
  commitSha?: string;
  codeChanges?: CodeChange[];
}

export interface CodeChange {
  file: string;
  type: "added" | "modified" | "deleted";
  diff: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface RootCauseAnalysis {
  summary: string;
  likelyCauses: Cause[];
  relatedCommits: string[];
  recommendedActions: string[];
  confidence: number; // 0-1
}

export interface Cause {
  description: string;
  likelihood: number; // 0-1
  evidence: string[];
  suggestedFix?: string;
}

export interface ProjectSummaryContext {
  projectId: string;
  name: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  features: Feature[];
  recentCycles: TestCycleSummary[];
}

export interface TestCycleSummary {
  id: string;
  name: string;
  version: string;
  completedAt?: Date;
  totalTests: number;
  passed: number;
  failed: number;
  blocked: number;
}

export interface ProjectMetrics {
  testExecution: {
    totalTests: number;
    passRate: number;
    failRate: number;
    avgExecutionTime: number;
  };
  issues: {
    totalCreated: number;
    totalClosed: number;
    avgTimeToClose: number;
    criticalOpen: number;
  };
  coverage: {
    featuresCovered: number;
    totalFeatures: number;
    coverageByRisk: Record<string, number>;
  };
  trends: {
    passingTrend: number[]; // Last N cycles
    flakyTests: string[];
  };
}

export interface WeeklySummary {
  overview: string;
  keyMetrics: {
    label: string;
    value: string | number;
    trend?: "up" | "down" | "stable";
  }[];
  riskHotspots: RiskHotspot[];
  recommendations: string[];
  nextCycleScope: string[];
}

export interface RiskHotspot {
  feature: string;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedActions: string[];
}

export interface TestScopeRecommendation {
  impactedFeatures: string[];
  suggestedTests: string[];
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasoning: string;
  confidence: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AIProviderConfig {
  name: string;
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  timeout?: number; // milliseconds
}

export interface AIGenerationOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
}

// ============================================================================
// Safety & Moderation Types
// ============================================================================

export interface SafetyConfig {
  enableContentModeration: boolean;
  enablePromptInjectionDetection: boolean;
  enablePIIDetection: boolean;
  maxPromptLength: number;
  maxResponseLength: number;
  allowedDomains?: string[];
  blockedPatterns?: RegExp[];
}

export interface ModerationResult {
  safe: boolean;
  violations: string[];
  confidence: number;
}

export interface PIIDetectionResult {
  hasPII: boolean;
  piiTypes: string[];
  locations: PIILocation[];
}

export interface PIILocation {
  type: string; // "email", "ssn", "credit_card", etc.
  start: number;
  end: number;
  redacted: string;
}

// ============================================================================
// Audit & Logging Types
// ============================================================================

export interface AIAuditLog {
  id: string;
  provider: string;
  model: string;
  task: string;
  promptHash: string;
  inputTokens?: number;
  outputTokens?: number;
  duration: number;
  status: "success" | "error";
  error?: string;
  userId: string;
  projectId?: string;
  timestamp: Date;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

export const UserStorySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  acceptanceCriteria: z.array(z.string()).min(1),
  featureIds: z.array(z.string()),
  tags: z.array(z.string()),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  estimatedComplexity: z.number().min(1).max(10).optional(),
});

export const TestCaseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  preconditions: z.array(z.string()).optional(),
  steps: z.array(
    z.object({
      order: z.number(),
      action: z.string(),
      expectedBehavior: z.string().optional(),
      data: z.record(z.any()).optional(),
    })
  ),
  expectedResult: z.string(),
  featureIds: z.array(z.string()),
  tags: z.array(z.string()),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  type: z.enum(["functional", "security", "performance", "accessibility", "integration"]),
});

export const RootCauseAnalysisSchema = z.object({
  summary: z.string(),
  likelyCauses: z.array(
    z.object({
      description: z.string(),
      likelihood: z.number().min(0).max(1),
      evidence: z.array(z.string()),
      suggestedFix: z.string().optional(),
    })
  ),
  relatedCommits: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
