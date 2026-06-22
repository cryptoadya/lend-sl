export interface Env {
  CONTACT_MODE?: string;
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

function json(status: number, body: { ok: boolean; message: string }): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  let body: ContactBody;

  try {
    body = (await request.json()) as ContactBody;
  } catch {
    return json(400, { ok: false, message: "Bitte prüfen Sie Ihre Angaben." });
  }

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const privacy = body.privacy;
  const website = String(body.website ?? "").trim();

  // Honeypot: silently succeed without logging content
  if (website) {
    return json(200, { ok: true, message: "Vielen Dank. Wir melden uns zeitnah bei Ihnen." });
  }

  // Validation
  if (!name || !message || (!phone && !email) || privacy !== true) {
    return json(400, { ok: false, message: "Bitte prüfen Sie Ihre Angaben." });
  }

  // Log minimal diagnostic summary only – never log actual personal data
  console.log(
    `[contact mock] accepted request: namePresent=true phonePresent=${Boolean(phone)} emailPresent=${Boolean(email)} messageLength=${message.length}`,
  );

  return json(200, { ok: true, message: "Vielen Dank. Wir melden uns zeitnah bei Ihnen." });
};

// Reject all non-POST methods
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return json(405, { ok: false, message: "Method not allowed." });
  }
  return onRequestPost(context);
};
