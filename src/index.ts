/**
 * lang-box - GitHub Language Stats Gist Updater
 *
 * Fetches recent commits from GitHub, analyzes languages using linguist,
 * and updates a pinned gist with language statistics.
 */

import { ApiClient } from './api.js';
import { createContent } from './text.js';
import { runLinguist } from './linguist.js';
import type { ProcessedFile } from './types.js';

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
        (event) =>
          event.type === 'PushEvent' &&
          event.actor.login.toLowerCase() === config.username.toLowerCase()
      );

      const recentPushEvents = pushEvents.filter(
        (event) => event.created_at && new Date(event.created_at) > fromDate
      );

      console.log(`${recentPushEvents.length} events fetched from page ${page + 1}.`);

      const isEnd = recentPushEvents.length < pushEvents.length;

      // Fetch commit details using the head SHA from each push event
      // Events API doesn't include commits array, only head SHA
      for (const event of recentPushEvents) {
        try {
          const [owner, repo] = event.repo.name.split('/');
          const headSha = event.payload.head;

          if (!headSha) {
            console.log(`  Skipping push event for ${event.repo.name}: no head SHA`);
            continue;
          }

          const commit = await api.fetchCommit(owner, repo, headSha);
          commits.push(commit);
        } catch (error) {
          console.log(`  Failed to fetch commit for ${event.repo.name}:`, error instanceof Error ? error.message : error);
        }
      }

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

  if (langs.length === 0) {
    console.log('No languages detected. Skipping gist update.');
    console.log('This usually means no commits were found in the specified time period.');
    return;
  }

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
