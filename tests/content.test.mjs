import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the landing page follows the requested content structure", async () => {
  const [hero, services, process, contact] = await Promise.all([
    readProjectFile("src/components/Hero.astro"),
    readProjectFile("src/components/ServicesGrid.astro"),
    readProjectFile("src/components/ProcessSteps.astro"),
    readProjectFile("src/components/ContactCTA.astro"),
  ]);

  assert.match(hero, /S-Line Seniorenhilfe UG in Eggersdorf/);
  assert.match(hero, /Unverbindlich anfragen/);
  assert.match(hero, /Für wen wir da sind/);
  assert.match(services, /Termine, Besorgungen, Erinnerungen/);
  assert.equal((process.match(/<article class="step">/g) ?? []).length, 3);
  assert.match(process, /Transparente Abrechnung nach tatsächlich geleisteter Zeit/);
  assert.match(contact, /Rufen Sie uns an, schreiben Sie uns oder nutzen Sie das Formular/);
});

test("the contact form requires a phone number or email address", async () => {
  const [contact, script] = await Promise.all([
    readProjectFile("src/components/ContactCTA.astro"),
    readProjectFile("public/script.js"),
  ]);

  assert.match(contact, /data-contact-error/);
  assert.match(contact, /aria-describedby="contact-return-error"/);
  assert.match(script, /phone\.setCustomValidity/);
  assert.match(script, /email\.setCustomValidity/);
  assert.match(script, /if \(!phoneValue && !emailValue\)/);
  assert.match(script, /contactError\.hidden = false/);
  assert.match(script, /phone\.focus\(\)/);
});
