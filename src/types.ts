/**
 * Type definitions for lang-box
 */

export interface Config {
  ghToken: string;
  gistId: string;
  username: string;
  days: number;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  parents: Array<{ sha: string }>;
  files: GitHubFile[];
}

export interface GitHubFile {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  patch?: string;
}

export interface ProcessedFile {
  path: string;
  additions: number;
  deletions: number;
  changes: number;
  status: string;
  patch?: string;
}

export interface Language {
  name: string;
  percent: number;
  additions: number;
  deletions: number;
  count: number;
}

export interface LinguistResult {
  [language: string]: {
    percentage: string;
    files: string[];
  };
}

/**
 * GitHub Event from Octokit API
 * Using Octokit's types but with our specific requirements
 */
export interface GitHubEvent {
  type: string | null;
  actor: {
    login: string;
  };
  repo: {
    name: string;
  };
  payload: {
    commits?: Array<{
      sha: string;
      distinct: boolean;
    }>;
    // Other event payloads are ignored
    [key: string]: unknown;
  };
  created_at: string | null;
}

/**
 * Type guard for PushEvent
 */
export function isPushEvent(event: GitHubEvent): event is GitHubEvent & {
  payload: { commits: Array<{ sha: string; distinct: boolean }> };
} {
  return event.type === 'PushEvent' && Array.isArray(event.payload.commits);
}

export interface GitHubGist {
  files: {
    [filename: string]: {
      filename: string;
      content: string;
    };
  };
}
