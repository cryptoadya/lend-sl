import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const sourceFiles = [
  "astro.config.mjs",
  "src/pages/index.astro",
  "src/pages/impressum.astro",
  "src/pages/datenschutz.astro",
  "src/components/Seo.astro",
  "src/components/ContactCTA.astro",
  "src/components/Footer.astro",
  "src/components/Header.astro",
  "src/components/Hero.astro",
  "src/components/ServicesGrid.astro",
  "src/components/ProcessSteps.astro",
  "public/script.js",
  "public/robots.txt",
  "wrangler.toml",
];

test("production contact and domain values are consistent in source", async () => {
  const files = await Promise.all(
    sourceFiles.map(async (path) => [path, await readProjectFile(path)]),
  );
  const productionEmail = "info@s-line-seniorenhilfe.de";
  const productionDomain = "https://s-line-seniorenhilfe.de";

  for (const [path, contents] of files) {
    assert.doesNotMatch(contents, /adelmarkt2015@gmail\.com/, `${path} contains old Gmail address`);
    assert.doesNotMatch(contents, /https:\/\/example\.com/, `${path} contains example.com`);
  }

  const [contact, footer, index, seo, config] = await Promise.all([
    readProjectFile("src/components/ContactCTA.astro"),
    readProjectFile("src/components/Footer.astro"),
    readProjectFile("src/pages/index.astro"),
    readProjectFile("src/components/Seo.astro"),
    readProjectFile("astro.config.mjs"),
  ]);

  assert.match(contact, new RegExp(`mailto:${productionEmail}`));
  assert.match(footer, new RegExp(`mailto:${productionEmail}`));
  assert.match(index, new RegExp(`email: "${productionEmail}"`));
  assert.match(seo, new RegExp(productionDomain.replaceAll(".", "\\.")));
  assert.match(config, new RegExp(productionDomain.replaceAll(".", "\\.")));
  assert.doesNotMatch(config, /CF_PAGES_URL/);

  const robots = await readProjectFile("public/robots.txt");
  assert.match(robots, new RegExp(`Sitemap: ${productionDomain.replaceAll(".", "\\.")}/sitemap.xml`));

  const [pkg, impressum, datenschutz] = await Promise.all([
    readProjectFile("package.json"),
    readProjectFile("src/pages/impressum.astro"),
    readProjectFile("src/pages/datenschutz.astro"),
  ]);

  assert.match(pkg, /"postbuild": "cp dist\/sitemap-0\.xml dist\/sitemap\.xml"/);
  assert.match(impressum, /path="\/impressum"/);
  assert.match(datenschutz, /path="\/datenschutz"/);
  assert.match(seo, /normalizePagePath/);
  assert.match(seo, /index, follow/);
});

test("security headers are configured for Cloudflare Pages", async () => {
  const headers = await readProjectFile("public/_headers");

  assert.match(headers, /^\/\*/m);
  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, /Strict-Transport-Security:/);
  assert.match(headers, /X-Frame-Options:\s*DENY/);
  assert.match(headers, /Referrer-Policy:\s*strict-origin-when-cross-origin/);
  assert.match(headers, /Permissions-Policy:/);
});

test("Cloudflare preview keeps contact delivery in mock mode", async () => {
  const config = await readProjectFile("wrangler.toml");
  const productionVars = config.match(/\[vars\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? "";
  const previewVars =
    config.match(/\[env\.preview\.vars\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? "";

  assert.match(productionVars, /CONTACT_MODE\s*=\s*"resend"/);
  assert.match(previewVars, /CONTACT_MODE\s*=\s*"mock"/);
});

test("the landing page follows the requested content structure", async () => {
  const [index, hero, process, contact, footer] = await Promise.all([
    readProjectFile("src/pages/index.astro"),
    readProjectFile("src/components/Hero.astro"),
    readProjectFile("src/components/ProcessSteps.astro"),
    readProjectFile("src/components/ContactCTA.astro"),
    readProjectFile("src/components/Footer.astro"),
  ]);

  assert.match(index, /Anerkannte Alltagshilfe in Märkisch-Oderland/);
  assert.match(hero, /<p class="hero-headline">Anerkannte Alltagshilfe in Märkisch-Oderland<\/p>/);
  assert.match(hero, /<h1>Unterstützung für Menschen mit Pflegegrad<\/h1>/);
  assert.doesNotMatch(hero, /Unterstützung im Alltag für Menschen mit Pflegegrad in Märkisch-Oderland/);
  assert.match(hero, /Vom LASV Brandenburg nach § 45a SGB XI anerkannt/);
  assert.match(hero, /Verlässliche Unterstützung im Alltag/);
  assert.match(hero, /Unser Angebot richtet sich an Menschen mit Pflegegrad/);
  assert.match(hero, /Unverbindlich anfragen/);
  assert.equal((process.match(/<article class="step">/g) ?? []).length, 3);
  assert.match(process, /So starten wir/);
  assert.match(process, /Einsatz vereinbaren/);
  assert.match(
    process,
    /Wir vereinbaren passende Zeiten und besprechen, was Ihnen wichtig ist/,
  );
  assert.match(process, /35,00 €/);
  assert.match(process, /Entlastungsbetrag nach § 45b SGB XI/);
  assert.match(
    process,
    /prüfen wir gemeinsam, ob eine direkte Abrechnung mit Ihrer Pflegekasse möglich ist/,
  );
  assert.match(process, /Abrechnung nach tatsächlich geleisteter Zeit/);
  assert.match(contact, /Persönlich Kontakt aufnehmen/);
  assert.match(
    contact,
    /Sie möchten wissen, ob unsere Unterstützung zu Ihrer Situation passt/,
  );
  assert.match(contact, /Wir melden uns persönlich bei Ihnen/);
  assert.match(contact, /Unverbindlich anfragen/);
  assert.match(footer, /<div class="footer-contact">/);
  assert.match(
    footer,
    /<div class="footer-meta">[\s\S]*<div class="footer-legal">[\s\S]*Impressum[\s\S]*Datenschutz[\s\S]*© 2026 S-Line Seniorenhilfe UG[\s\S]*<\/div>\s*<\/footer>/,
  );
  assert.doesNotMatch(footer, /footer-links/);
  assert.doesNotMatch(footer, /<\/div>\s*<p>© 2026 S-Line Seniorenhilfe UG<\/p>\s*<\/footer>/);
});

test("the contact form requires a phone number or email address", async () => {
  const [contact, script] = await Promise.all([
    readProjectFile("src/components/ContactCTA.astro"),
    readProjectFile("public/script.js"),
  ]);

  assert.match(contact, /data-contact-error/);
  assert.match(contact, /aria-describedby="contact-return-error"/);
  assert.equal((contact.match(/class="form-field-full"/g) ?? []).length, 2);
  assert.match(contact, /class="form-field-full">\s*Name/);
  assert.match(contact, /class="form-field-full">\s*Nachricht/);
  assert.match(script, /phone\.setCustomValidity/);
  assert.match(script, /email\.setCustomValidity/);
  assert.match(script, /if \(!phoneValue && !emailValue\)/);
  assert.match(script, /contactError\.hidden = false/);
  assert.match(script, /if \(!contactForm\.checkValidity\(\)\)/);
  assert.match(script, /contactForm\.reportValidity\(\)/);
});

test("the contact form has a native POST fallback", async () => {
  const contact = await readProjectFile("src/components/ContactCTA.astro");
  const formTag = contact.match(/<form[^>]*data-contact-form[^>]*>/)?.[0] ?? "";

  assert.match(formTag, /method="post"/);
  assert.match(formTag, /action="\/api\/contact"/);
  assert.doesNotMatch(formTag, /novalidate/);
});

test("the primary inquiry CTA targets the form while contact navigation targets the section", async () => {
  const [hero, contact, header] = await Promise.all([
    readProjectFile("src/components/Hero.astro"),
    readProjectFile("src/components/ContactCTA.astro"),
    readProjectFile("src/components/Header.astro"),
  ]);
  const formTag = contact.match(/<form[^>]*data-contact-form[^>]*>/)?.[0] ?? "";

  assert.match(hero, /href="#kontaktformular"/);
  assert.match(formTag, /id="kontaktformular"/);
  assert.match(header, /href="\/#kontakt">Kontakt<\/a>/);
});

test("native contact submissions have safe result pages", async () => {
  const [success, error] = await Promise.all([
    readProjectFile("src/pages/anfrage-gesendet.astro").catch(() => ""),
    readProjectFile("src/pages/anfrage-fehler.astro").catch(() => ""),
  ]);

  assert.match(success, /noindex=\{true\}/);
  assert.match(success, /Vielen Dank für Ihre Anfrage/);
  assert.match(success, /Ihre Nachricht wurde erfolgreich übermittelt/);
  assert.match(error, /noindex=\{true\}/);
  assert.match(error, /Ihre Anfrage konnte nicht gesendet werden/);
  assert.match(error, /href="\/#kontaktformular"/);
  assert.match(error, /tel:\+491732126091/);
  assert.match(error, /mailto:info@s-line-seniorenhilfe\.de/);
  assert.doesNotMatch(`${success}\n${error}`, /Astro\.url\.searchParams/);
});

test("native contact result pages are excluded from the sitemap", async () => {
  const config = await readProjectFile("astro.config.mjs");

  assert.match(config, /filter:\s*\(page\)\s*=>/);
  assert.match(config, /anfrage-gesendet/);
  assert.match(config, /anfrage-fehler/);
});

test("the custom 404 page is noindex and offers recovery links", async () => {
  const notFound = await readProjectFile("src/pages/404.astro").catch(() => "");

  assert.match(notFound, /noindex=\{true\}/);
  assert.match(notFound, /path="\/404"/);
  assert.match(notFound, /Seite nicht gefunden/);
  assert.match(notFound, /href="\/"/);
  assert.match(notFound, /href="\/#kontakt"/);
  assert.doesNotMatch(notFound, /Astro\.url/);
});

test("every page receives the S-Line favicon assets from the shared layout", async () => {
  const [layout, svg, png32, appleTouch] = await Promise.all([
    readProjectFile("src/layouts/BaseLayout.astro"),
    readProjectFile("public/favicon.svg"),
    readFile(new URL("../public/favicon-32x32.png", import.meta.url)),
    readFile(new URL("../public/apple-touch-icon.png", import.meta.url)),
  ]);

  assert.match(
    layout,
    /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"\s*\/>/,
  );
  assert.match(
    layout,
    /<link rel="icon" href="\/favicon-32x32\.png" type="image\/png" sizes="32x32"\s*\/>/,
  );
  assert.match(
    layout,
    /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" sizes="180x180"\s*\/>/,
  );
  assert.match(svg, /viewBox="0 0 512 512"/);
  assert.match(svg, /#EAF4E7/);
  assert.match(svg, /#285D2C/);
  assert.ok(png32.byteLength > 0);
  assert.ok(appleTouch.byteLength > 0);
});

test("benefit and service copy stays concrete without overpromising", async () => {
  const [hero, services] = await Promise.all([
    readProjectFile("src/components/Hero.astro"),
    readProjectFile("src/components/ServicesGrid.astro"),
  ]);

  assert.match(
    hero,
    /nach Ihren Möglichkeiten\s+und Gewohnheiten zu gestalten/,
  );
  assert.match(hero, /Gleichzeitig entlasten wir Ihre Angehörigen/);
  assert.equal((hero.match(/Vom LASV Brandenburg/g) ?? []).length, 1);
  const expectedServiceCopy = [
    "Praktische Hilfe und persönliche Begleitung, passend zu Ihrem Alltag.",
    "Zeit für Gespräche, eine verlässliche Tagesstruktur und Hilfe bei kleinen Aufgaben zu Hause.",
    "Erinnerungen, Unterlagen und tägliche Abläufe übersichtlich ordnen.",
    "Einfache Speisen zubereiten und vertraute Gewohnheiten erhalten.",
    "Pflanzen pflegen, leichte Arbeiten im Garten erledigen und Zeit im Grünen verbringen.",
    "Bei einfachen, vertrauten Handgriffen unterstützen, kleine Dinge ordnen, befestigen oder gestalten.",
    "Beim Einkauf unterstützen und zu vereinbarten Arztterminen begleiten.",
  ];

  assert.match(services, /Garten und Pflanzen/);
  assert.match(services, /Kleine handwerkliche Tätigkeiten/);

  for (const copy of expectedServiceCopy) {
    assert.ok(services.includes(copy), `missing service copy: ${copy}`);
  }
});
