/**
 * Text formatting utilities for generating the gist content
 */

import type { Language } from './types.js';

/**
 * Trim string to maximum length with ellipsis
 */
const trimRightStr = (str: string, len: number): string => {
  return str.length > len ? str.substring(0, len - 1) + '…' : str;
};

/**
 * Format large numbers with unit suffixes (k, M, G, etc.)
 */
const formatNum = (n: number): string => {
  const units = [
    { u: 'E', v: 10 ** 18 },
    { u: 'P', v: 10 ** 15 },
    { u: 'T', v: 10 ** 12 },
    { u: 'G', v: 10 ** 9 },
    { u: 'M', v: 10 ** 6 },
    { u: 'k', v: 10 ** 3 },
  ];

  for (const { u, v } of units) {
    const top = n / v;
    if (top >= 1) {
      return `${top.toFixed(1)}${u}`;
    }
  }
  return `${n}`;
};

/**
 * Generate a Unicode bar chart
 * @param percent - Percentage value (0-100)
 * @param size - Width of the bar in characters
 */
const generateBarChart = (percent: number, size: number): string => {
  const syms = '░▏▎▍▌▋▊▉█';

  const frac = Math.floor((size * 8 * percent) / 100);
  const barsFull = Math.floor(frac / 8);

  if (barsFull >= size) {
    return syms.substring(8, 9).repeat(size);
  }

  const semi = frac % 8;

  return [
    syms.substring(8, 9).repeat(barsFull),
    syms.substring(semi, semi + 1),
  ]
    .join('')
    .padEnd(size, syms.substring(0, 1));
};

/**
 * Create the gist content from language data
 */
export const createContent = (languages: Language[]): string => {
  const lines: string[] = [];

  for (const data of languages) {
    const { name, percent, additions, deletions } = data;

    const line = [
      trimRightStr(name, 10).padEnd(10),
      ('+' + formatNum(additions)).padStart(7) +
        '/' +
        ('-' + formatNum(deletions)).padStart(7),
      generateBarChart(percent, 21),
    ].join(' ') +
      percent.toFixed(1).padStart(5) +
      '%';

    lines.push(line);
  }

  return lines.join('\n');
};
