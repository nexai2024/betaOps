// GitHub API Client

import { Octokit } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

export interface GitHubConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  clientId?: string;
  clientSecret?: string;
}

export class GitHubClient {
  private octokit: Octokit;
  private config: GitHubConfig;
  
  constructor(config: GitHubConfig) {
    this.config = config;
    
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: config.appId,
        privateKey: config.privateKey,
      },
    });
  }
  
  // Get installation Octokit instance
  async getInstallationClient(installationId: string): Promise<Octokit> {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: this.config.appId,
        privateKey: this.config.privateKey,
        installationId,
      },
    });
  }
  
  // Get repository information
  async getRepository(installationId: string, owner: string, repo: string) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.repos.get({
      owner,
      repo,
    });
    
    return data;
  }
  
  // Get commit information
  async getCommit(installationId: string, owner: string, repo: string, sha: string) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });
    
    return data;
  }
  
  // Get diff for commit
  async getCommitDiff(
    installationId: string,
    owner: string,
    repo: string,
    sha: string
  ): Promise<string> {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.repos.getCommit({
      owner,
      repo,
      ref: sha,
      mediaType: {
        format: "diff",
      },
    });
    
    return data as unknown as string;
  }
  
  // Get pull request information
  async getPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number
  ) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    
    return data;
  }
  
  // Get pull request files
  async getPullRequestFiles(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number
  ) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });
    
    return data;
  }
  
  // Create issue
  async createIssue(
    installationId: string,
    owner: string,
    repo: string,
    options: {
      title: string;
      body: string;
      labels?: string[];
      assignees?: string[];
    }
  ) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.issues.create({
      owner,
      repo,
      ...options,
    });
    
    return data;
  }
  
  // Update issue
  async updateIssue(
    installationId: string,
    owner: string,
    repo: string,
    issueNumber: number,
    options: {
      title?: string;
      body?: string;
      state?: "open" | "closed";
      labels?: string[];
      assignees?: string[];
    }
  ) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      ...options,
    });
    
    return data;
  }
  
  // Get issue
  async getIssue(
    installationId: string,
    owner: string,
    repo: string,
    issueNumber: number
  ) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    
    return data;
  }
  
  // Create check run (for PR status)
  async createCheckRun(
    installationId: string,
    owner: string,
    repo: string,
    options: {
      name: string;
      head_sha: string;
      status?: "queued" | "in_progress" | "completed";
      conclusion?:
        | "success"
        | "failure"
        | "neutral"
        | "cancelled"
        | "skipped"
        | "timed_out"
        | "action_required";
      output?: {
        title: string;
        summary: string;
        text?: string;
        annotations?: Array<{
          path: string;
          start_line: number;
          end_line: number;
          annotation_level: "notice" | "warning" | "failure";
          message: string;
        }>;
      };
    }
  ) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.checks.create({
      owner,
      repo,
      ...options,
    });
    
    return data;
  }
  
  // Update check run
  async updateCheckRun(
    installationId: string,
    owner: string,
    repo: string,
    checkRunId: number,
    options: {
      status?: "queued" | "in_progress" | "completed";
      conclusion?:
        | "success"
        | "failure"
        | "neutral"
        | "cancelled"
        | "skipped"
        | "timed_out"
        | "action_required";
      output?: {
        title: string;
        summary: string;
        text?: string;
      };
    }
  ) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.checks.update({
      owner,
      repo,
      check_run_id: checkRunId,
      ...options,
    });
    
    return data;
  }
  
  // List repository branches
  async listBranches(installationId: string, owner: string, repo: string) {
    const client = await this.getInstallationClient(installationId);
    
    const { data } = await client.rest.repos.listBranches({
      owner,
      repo,
    });
    
    return data;
  }
  
  // Get README
  async getReadme(installationId: string, owner: string, repo: string) {
    const client = await this.getInstallationClient(installationId);
    
    try {
      const { data } = await client.rest.repos.getReadme({
        owner,
        repo,
      });
      
      // Decode base64 content
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      
      return content;
    } catch (error) {
      // README not found
      return null;
    }
  }
}

// Singleton instance
let githubClient: GitHubClient | null = null;

export function getGitHubClient(): GitHubClient {
  if (!githubClient) {
    const config: GitHubConfig = {
      appId: process.env.GITHUB_APP_ID || "",
      privateKey: (process.env.GITHUB_APP_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
    
    if (!config.appId || !config.privateKey) {
      throw new Error("GitHub App configuration is missing");
    }
    
    githubClient = new GitHubClient(config);
  }
  
  return githubClient;
}
