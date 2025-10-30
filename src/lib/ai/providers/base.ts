// Base AI Provider Abstract Class

import {
  AIProvider,
  ProjectContext,
  UserStory,
  TestCase,
  TestConstraints,
  FailureEvidence,
  RootCauseAnalysis,
  ProjectSummaryContext,
  ProjectMetrics,
  WeeklySummary,
  CodeChange,
  Feature,
  TestScopeRecommendation,
  AIGenerationOptions,
  AIAuditLog,
  UserStorySchema,
  TestCaseSchema,
  RootCauseAnalysisSchema,
} from "../types";
import {
  moderateContent,
  detectPII,
  redactPII,
  buildSystemPrompt,
  DEFAULT_SAFETY_CONFIG,
  SafetyConfig,
} from "../safety";
import { createHash } from "crypto";

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;
  abstract models: string[];
  
  protected safetyConfig: SafetyConfig = DEFAULT_SAFETY_CONFIG;
  
  constructor(protected apiKey: string, protected defaultModel: string) {}
  
  // ============================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================================================
  
  protected abstract callAPI(
    prompt: string,
    systemPrompt: string,
    options: AIGenerationOptions
  ): Promise<string>;
  
  // ============================================================================
  // Public Interface Methods
  // ============================================================================
  
  async generateUserStories(context: ProjectContext): Promise<UserStory[]> {
    const task = "generate_user_stories";
    const systemPrompt = buildSystemPrompt(task);
    
    // Build the prompt
    const prompt = this.buildUserStoryPrompt(context);
    
    // Safety checks
    await this.performSafetyChecks(prompt);
    
    // Generate
    const response = await this.generateWithRetry(prompt, systemPrompt, {
      temperature: 0.7,
      maxTokens: 4000,
    });
    
    // Parse and validate
    const stories = this.parseJSONResponse<UserStory[]>(response);
    const validated = stories.map((story) => UserStorySchema.parse(story));
    
    // Audit log
    await this.logGeneration(task, prompt, response, context.projectId);
    
    return validated;
  }
  
  async generateTestCases(
    story: UserStory,
    constraints: TestConstraints
  ): Promise<TestCase[]> {
    const task = "generate_test_cases";
    const systemPrompt = buildSystemPrompt(task);
    
    const prompt = this.buildTestCasePrompt(story, constraints);
    
    await this.performSafetyChecks(prompt);
    
    const response = await this.generateWithRetry(prompt, systemPrompt, {
      temperature: 0.6,
      maxTokens: 6000,
    });
    
    const testCases = this.parseJSONResponse<TestCase[]>(response);
    const validated = testCases.map((tc) => TestCaseSchema.parse(tc));
    
    await this.logGeneration(task, prompt, response);
    
    return validated;
  }
  
  async analyzeFailure(
    test: TestCase,
    evidence: FailureEvidence
  ): Promise<RootCauseAnalysis> {
    const task = "analyze_failure";
    const systemPrompt = buildSystemPrompt(task);
    
    const prompt = this.buildFailureAnalysisPrompt(test, evidence);
    
    await this.performSafetyChecks(prompt);
    
    // Redact PII from logs before sending
    const { redacted: redactedPrompt } = redactPII(prompt);
    
    const response = await this.generateWithRetry(redactedPrompt, systemPrompt, {
      temperature: 0.4,
      maxTokens: 3000,
    });
    
    const analysis = this.parseJSONResponse<RootCauseAnalysis>(response);
    const validated = RootCauseAnalysisSchema.parse(analysis);
    
    await this.logGeneration(task, prompt, response, evidence.testCaseId);
    
    return validated;
  }
  
  async summarizeWeekly(
    project: ProjectSummaryContext,
    metrics: ProjectMetrics
  ): Promise<WeeklySummary> {
    const task = "summarize_weekly";
    const systemPrompt = buildSystemPrompt(task);
    
    const prompt = this.buildWeeklySummaryPrompt(project, metrics);
    
    await this.performSafetyChecks(prompt);
    
    const response = await this.generateWithRetry(prompt, systemPrompt, {
      temperature: 0.5,
      maxTokens: 4000,
    });
    
    const summary = this.parseJSONResponse<WeeklySummary>(response);
    
    await this.logGeneration(task, prompt, response, project.projectId);
    
    return summary;
  }
  
  async suggestTestScope(
    changes: CodeChange[],
    features: Feature[]
  ): Promise<TestScopeRecommendation> {
    const task = "suggest_test_scope";
    const systemPrompt = buildSystemPrompt(task);
    
    const prompt = this.buildTestScopePrompt(changes, features);
    
    await this.performSafetyChecks(prompt);
    
    const response = await this.generateWithRetry(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 2000,
    });
    
    const recommendation = this.parseJSONResponse<TestScopeRecommendation>(response);
    
    await this.logGeneration(task, prompt, response);
    
    return recommendation;
  }
  
  // ============================================================================
  // Prompt Building Methods
  // ============================================================================
  
  protected buildUserStoryPrompt(context: ProjectContext): string {
    return `
Generate user stories for the following project:

Project: ${context.name}
Description: ${context.description || "N/A"}
Regulatory Regime: ${context.regulatoryRegime || "None"}
Risk Level: ${context.riskLevel}

Features:
${context.features.map((f) => `- ${f.name}: ${f.description || "No description"} [Risk: ${f.riskLevel}]`).join("\n")}

Recent Changes:
${context.recentCommits.slice(0, 5).map((c) => `- ${c.sha.substring(0, 7)}: ${c.message}`).join("\n")}

Test Constraints:
${JSON.stringify(context.testConstraints, null, 2)}

Based on this context, generate 3-5 user stories that cover the main functionality and edge cases.
Consider the regulatory requirements and risk level.

Return ONLY a JSON array of user stories. No additional text.
`;
  }
  
  protected buildTestCasePrompt(story: UserStory, constraints: TestConstraints): string {
    return `
Generate test cases for the following user story:

Title: ${story.title}
Description: ${story.description}

Acceptance Criteria:
${story.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Risk Level: ${story.riskLevel}
Tags: ${story.tags.join(", ")}

Test Constraints:
${JSON.stringify(constraints, null, 2)}

Generate 3-7 comprehensive test cases covering:
1. Happy path scenarios
2. Edge cases
3. Error handling
4. ${constraints.hasPII ? "PII handling and data privacy" : "Data validation"}
5. ${story.riskLevel === "HIGH" || story.riskLevel === "CRITICAL" ? "Security scenarios" : "Integration scenarios"}

Include accessibility and usability considerations where relevant.

Return ONLY a JSON array of test cases. No additional text.
`;
  }
  
  protected buildFailureAnalysisPrompt(test: TestCase, evidence: FailureEvidence): string {
    return `
Analyze the following test failure:

Test Case: ${test.title}
Description: ${test.description}
Expected Result: ${test.expectedResult}

Failure Evidence:
Status: ${evidence.status}
Environment: ${evidence.environment.name} (${evidence.environment.browser || "N/A"})
Commit: ${evidence.commitSha || "Unknown"}

Error Messages:
${evidence.errorMessages.join("\n")}

Logs (last 20 lines):
${evidence.logs.slice(-20).join("\n")}

Execution Notes:
${evidence.executionNotes || "None"}

${evidence.codeChanges ? `Recent Code Changes:\n${evidence.codeChanges.map((c) => `${c.file} (${c.type}): +${c.linesAdded} -${c.linesRemoved}`).join("\n")}` : ""}

Analyze this failure and provide:
1. A summary of what went wrong
2. Likely root causes ranked by probability
3. Related commits that might have introduced the issue
4. Recommended actions to fix
5. Confidence level in your analysis

Return ONLY a JSON object with the analysis. No additional text.
`;
  }
  
  protected buildWeeklySummaryPrompt(
    project: ProjectSummaryContext,
    metrics: ProjectMetrics
  ): string {
    return `
Generate a weekly summary for the following project:

Project: ${project.name}
Time Range: ${project.timeRange.start.toISOString().split("T")[0]} to ${project.timeRange.end.toISOString().split("T")[0]}

Test Execution Metrics:
- Total Tests: ${metrics.testExecution.totalTests}
- Pass Rate: ${(metrics.testExecution.passRate * 100).toFixed(1)}%
- Fail Rate: ${(metrics.testExecution.failRate * 100).toFixed(1)}%
- Avg Execution Time: ${metrics.testExecution.avgExecutionTime}s

Issue Metrics:
- Created: ${metrics.issues.totalCreated}
- Closed: ${metrics.issues.totalClosed}
- Avg Time to Close: ${metrics.issues.avgTimeToClose}h
- Critical Open: ${metrics.issues.criticalOpen}

Coverage:
- Features Covered: ${metrics.coverage.featuresCovered}/${metrics.coverage.totalFeatures}
- Coverage by Risk: ${JSON.stringify(metrics.coverage.coverageByRisk)}

Recent Cycles:
${project.recentCycles.map((c) => `- ${c.name} (${c.version}): ${c.passed}/${c.totalTests} passed`).join("\n")}

Flaky Tests:
${metrics.trends.flakyTests.slice(0, 5).join(", ") || "None identified"}

Generate a comprehensive weekly summary with:
1. Overview paragraph
2. Key metrics with trends
3. Risk hotspots requiring attention
4. Actionable recommendations
5. Suggested scope for next cycle

Return ONLY a JSON object with the summary. No additional text.
`;
  }
  
  protected buildTestScopePrompt(changes: CodeChange[], features: Feature[]): string {
    return `
Analyze the following code changes and recommend test scope:

Code Changes:
${changes.map((c) => `- ${c.file} (${c.type}): +${c.linesAdded} -${c.linesRemoved}\n  Diff preview: ${c.diff.substring(0, 200)}...`).join("\n")}

Available Features:
${features.map((f) => `- ${f.id}: ${f.name} [Risk: ${f.riskLevel}] Tags: ${f.tags.join(", ")}`).join("\n")}

Based on the code changes:
1. Identify which features are likely impacted
2. Recommend specific tests to run
3. Assign a priority level
4. Explain your reasoning
5. Provide a confidence score

Return ONLY a JSON object with recommendations. No additional text.
`;
  }
  
  // ============================================================================
  // Safety & Validation
  // ============================================================================
  
  protected async performSafetyChecks(prompt: string): Promise<void> {
    const moderation = await moderateContent(prompt, this.safetyConfig);
    
    if (!moderation.safe) {
      throw new Error(
        `Content moderation failed: ${moderation.violations.join(", ")}`
      );
    }
    
    // Check for PII if enabled
    if (this.safetyConfig.enablePIIDetection) {
      const piiDetection = detectPII(prompt);
      if (piiDetection.hasPII) {
        console.warn(
          `PII detected in prompt: ${piiDetection.piiTypes.join(", ")}`
        );
        // Don't throw, but log for audit
      }
    }
  }
  
  protected parseJSONResponse<T>(response: string): T {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }
    
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }
  
  // ============================================================================
  // Retry Logic
  // ============================================================================
  
  protected async generateWithRetry(
    prompt: string,
    systemPrompt: string,
    options: AIGenerationOptions,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.callAPI(prompt, systemPrompt, options);
      } catch (error) {
        lastError = error as Error;
        console.error(`AI generation attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }
    
    throw new Error(
      `AI generation failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }
  
  // ============================================================================
  // Audit Logging
  // ============================================================================
  
  protected async logGeneration(
    task: string,
    prompt: string,
    response: string,
    projectId?: string
  ): Promise<void> {
    const promptHash = createHash("sha256").update(prompt).digest("hex");
    
    // In a real implementation, this would write to the database
    // For now, we'll just log to console
    console.log("AI Generation Log:", {
      provider: this.name,
      model: this.defaultModel,
      task,
      promptHash,
      promptLength: prompt.length,
      responseLength: response.length,
      projectId,
      timestamp: new Date().toISOString(),
    });
  }
  
  protected hashPrompt(prompt: string): string {
    return createHash("sha256").update(prompt).digest("hex");
  }
}
