/**
 * Linguist integration for language detection
 * Uses github-linguist CLI tool to analyze code files
 * CRITICAL: Runs in a temporary directory to avoid deleting project files
 */

import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { promisify } from 'util';
import { tmpdir } from 'os';
import type { ProcessedFile, Language, LinguistResult } from './types.js';

const execAsync = promisify(exec);

/**
 * Execute a shell command asynchronously
 */
const run = async (command: string, cwd?: string): Promise<string> => {
  console.debug(`run > ${command}`);
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024,
      cwd
    });
    if (stderr) {
      console.debug(`stderr: ${stderr}`);
    }
    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Command failed: ${message}`);
  }
};

/**
 * Create dummy text with newlines for size estimation
 */
const createDummyText = (count: number): string => {
  return '\n'.repeat(count);
};

/**
 * Run linguist analysis on files
 * Creates a temporary git repo with the files and runs linguist
 */
export const runLinguist = async (files: ProcessedFile[]): Promise<Language[]> => {
  // Create a unique temporary directory for linguist analysis
  const tmpDir = join(tmpdir(), `.linguist-tmp-${Date.now()}`);

  try {
    // Create temporary directory
    await fs.mkdir(tmpDir, { recursive: true });
    console.log(`Created temporary directory: ${tmpDir}`);

    // Initialize git repo in temp directory
    await run('git init', tmpDir);
    await run('git checkout --orphan temp', tmpDir);

    // Map files to simple numbered names with original extensions
    const datas = files.map((d, i) => ({
      ...d,
      path: `${i}${extname(d.path)}`,
    }));

    // Create path to file mapping for later lookup
    const pathFileMap = datas.reduce<Record<string, ProcessedFile>>((acc, d) => {
      acc[d.path] = d;
      return acc;
    }, {});

    // Write files and setup git
    await Promise.all([
      ...datas.map((d) =>
        fs.writeFile(
          join(tmpDir, d.path),
          d.patch
            ? d.patch
                .split('\n')
                .filter((line) => /^[-+]/.test(line))
                .map((line) => line.substring(1))
                .join('\n')
            : d.changes
            ? // If the diff is too large, GitHub API doesn't return patch
              // so calculate from changed lines (not precise)
              createDummyText(d.changes)
            : ''
        )
      ),
      fs.writeFile(join(tmpDir, '.gitattributes'), '*.* linguist-detectable'),
      run('git config user.name "dummy"', tmpDir),
      run('git config user.email "dummy@github.com"', tmpDir),
    ]);

    await run('git add .', tmpDir);
    await run('git commit -m "dummy"', tmpDir);

    // Run linguist and parse JSON output
    const stdout = await run('github-linguist --breakdown --json', tmpDir);
    const res: LinguistResult = JSON.parse(stdout);

    // Process linguist results
    const langs = Object.entries(res)
      .reduce<Language[]>((acc, [name, v]) => {
        acc.push({
          name,
          percent: parseFloat(v.percentage),
          additions: v.files.reduce(
            (sum, p) => sum + (pathFileMap[p]?.additions ?? 0),
            0
          ),
          deletions: v.files.reduce(
            (sum, p) => sum + (pathFileMap[p]?.deletions ?? 0),
            0
          ),
          count: v.files.length,
        });
        return acc;
      }, [])
      .sort((a, b) => b.percent - a.percent);

    return langs;
  } finally {
    // Cleanup: Remove temporary directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
      console.log(`Cleaned up temporary directory: ${tmpDir}`);
    } catch (error) {
      console.warn(`Failed to cleanup temp directory: ${error}`);
    }
  }
};
