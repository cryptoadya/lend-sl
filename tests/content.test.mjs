import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
  assert.match(script, /phone\.focus\(\)/);
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
