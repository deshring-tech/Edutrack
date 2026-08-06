/**
 * MODULE: Browser opener
 *
 * Purpose        Open EduTrack in the default browser once it is actually
 *                serving, not before.
 * Responsibility Poll the server, then hand the URL to the OS.
 * Dependencies   node:child_process.
 *
 * WHY POLL
 *  Launching the browser at the same time as the server gives the operator a
 *  connection-refused page and a bad first impression. A first `next start`
 *  needs a few seconds; a first `next dev` compile can need considerably more.
 */

import { spawn } from "node:child_process";

const url = process.argv[2] ?? "http://localhost:3000";
const timeoutMs = Number(process.argv[3] ?? 180_000);
const pollIntervalMs = 500;

function openBrowser(target) {
  if (process.platform === "win32") {
    // `start` is a cmd builtin, and its first quoted argument is the window
    // title — hence the empty string before the URL.
    spawn("cmd", ["/c", "start", "", target], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", [target], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref();
  }
}

async function isServing() {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(2000),
    });
    // Any HTTP response means something is listening and routing. A redirect to
    // /login is a perfectly good sign of readiness.
    return response.status > 0;
  } catch {
    return false;
  }
}

async function main() {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isServing()) {
      openBrowser(url);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Not an error: the server may simply be slow, and it is still starting in
  // the window the operator is looking at.
  console.log(`\nEduTrack did not respond yet — open ${url} manually once it does.`);
}

main();
