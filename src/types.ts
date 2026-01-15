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
    // Note: /users/{username}/events returns limited payload
    // commits array is only present in authenticated /events endpoint
    repository_id?: number;
    push_id?: number;
    ref?: string;
    head?: string;
    before?: string;
    // Other event payloads are ignored
    [key: string]: unknown;
  };
  created_at: string | null;
}

/**
 * GitHub Event with full commit details (from /repos/{owner}/{repo}/events)
 */
export interface GitHubPushEvent extends GitHubEvent {
  payload: {
    commits: Array<{
      sha: string;
      distinct: boolean;
    }>;
    ref: string;
    head: string;
    before: string;
    repository_id?: number;
    push_id?: number;
    [key: string]: unknown;
  };
}

/**
 * Type guard for PushEvent (simplified - just checks type)
 */
export function isPushEvent(event: GitHubEvent): event is GitHubPushEvent {
  return event.type === 'PushEvent';
}

export interface GitHubGist {
  files: {
    [filename: string]: {
      filename: string;
      content: string;
    };
  };
}
