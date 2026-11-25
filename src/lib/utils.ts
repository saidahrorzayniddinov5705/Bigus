/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pulls a YouTube video ID out of either a normal YouTube URL or an old
// stored <iframe> embed string. We only ever render this ID ourselves inside
// a fixed, known-safe iframe template — never the raw HTML a video record
// might carry — so a malicious "video" entry (e.g. one written directly to
// the database) can't inject a script tag or other HTML into the page.
export function extractYoutubeId(input?: string | null): string | null {
  if (!input) return null;
  const match = input.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}
