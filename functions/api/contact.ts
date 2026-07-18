export interface Env {
  CONTACT_MODE?: string;
  RESEND_API_KEY?: string;
  CONTACT_FROM?: string;
  CONTACT_TO?: string;
}

interface ContactBody {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  message?: unknown;
  privacy?: unknown;
  website?: unknown;
}

type ContactRequestKind = "json" | "form";

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const SUCCESS_MESSAGE = "Vielen Dank. Wir melden uns zeitnah bei Ihnen.";
const ERROR_MESSAGE = "Ihre Anfrage konnte gerade nicht gesendet werden.";
const VALIDATION_MESSAGE = "Bitte prüfen Sie Ihre Angaben.";
const MAX_CONTENT_LENGTH = 65_536;
const RESEND_TIMEOUT_MS = 8_000;
const MAX_NAME_LENGTH = 100;
const MAX_CONTACT_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 4_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JSON_CONTENT_TYPE = "application/json";
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";
const SUCCESS_PATH = "/anfrage-gesendet";
const ERROR_PATH = "/anfrage-fehler";

function isContactBody(value: unknown): value is ContactBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCrossSiteRequest(request: Request): boolean {
  const fetchSite = request.headers.get("Sec-Fetch-Site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") {
    return true;
  }

  const origin = request.headers.get("Origin");
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

function sanitizeSubjectText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readBodyWithLimit(
  request: Request,
): Promise<{ text: string; tooLarge: boolean }> {
  if (!request.body) {
    return { text: "", tooLarge: false };
  }

  const reader = request.body.getReader();
  const buffer = new Uint8Array(MAX_CONTENT_LENGTH);
  let length = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (length + value.byteLength > MAX_CONTENT_LENGTH) {
        await reader.cancel();
        return { text: "", tooLarge: true };
      }

      buffer.set(value, length);
      length += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  return {
    text: new TextDecoder().decode(buffer.subarray(0, length)),
    tooLarge: false,
  };
}

function json(status: number, body: { ok: boolean; message: string }): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function contactResponse(
  kind: ContactRequestKind,
  status: number,
  body: { ok: boolean; message: string },
): Response {
  if (kind === "form") {
    return new Response(null, {
      status: 303,
      headers: {
        Location: status >= 200 && status < 300 ? SUCCESS_PATH : ERROR_PATH,
        "Cache-Control": "no-store",
      },
    });
  }

  return json(status, body);
}

function buildContactEmail({
  name,
  phone,
  email,
  message,
}: {
  name: string;
  phone: string;
  email: string;
  message: string;
}): string {
  return [
    "Neue Anfrage ueber die Website:",
    "",
    `Name: ${name}`,
    `Telefon: ${phone || "-"}`,
    `E-Mail: ${email || "-"}`,
    "",
    "Nachricht:",
    message,
  ].join("\n");
}

async function sendWithResend({
  env,
  name,
  phone,
  email,
  message,
}: {
  env: Env;
  name: string;
  phone: string;
  email: string;
  message: string;
}): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.CONTACT_FROM?.trim();
  const to = env.CONTACT_TO?.trim();

  if (!apiKey || !from || !to) {
    console.error("[contact resend] missing required environment variables");
    return false;
  }

  const payload: {
    from: string;
    to: string[];
    subject: string;
    text: string;
    reply_to?: string[];
  } = {
    from,
    to: [to],
    subject: `Neue Anfrage von ${sanitizeSubjectText(name)}`,
    text: buildContactEmail({ name, phone, email, message }),
  };

  if (email) {
    payload.reply_to = [email];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    console.error(
      controller.signal.aborted
        ? "[contact resend] request timed out"
        : "[contact resend] request failed",
    );
    return false;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    console.error(`[contact resend] send failed with status ${response.status}`);
    return false;
  }

  return true;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: ContactBody;

  const contentType = (request.headers.get("Content-Type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const kind: ContactRequestKind = contentType === FORM_CONTENT_TYPE ? "form" : "json";

  if (isCrossSiteRequest(request)) {
    return contactResponse(kind, 403, { ok: false, message: VALIDATION_MESSAGE });
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
    return contactResponse(kind, 413, { ok: false, message: VALIDATION_MESSAGE });
  }

  if (contentType !== JSON_CONTENT_TYPE && contentType !== FORM_CONTENT_TYPE) {
    return json(400, { ok: false, message: VALIDATION_MESSAGE });
  }

  let rawBody: { text: string; tooLarge: boolean };

  try {
    rawBody = await readBodyWithLimit(request);
  } catch {
    return contactResponse(kind, 400, { ok: false, message: VALIDATION_MESSAGE });
  }

  if (rawBody.tooLarge) {
    return contactResponse(kind, 413, { ok: false, message: VALIDATION_MESSAGE });
  }

  try {
    if (kind === "form") {
      const formData = new URLSearchParams(rawBody.text);
      body = {
        name: formData.get("name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        message: formData.get("message"),
        privacy: formData.get("privacy") === "on",
        website: formData.get("website"),
      };
    } else {
      const parsedBody: unknown = JSON.parse(rawBody.text);
      if (!isContactBody(parsedBody)) {
        return contactResponse(kind, 400, { ok: false, message: VALIDATION_MESSAGE });
      }
      body = parsedBody;
    }
  } catch {
    return contactResponse(kind, 400, { ok: false, message: VALIDATION_MESSAGE });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const privacy = body.privacy;
  const website = String(body.website ?? "").trim();

  // Honeypot: silently succeed without logging content
  if (website) {
    return contactResponse(kind, 200, { ok: true, message: SUCCESS_MESSAGE });
  }

  // Validation
  if (!name || !message || (!phone && !email) || privacy !== true) {
    return contactResponse(kind, 400, { ok: false, message: VALIDATION_MESSAGE });
  }

  if (
    name.length > MAX_NAME_LENGTH ||
    phone.length > MAX_CONTACT_LENGTH ||
    email.length > MAX_CONTACT_LENGTH ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return contactResponse(kind, 400, { ok: false, message: VALIDATION_MESSAGE });
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return contactResponse(kind, 400, { ok: false, message: VALIDATION_MESSAGE });
  }

  if (env.CONTACT_MODE === "resend") {
    const sent = await sendWithResend({ env, name, phone, email, message });
    if (!sent) {
      return contactResponse(kind, 502, { ok: false, message: ERROR_MESSAGE });
    }

    return contactResponse(kind, 200, { ok: true, message: SUCCESS_MESSAGE });
  }

  if (env.CONTACT_MODE === "mock") {
    // Log minimal diagnostic summary only; never log actual personal data.
    console.log(
      `[contact mock] accepted request: namePresent=true phonePresent=${Boolean(phone)} emailPresent=${Boolean(email)} messageLength=${message.length}`,
    );

    return contactResponse(kind, 200, { ok: true, message: SUCCESS_MESSAGE });
  }

  console.error("[contact] invalid CONTACT_MODE configuration");
  return contactResponse(kind, 503, { ok: false, message: ERROR_MESSAGE });
};

// Reject all non-POST methods
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return json(405, { ok: false, message: "Method not allowed." });
  }
  return onRequestPost(context);
};
