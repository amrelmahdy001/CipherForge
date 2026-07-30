// crypto.js
// ---------------------------------------------------------------------------
// All cryptographic primitives live here. Nothing in this file writes to
// storage, logs secrets, or persists state — everything is scoped to
// function calls and garbage-collected as soon as it's no longer referenced.
//
// Pipeline:
//   Master Passkey  --Argon2id-->  Secret Key
//   Secret Key + (Platform, Username, Version)  --HMAC-SHA256-->  Seed
//
// The Master Passkey is NEVER used directly to build the output password —
// it only ever produces the Secret Key, one extra step removed from the
// final result.
// ---------------------------------------------------------------------------

import { argon2id } from "https://cdn.jsdelivr.net/npm/hash-wasm@4/dist/hash-wasm.esm.js";

const textEncoder = new TextEncoder();

// Fixed, application-level Argon2id salt.
//
// This is intentionally constant and public. It is NOT a per-user secret —
// the Master Passkey is the secret being stretched. A fixed salt is what
// makes the Secret Key reproducible from the same Master Passkey every time,
// which is required for a deterministic generator (no salt can be stored).
const ARGON2_SALT = textEncoder.encode("deterministic-pwgen:argon2id:salt:v1");

const ARGON2_PARAMS = Object.freeze({
  parallelism: 1,
  iterations: 2, // تكراران كافيان
  memorySize: 16384, // 16 ميجابايت بدلاً من 64
  hashLength: 32,
});
/**
 * Derives a 32-byte Secret Key from the Master Passkey using Argon2id.
 * @param {string} masterPasskey
 * @returns {Promise<Uint8Array>} 32-byte secret key
 */
export async function deriveSecretKey(masterPasskey) {
  console.log("[crypto] deriveSecretKey called, passkey length:", masterPasskey ? masterPasskey.length : 0);
  if (!masterPasskey) {
    console.error("[crypto] Master Passkey is empty");
    throw new Error("Master Passkey is required.");
  }

  try {
    console.log("[crypto] Starting argon2id with params:", ARGON2_PARAMS);
    const derived = await argon2id({ // تم تصحيح الاسم من hashwasm.argon2id إلى argon2id
      password: textEncoder.encode(masterPasskey),
      salt: ARGON2_SALT,
      parallelism: ARGON2_PARAMS.parallelism,
      iterations: ARGON2_PARAMS.iterations,
      memorySize: ARGON2_PARAMS.memorySize,
      hashLength: ARGON2_PARAMS.hashLength,
      outputType: "binary",
    });
    console.log("[crypto] argon2id finished, output length:", derived.length);
    return new Uint8Array(derived);
  } catch (err) {
    console.error("[crypto] deriveSecretKey error:", err);
    throw err;
  }
}

/**
 * Derives a deterministic 32-byte seed via HMAC-SHA256, keyed by the Secret
 * Key, over the message Platform | Username | Version.
 * @param {Uint8Array} secretKey
 * @param {string} platform
 * @param {string} username
 * @param {string} version
 * @returns {Promise<Uint8Array>} 32-byte seed
 */
export async function deriveSeed(secretKey, platform, username, version) {
  console.log("[crypto] deriveSeed called", { platform, username, version });
  const message = textEncoder.encode(
    `${platform}\u0000${username}\u0000${version}`
  );

  try {
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      secretKey,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", hmacKey, message);
    console.log("[crypto] HMAC signature length:", signature.byteLength);
    return new Uint8Array(signature);
  } catch (err) {
    console.error("[crypto] deriveSeed error:", err);
    throw err;
  }
}

/**
 * Expands the seed into successive 32-byte pseudorandom blocks via
 * SHA-256(seed || big-endian counter). Used by generator.js as an unbiased
 * byte source for mapping the seed onto the output character set.
 * @param {Uint8Array} seed
 * @param {number} blockIndex
 * @returns {Promise<Uint8Array>} 32-byte block
 */
export async function expandSeedBlock(seed, blockIndex) {
  console.log(`[crypto] expandSeedBlock block ${blockIndex}`);
  const counter = new Uint8Array(4);
  new DataView(counter.buffer).setUint32(0, blockIndex, false);

  const input = new Uint8Array(seed.length + counter.length);
  input.set(seed, 0);
  input.set(counter, seed.length);

  const digest = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(digest);
}