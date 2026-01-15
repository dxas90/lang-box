/**
 * lang-box - GitHub Language Stats Gist Updater
 *
 * Fetches recent commits from GitHub, analyzes languages using linguist,
 * and updates a pinned gist with language statistics.
 */

import { ApiClient } from './api.js';
import { createContent } from './text.js';
import { runLinguist } from './linguist.js';
import type { ProcessedFile, GitHubEvent } from './types.js';
import { isPushEvent } from './types.js';

/**
 * Load configuration from environment variables
 */
const loadConfig = () => {
  const { GH_TOKEN, GIST_ID, USERNAME, DAYS } = process.env;

  if (!GH_TOKEN) {
    throw new Error('GH_TOKEN environment variable is required');
  }
  if (!GIST_ID) {
    throw new Error('GIST_ID environment variable is required');
  }
  if (!USERNAME) {
    throw new Error('USERNAME environment variable is required');
  }

  const days = Math.max(1, Math.min(30, Number(DAYS || 14)));

  return {
    ghToken: GH_TOKEN,
    gistId: GIST_ID,
    username: USERNAME,
    days,
  };
};

/**
 * Main execution function
 */
const main = async (): Promise<void> => {
  const config = loadConfig();
  const api = new ApiClient(config.ghToken);

  console.log(`Username: ${config.username}`);
  console.log(`Days: ${config.days}`);
  console.log('');

  // GitHub API supports 300 events at max
  // Events older than 90 days will not be fetched
  const MAX_EVENTS = 300;
  const PER_PAGE = 100;
  const pages = Math.ceil(MAX_EVENTS / PER_PAGE);
  const fromDate = new Date(Date.now() - config.days * 24 * 60 * 60 * 1000);

  const commits: Awaited<ReturnType<typeof api.fetchCommit>>[] = [];

  try {
    for (let page = 0; page < pages; page++) {
      // Fetch push events for the user
      const allEvents = await api.fetchEvents(config.username, PER_PAGE, page);

      // Filter for push events by the user
      const pushEvents = allEvents.filter(
        (event): event is GitHubEvent & { payload: { commits: Array<{ sha: string; distinct: boolean }> } } =>
          isPushEvent(event) && event.actor.login === config.username
      );

      const recentPushEvents = pushEvents.filter(
        (event) => event.created_at && new Date(event.created_at) > fromDate
      );

      const isEnd = recentPushEvents.length < pushEvents.length;
      console.log(`Fetched ${recentPushEvents.length} events from page ${page + 1}`);

      // Fetch commit details for each push event
      const commitPromises = recentPushEvents.flatMap((event) =>
        event.payload.commits
          // Ignore duplicated commits
          .filter((c) => c.distinct === true)
          .map((c) => {
            const [owner, repo] = event.repo.name.split('/');
            return api.fetchCommit(owner, repo, c.sha);
          })
      );

      const results = await Promise.allSettled(commitPromises);

      commits.push(
        ...results
          .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof api.fetchCommit>>> =>
            result.status === 'fulfilled'
          )
          .map((result) => result.value)
      );

      if (isEnd) {
        break;
      }
    }
  } catch (error) {
    console.log('No more pages to load');
  }

  console.log(`Total commits fetched: ${commits.length}`);
  console.log('');

  // Extract files from commits
  const files: ProcessedFile[] = commits
    // Ignore merge commits
    .filter((c) => c.parents.length <= 1)
    .flatMap((c) =>
      c.files.map((file) => ({
        path: file.filename,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        status: file.status,
        patch: file.patch,
      }))
    );

  // Run linguist analysis
  const langs = await runLinguist(files);
  console.log('');

  langs.forEach((l) =>
    console.log(
      `${l.name}: ${l.count} files, ${l.additions + l.deletions} changes`
    )
  );

  // Generate content for gist
  const content = createContent(langs);
  console.log('');
  console.log(content);
  console.log('');

  // Update gist
  const gist = await api.fetchGist(config.gistId);
  const filename = Object.keys(gist.files)[0];

  await api.updateGist(config.gistId, filename, content);

  console.log('✓ Gist update succeeded');
};

// Execute main function
main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
