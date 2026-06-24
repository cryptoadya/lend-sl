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

const JSON_HEADERS: HeadersInit = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const SUCCESS_MESSAGE = "Vielen Dank. Wir melden uns zeitnah bei Ihnen.";
const ERROR_MESSAGE = "Ihre Anfrage konnte gerade nicht gesendet werden.";
const VALIDATION_MESSAGE = "Bitte prüfen Sie Ihre Angaben.";
const MAX_CONTENT_LENGTH = 10_000;
const MAX_NAME_LENGTH = 100;
const MAX_CONTACT_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 4_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(status: number, body: { ok: boolean; message: string }): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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
    subject: `Neue Anfrage von ${name}`,
    text: buildContactEmail({ name, phone, email, message }),
  };

  if (email) {
    payload.reply_to = [email];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`[contact resend] send failed with status ${response.status}`);
    return false;
  }

  return true;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: ContactBody;

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_CONTENT_LENGTH) {
    return json(413, { ok: false, message: VALIDATION_MESSAGE });
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json(400, { ok: false, message: VALIDATION_MESSAGE });
  }

  try {
    body = (await request.json()) as ContactBody;
  } catch {
    return json(400, { ok: false, message: VALIDATION_MESSAGE });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const privacy = body.privacy;
  const website = String(body.website ?? "").trim();

  // Honeypot: silently succeed without logging content
  if (website) {
    return json(200, { ok: true, message: SUCCESS_MESSAGE });
  }

  // Validation
  if (!name || !message || (!phone && !email) || privacy !== true) {
    return json(400, { ok: false, message: VALIDATION_MESSAGE });
  }

  if (
    name.length > MAX_NAME_LENGTH ||
    phone.length > MAX_CONTACT_LENGTH ||
    email.length > MAX_CONTACT_LENGTH ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return json(400, { ok: false, message: VALIDATION_MESSAGE });
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return json(400, { ok: false, message: VALIDATION_MESSAGE });
  }

  if (env.CONTACT_MODE === "resend") {
    const sent = await sendWithResend({ env, name, phone, email, message });
    if (!sent) {
      return json(502, { ok: false, message: ERROR_MESSAGE });
    }

    return json(200, { ok: true, message: SUCCESS_MESSAGE });
  }

  if (env.CONTACT_MODE === "mock") {
    // Log minimal diagnostic summary only; never log actual personal data.
    console.log(
      `[contact mock] accepted request: namePresent=true phonePresent=${Boolean(phone)} emailPresent=${Boolean(email)} messageLength=${message.length}`,
    );

    return json(200, { ok: true, message: SUCCESS_MESSAGE });
  }

  console.error("[contact] invalid CONTACT_MODE configuration");
  return json(503, { ok: false, message: ERROR_MESSAGE });
};

// Reject all non-POST methods
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return json(405, { ok: false, message: "Method not allowed." });
  }
  return onRequestPost(context);
};
