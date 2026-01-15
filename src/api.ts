/**
 * GitHub API client using Octokit REST API
 * Provides a typed interface for fetching GitHub data
 */

import { Octokit } from '@octokit/rest';
import type { GitHubEvent, GitHubCommit, GitHubGist } from './types.js';

export class ApiClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
      userAgent: 'lang-box/2.0',
    });
  }

  /**
   * Fetch user events from GitHub API
   * Uses authenticated endpoint to include private repo events if token has repo scope
   */
  async fetchEvents(username: string, perPage: number = 100, page: number = 0): Promise<GitHubEvent[]> {
    try {
      // Use REST API directly to match original behavior
      // This endpoint returns events for the authenticated user if username matches
      const { data } = await this.octokit.request('GET /users/{username}/events', {
        username,
        per_page: perPage,
        page,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      // Octokit returns a compatible structure
      return data as unknown as GitHubEvent[];
    } catch (error) {
      throw new Error(`Failed to fetch events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch repository events to get commit details
   * This endpoint includes full commit information in PushEvent payloads
   */
  async fetchRepoEvents(owner: string, repo: string, perPage: number = 100, page: number = 0): Promise<GitHubEvent[]> {
    try {
      const { data } = await this.octokit.request('GET /repos/{owner}/{repo}/events', {
        owner,
        repo,
        per_page: perPage,
        page,
      });
      return data as unknown as GitHubEvent[];
    } catch (error) {
      throw new Error(`Failed to fetch repo events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch a specific commit from a repository
   */
  async fetchCommit(owner: string, repo: string, ref: string): Promise<GitHubCommit> {
    try {
      const { data } = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref,
      });
      // Octokit returns a compatible structure
      return data as unknown as GitHubCommit;
    } catch (error) {
      throw new Error(`Failed to fetch commit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch a gist by ID
   */
  async fetchGist(gistId: string): Promise<GitHubGist> {
    try {
      const { data } = await this.octokit.rest.gists.get({
        gist_id: gistId,
      });
      // Octokit returns a compatible structure
      return data as unknown as GitHubGist;
    } catch (error) {
      throw new Error(`Failed to fetch gist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a gist with new content
   */
  async updateGist(gistId: string, filename: string, content: string): Promise<void> {
    try {
      await this.octokit.rest.gists.update({
        gist_id: gistId,
        files: {
          [filename]: {
            content,
          },
        },
      });
    } catch (error) {
      throw new Error(`Failed to update gist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
