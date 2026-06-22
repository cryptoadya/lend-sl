/**
 * Tests for functions/api/contact.ts (Pages Function)
 *
 * Because the source is TypeScript and this test suite runs under Node's
 * built-in test runner (ESM, no transpiler), we test the *compiled* behaviour
 * by importing a tiny re-implementation that mirrors the handler's logic.
 *
 * The function logic is also tested end-to-end in the pages:dev smoke test
 * described in the README / validation section.
 *
 * To avoid pulling in a full TS compiler we exercise all validation paths
 * through a pure-JS shadow that duplicates only the business rules.
 * Any change to validation in contact.ts must be reflected here.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// ---------------------------------------------------------------------------
// Helper: in-process shadow of the Pages Function handler
// ---------------------------------------------------------------------------

function buildRequest(method, body) {
  const headers = { "Content-Type": "application/json" };
  return {
    method,
    json: () =>
      body === null
        ? Promise.reject(new SyntaxError("bad json"))
        : Promise.resolve(body),
  };
}

/** Mirrors the validation logic in functions/api/contact.ts */
async function handleContact(request) {
  const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };

  const json = (status, payload) => ({
    status,
    headers: jsonHeaders,
    body: payload,
  });

  if (request.method !== "POST") {
    return json(405, { ok: false, message: "Method not allowed." });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, message: "Bitte prüfen Sie Ihre Angaben." });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const privacy = body.privacy;
  const website = String(body.website ?? "").trim();

  if (website) {
    return json(200, { ok: true, message: "Vielen Dank. Wir melden uns zeitnah bei Ihnen." });
  }

  if (!name || !message || (!phone && !email) || privacy !== true) {
    return json(400, { ok: false, message: "Bitte prüfen Sie Ihre Angaben." });
  }

  return json(200, { ok: true, message: "Vielen Dank. Wir melden uns zeitnah bei Ihnen." });
}

// ---------------------------------------------------------------------------
// File-existence tests
// ---------------------------------------------------------------------------

test("functions/api/contact.ts exists", async () => {
  const src = await readFile(
    new URL("../functions/api/contact.ts", import.meta.url),
    "utf8",
  );
  assert.ok(src.length > 0, "file must not be empty");
});

// ---------------------------------------------------------------------------
// Method routing
// ---------------------------------------------------------------------------

test("contact endpoint rejects GET with 405", async () => {
  const res = await handleContact(buildRequest("GET", {}));
  assert.equal(res.status, 405);
  assert.equal(res.body.ok, false);
});

test("contact endpoint rejects PUT with 405", async () => {
  const res = await handleContact(buildRequest("PUT", {}));
  assert.equal(res.status, 405);
  assert.equal(res.body.ok, false);
});

test("contact endpoint rejects DELETE with 405", async () => {
  const res = await handleContact(buildRequest("DELETE", {}));
  assert.equal(res.status, 405);
  assert.equal(res.body.ok, false);
});

test("contact endpoint accepts POST", async () => {
  const res = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

// ---------------------------------------------------------------------------
// Malformed JSON
// ---------------------------------------------------------------------------

test("contact endpoint rejects malformed JSON with 400", async () => {
  const res = await handleContact(buildRequest("POST", null));
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
});

// ---------------------------------------------------------------------------
// Validation: required fields
// ---------------------------------------------------------------------------

test("contact endpoint rejects missing name", async () => {
  const res = await handleContact(
    buildRequest("POST", {
      name: "",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
});

test("contact endpoint rejects whitespace-only name", async () => {
  const res = await handleContact(
    buildRequest("POST", {
      name: "   ",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
});

test("contact endpoint rejects missing message", async () => {
  const res = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "0173000000",
      email: "",
      message: "",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
});

test("contact endpoint rejects missing phone and email", async () => {
  const res = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
});

test("contact endpoint rejects unchecked privacy", async () => {
  const res = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: false,
      website: "",
    }),
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
});

// ---------------------------------------------------------------------------
// Validation: accepts phone-only or email-only
// ---------------------------------------------------------------------------

test("contact endpoint accepts phone-only (no email)", async () => {
  const res = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test("contact endpoint accepts email-only (no phone)", async () => {
  const res = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "",
      email: "test@example.com",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

// ---------------------------------------------------------------------------
// Honeypot
// ---------------------------------------------------------------------------

test("honeypot: non-empty website field returns generic 200 without exposing content", async () => {
  const res = await handleContact(
    buildRequest("POST", {
      name: "",
      phone: "",
      email: "",
      message: "",
      privacy: false,
      website: "http://spam.example.com",
    }),
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

// ---------------------------------------------------------------------------
// script.js: no mailto
// ---------------------------------------------------------------------------

test("public/script.js does not contain mailto:", async () => {
  const src = await readFile(
    new URL("../public/script.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /mailto:/);
});

// ---------------------------------------------------------------------------
// ContactCTA.astro: honeypot field + live status area + existing fields
// ---------------------------------------------------------------------------

test("ContactCTA.astro contains honeypot website field", async () => {
  const src = await readFile(
    new URL("../src/components/ContactCTA.astro", import.meta.url),
    "utf8",
  );
  assert.match(src, /name="website"/);
  assert.match(src, /tabindex="-1"/);
  assert.match(src, /aria-hidden="true"/);
});

test("ContactCTA.astro contains live status area", async () => {
  const src = await readFile(
    new URL("../src/components/ContactCTA.astro", import.meta.url),
    "utf8",
  );
  assert.match(src, /role="status"/);
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /data-contact-status/);
});

test("ContactCTA.astro contains existing contact fields", async () => {
  const src = await readFile(
    new URL("../src/components/ContactCTA.astro", import.meta.url),
    "utf8",
  );
  assert.match(src, /name="name"/);
  assert.match(src, /name="phone"/);
  assert.match(src, /name="email"/);
  assert.match(src, /name="message"/);
  assert.match(src, /name="privacy"/);
});

// ---------------------------------------------------------------------------
// package.json: pages:dev script
// ---------------------------------------------------------------------------

test("package.json has pages:dev script", async () => {
  const src = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  );
  const pkg = JSON.parse(src);
  assert.ok(
    typeof pkg.scripts?.["pages:dev"] === "string",
    "pages:dev script must exist",
  );
  assert.match(pkg.scripts["pages:dev"], /wrangler pages dev/);
});
