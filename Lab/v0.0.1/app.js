// app.js
// ---------------------------------------------------------------------------
// UI orchestration only. No secret material is ever written to storage —
// the Master Passkey, Secret Key, and Seed exist solely as local variables
// for the duration of a single generate operation.
// ---------------------------------------------------------------------------

const form = document.getElementById("generator-form");
const platformInput = document.getElementById("platform");
const usernameInput = document.getElementById("username");
const passkeyInput = document.getElementById("passkey");
const versionInput = document.getElementById("version");
const generateButton = document.getElementById("generate-btn");
const outputField = document.getElementById("output");
const copyButton = document.getElementById("copy-btn");
const statusEl = document.getElementById("status");

let currentPassword = "";
let worker = null;

// Initialize Web Worker (module type because we use ES imports inside worker)
try {
  worker = new Worker("./worker.js", { type: "module" });
  console.log("[app] Web Worker initialized");
} catch (err) {
  console.error("[app] Failed to create worker:", err);
  setStatus("Worker initialization failed. Check console for details.", true);
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("status--error", isError);
}

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  // Toggle spinner class for visual feedback
  generateButton.classList.toggle("btn--loading", isBusy);
}

function resetOutput() {
  currentPassword = "";
  outputField.value = "";
  copyButton.disabled = true;
}

async function handleGenerate() {
  if (!worker) {
    setStatus("Worker not available. Please refresh the page.", true);
    return;
  }
  
  const platform = platformInput.value.trim();
  const username = usernameInput.value.trim();
  const passkey = passkeyInput.value;
  const version = versionInput.value.trim() || "1";
  
  resetOutput();
  
  if (!platform || !username || !passkey) {
    setStatus("Platform, Username, and Master Passkey are required.", true);
    return;
  }
  
  setBusy(true);
  setStatus("Generating password (background)...");
  
  // Send data to worker
  worker.postMessage({ platform, username, passkey, version });
  
  // Listen for worker's response
  worker.onmessage = function(e) {
  setBusy(false);
  const { success, password, error, stack } = e.data;
  if (success) {
    currentPassword = password;
    outputField.value = password;
    copyButton.disabled = false;
    setStatus("Password generated.");
  } else {
    console.error("[app] Worker returned error:", error);
    if (stack) console.error("[app] Stack trace:", stack);
    setStatus(error || "Generation failed.", true);
  }
};

worker.onerror = function(err) {
  // err هو كائن ErrorEvent
  console.error("[app] Worker error event:", err);
  console.error("Message:", err.message);
  console.error("Filename:", err.filename);
  console.error("Line:", err.lineno);
  setBusy(false);
  setStatus("Worker error: " + (err.message || "unknown"), true);
};
}

async function handleCopy() {
  if (!currentPassword) return;
  try {
    await navigator.clipboard.writeText(currentPassword);
    setStatus("Copied to clipboard.");
  } catch (err) {
    setStatus("Copy failed — select and copy manually.", true);
  }
}

generateButton.addEventListener("click", handleGenerate);
copyButton.addEventListener("click", handleCopy);