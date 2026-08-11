import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("async function handleAuthSubmit(formData)");
const end = source.indexOf("\nasync function signOut()", start);

assert.notEqual(start, -1, "handleAuthSubmit must exist");
assert.notEqual(end, -1, "handleAuthSubmit boundary must exist");

const handler = source.slice(start, end);
const immediateRender = handler.indexOf("if (!startupDeepLinkApplied) render();");
const hydration = handler.indexOf("await loadCloudGames({ silent: true });");
const finalRender = handler.lastIndexOf("if (!startupDeepLinkApplied) render();");

assert.ok(immediateRender >= 0, "successful authentication must render immediately");
assert.ok(hydration > immediateRender, "cloud hydration must start after the authenticated UI renders");
assert.ok(finalRender > hydration, "cloud hydration completion must render refreshed state");

console.log("PASS authenticated UI renders before cloud hydration and refreshes after hydration");

const authListenerStart = source.indexOf("supabaseClient.auth.onAuthStateChange(");
const authListenerEnd = source.indexOf("\n    if (state.authUser) {", authListenerStart);

assert.notEqual(authListenerStart, -1, "auth-state listener must exist");
assert.notEqual(authListenerEnd, -1, "auth-state listener boundary must exist");

const authListener = source.slice(authListenerStart, authListenerEnd);
assert.ok(
  authListener.startsWith("supabaseClient.auth.onAuthStateChange((event, session) =>"),
  "auth-state listener must return synchronously so Supabase can release its auth lock",
);
assert.ok(
  authListener.includes("window.setTimeout(async () =>"),
  "network hydration must be deferred until after the auth-state listener returns",
);

console.log("PASS auth-state listener releases the Supabase auth lock before network hydration");
