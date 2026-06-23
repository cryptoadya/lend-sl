import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { onRequest } from "../functions/api/contact.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function buildRequest(method, body, headers = JSON_HEADERS) {
  if (body === null) {
    return new Request("https://example.com/api/contact", {
      method,
      headers,
      body: "{",
    });
  }

  return new Request("https://example.com/api/contact", {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

async function handleContact(request) {
  const response = await onRequest({
    request,
    env: {},
    params: {},
    data: {},
    next: () => Promise.resolve(new Response(null, { status: 404 })),
    waitUntil: () => {},
    passThroughOnException: () => {},
  });
  const body = await response.json();
  return { response, body };
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
  const { response, body } = await handleContact(buildRequest("GET", {}));
  assert.equal(response.status, 405);
  assert.equal(body.ok, false);
});

test("contact endpoint rejects PUT with 405", async () => {
  const { response, body } = await handleContact(buildRequest("PUT", {}));
  assert.equal(response.status, 405);
  assert.equal(body.ok, false);
});

test("contact endpoint rejects DELETE with 405", async () => {
  const { response, body } = await handleContact(buildRequest("DELETE", {}));
  assert.equal(response.status, 405);
  assert.equal(body.ok, false);
});

test("contact endpoint accepts POST", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

// ---------------------------------------------------------------------------
// Malformed JSON
// ---------------------------------------------------------------------------

test("contact endpoint rejects malformed JSON with 400", async () => {
  const { response, body } = await handleContact(buildRequest("POST", null));
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
});

test("contact endpoint rejects non-JSON content type with 400", async () => {
  const { response, body } = await handleContact(
    buildRequest(
      "POST",
      {
        name: "Test",
        phone: "0173000000",
        email: "",
        message: "Hallo",
        privacy: true,
        website: "",
      },
      { "Content-Type": "text/plain" },
    ),
  );
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
});

// ---------------------------------------------------------------------------
// Validation: required fields
// ---------------------------------------------------------------------------

test("contact endpoint rejects missing name", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
});

test("contact endpoint rejects whitespace-only name", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "   ",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
});

test("contact endpoint rejects missing message", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "0173000000",
      email: "",
      message: "",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
});

test("contact endpoint rejects missing phone and email", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
});

test("contact endpoint rejects unchecked privacy", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: false,
      website: "",
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
});

// ---------------------------------------------------------------------------
// Validation: accepts phone-only or email-only
// ---------------------------------------------------------------------------

test("contact endpoint accepts phone-only (no email)", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test("contact endpoint accepts email-only (no phone)", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "",
      email: "test@example.com",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

// ---------------------------------------------------------------------------
// Honeypot
// ---------------------------------------------------------------------------

test("honeypot: non-empty website field returns generic 200 without exposing content", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "",
      phone: "",
      email: "",
      message: "",
      privacy: false,
      website: "http://spam.example.com",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test("contact endpoint returns expected JSON and cache headers", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", {
      name: "Test",
      phone: "0173000000",
      email: "",
      message: "Hallo",
      privacy: true,
      website: "",
    }),
  );

  assert.equal(response.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(body, {
    ok: true,
    message: "Vielen Dank. Wir melden uns zeitnah bei Ihnen.",
  });
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
  assert.equal(pkg.scripts["pages:dev"], "wrangler pages dev dist");
  assert.doesNotMatch(JSON.stringify(pkg.scripts), /gen-worker/);
});
