// generator.js
// ---------------------------------------------------------------------------
// Converts a deterministic seed into a fixed-length password over a fixed
// character set. Uses rejection sampling against an expanding keystream so
// every character is unbiased, rather than taking seed bytes mod charset
// length directly.
// ---------------------------------------------------------------------------

import { expandSeedBlock } from "./crypto.js";

const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

export const PASSWORD_LENGTH = 20;

/**
 * Deterministically converts a seed into a PASSWORD_LENGTH-character
 * password drawn from CHARSET. Identical seeds always produce identical
 * passwords.
 * @param {Uint8Array} seed
 * @returns {Promise<string>}
 */
export async function seedToPassword(seed) {
  console.log("[generator] seedToPassword started, seed length:", seed.length);
  const charsetSize = CHARSET.length;
  console.log("[generator] charsetSize:", charsetSize);
  
  // Largest multiple of charsetSize that still fits in a byte (0-255).
  // Bytes landing at or above this threshold are discarded so that
  // `byte % charsetSize` stays uniformly distributed (no modulo bias).
  const threshold = Math.floor(256 / charsetSize) * charsetSize;
  console.log("[generator] threshold for rejection sampling:", threshold);
  
  const chars = [];
  let blockIndex = 0;
  
  while (chars.length < PASSWORD_LENGTH) {
    console.log(`[generator] Requesting block index ${blockIndex}`);
    const block = await expandSeedBlock(seed, blockIndex);
    blockIndex += 1;
    
    let usedBytes = 0;
    for (const byte of block) {
      if (chars.length >= PASSWORD_LENGTH) break;
      if (byte >= threshold) continue;
      chars.push(CHARSET[byte % charsetSize]);
      usedBytes++;
    }
    console.log(`[generator] Block ${blockIndex - 1}: used ${usedBytes} bytes, total chars: ${chars.length}`);
  }
  
  const password = chars.join("");
  console.log("[generator] Password generated successfully, length:", password.length);
  return password;
}