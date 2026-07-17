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

function buildFormRequest(body) {
  const form = new URLSearchParams();

  for (const [name, value] of Object.entries(body)) {
    if (name === "privacy") {
      if (value) form.set(name, "on");
      continue;
    }
    form.set(name, String(value));
  }

  return new Request("https://example.com/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
}

async function dispatchContact(request, env = {}) {
  return onRequest({
    request,
    env,
    params: {},
    data: {},
    next: () => Promise.resolve(new Response(null, { status: 404 })),
    waitUntil: () => {},
    passThroughOnException: () => {},
  });
}

async function handleContact(request, env = {}) {
  const response = await dispatchContact(request, env);
  const body = await response.json();
  return { response, body };
}

function validContactBody(overrides = {}) {
  return {
    name: "Test",
    phone: "0173000000",
    email: "",
    message: "Hallo",
    privacy: true,
    website: "",
    ...overrides,
  };
}

async function withMockedFetch(mockFetch, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
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
    buildRequest("POST", validContactBody()),
    { CONTACT_MODE: "mock" },
  );
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test("contact endpoint accepts a native HTML form POST", async () => {
  const response = await dispatchContact(
    buildFormRequest(validContactBody()),
    { CONTACT_MODE: "mock" },
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/anfrage-gesendet");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("native HTML form POST uses the production Resend delivery path", async () => {
  let resendPayload;

  await withMockedFetch(
    async (_url, init) => {
      resendPayload = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "email_form_test" }), { status: 200 });
    },
    async () => {
      const response = await dispatchContact(
        buildFormRequest(validContactBody({
          email: "kunde@example.com",
          message: "Bitte per Formular zurueckrufen.",
        })),
        {
          CONTACT_MODE: "resend",
          RESEND_API_KEY: "re_test_key",
          CONTACT_FROM: "S-Line Seniorenhilfe <kontakt@s-line-seniorenhilfe.de>",
          CONTACT_TO: "inbox@example.com",
        },
      );

      assert.equal(response.status, 303);
      assert.equal(response.headers.get("Location"), "/anfrage-gesendet");
    },
  );

  assert.deepEqual(resendPayload.to, ["inbox@example.com"]);
  assert.deepEqual(resendPayload.reply_to, ["kunde@example.com"]);
  assert.match(resendPayload.text, /Bitte per Formular zurueckrufen\./);
});

test("invalid native HTML form POST redirects without personal data in the URL", async () => {
  const response = await dispatchContact(
    buildFormRequest(validContactBody({ phone: "", email: "" })),
    { CONTACT_MODE: "mock" },
  );

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/anfrage-fehler");
  assert.doesNotMatch(response.headers.get("Location"), /Test|Hallo/);
});

test("native HTML form honeypot succeeds without sending through Resend", async () => {
  let fetchCalled = false;

  await withMockedFetch(
    async () => {
      fetchCalled = true;
      return new Response(null, { status: 500 });
    },
    async () => {
      const response = await dispatchContact(
        buildFormRequest(validContactBody({ website: "https://spam.example" })),
        {
          CONTACT_MODE: "resend",
          RESEND_API_KEY: "re_test_key",
          CONTACT_FROM: "S-Line Seniorenhilfe <kontakt@s-line-seniorenhilfe.de>",
          CONTACT_TO: "inbox@example.com",
        },
      );

      assert.equal(response.status, 303);
      assert.equal(response.headers.get("Location"), "/anfrage-gesendet");
      assert.equal(fetchCalled, false);
    },
  );
});

test("contact endpoint fails closed when production mode is not configured", async () => {
  let fetchCalled = false;

  await withMockedFetch(
    async () => {
      fetchCalled = true;
      return new Response(null, { status: 500 });
    },
    async () => {
      const { response, body } = await handleContact(
        buildRequest("POST", validContactBody()),
      );

      assert.equal(response.status, 503);
      assert.equal(body.ok, false);
      assert.equal(fetchCalled, false);
    },
  );
});

test("contact endpoint rejects oversized requests before parsing JSON", async () => {
  const body = JSON.stringify(validContactBody({ message: "a".repeat(12_000) }));
  const request = new Request("https://example.com/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(body.length),
    },
    body,
  });

  const { response, body: responseBody } = await handleContact(request, {
    CONTACT_MODE: "resend",
    RESEND_API_KEY: "re_test_key",
    CONTACT_FROM: "S-Line Seniorenhilfe <kontakt@s-line-seniorenhilfe.de>",
    CONTACT_TO: "inbox@example.com",
  });

  assert.equal(response.status, 413);
  assert.equal(responseBody.ok, false);
});

test("contact endpoint sends email through Resend when enabled", async () => {
  let requestUrl = "";
  let requestInit;

  await withMockedFetch(
    async (url, init) => {
      requestUrl = String(url);
      requestInit = init;
      return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
    },
    async () => {
      const { response, body } = await handleContact(
        buildRequest(
          "POST",
          validContactBody({
            email: "kunde@example.com",
            message: "Bitte um Rueckruf.",
          }),
        ),
        {
          CONTACT_MODE: "resend",
          RESEND_API_KEY: "re_test_key",
          CONTACT_FROM: "S-Line Seniorenhilfe <kontakt@s-line-seniorenhilfe.de>",
          CONTACT_TO: "inbox@example.com",
        },
      );

      assert.equal(response.status, 200);
      assert.equal(body.ok, true);
    },
  );

  assert.equal(requestUrl, "https://api.resend.com/emails");
  assert.equal(requestInit.method, "POST");
  assert.equal(requestInit.headers.Authorization, "Bearer re_test_key");

  const payload = JSON.parse(requestInit.body);
  assert.equal(payload.from, "S-Line Seniorenhilfe <kontakt@s-line-seniorenhilfe.de>");
  assert.deepEqual(payload.to, ["inbox@example.com"]);
  assert.deepEqual(payload.reply_to, ["kunde@example.com"]);
  assert.match(payload.subject, /Neue Anfrage von Test/);
  assert.match(payload.text, /Telefon: 0173000000/);
  assert.match(payload.text, /E-Mail: kunde@example.com/);
  assert.match(payload.text, /Bitte um Rueckruf\./);
});

test("contact endpoint reports failure when Resend rejects the request", async () => {
  await withMockedFetch(
    async () => new Response(JSON.stringify({ message: "invalid api key" }), { status: 401 }),
    async () => {
      const { response, body } = await handleContact(
        buildRequest("POST", validContactBody()),
        {
          CONTACT_MODE: "resend",
          RESEND_API_KEY: "re_bad_key",
          CONTACT_FROM: "S-Line Seniorenhilfe <kontakt@s-line-seniorenhilfe.de>",
          CONTACT_TO: "inbox@example.com",
        },
      );

      assert.equal(response.status, 502);
      assert.equal(body.ok, false);
    },
  );
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

test("contact endpoint rejects invalid reply-to email addresses", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", validContactBody({
      phone: "",
      email: "kein-email-format",
    })),
  );

  assert.equal(response.status, 400);
  assert.equal(body.ok, false);
});

test("contact endpoint rejects overly long field values", async () => {
  const { response, body } = await handleContact(
    buildRequest("POST", validContactBody({
      name: "a".repeat(101),
      message: "Hallo",
    })),
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
    { CONTACT_MODE: "mock" },
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
    { CONTACT_MODE: "mock" },
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
    { CONTACT_MODE: "mock" },
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
