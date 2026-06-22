import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("all anchored sections clear the sticky header", () => {
  assert.match(
    css,
    /#top,\s*#leistungen,\s*#ablauf,\s*#preis,\s*#gebiet,\s*#kontakt\s*\{[^}]*scroll-margin-top:\s*92px/s,
  );
});

test("hero script text uses a predictable cross-platform font treatment", () => {
  const rule = css.match(/\.hero-copy\s*>\s*\.hero-script\s*\{([^}]*)\}/s)?.[1] ?? "";

  assert.match(rule, /font-family:\s*Georgia,\s*"Times New Roman",\s*serif/);
  assert.match(rule, /font-style:\s*italic/);
  assert.doesNotMatch(rule, /Segoe Print|Bradley Hand|Brush Script MT/);
});

test("card copy is at least 16px", () => {
  assert.match(css, /\.service-card p\s*\{[^}]*font-size:\s*1rem/s);
  assert.match(css, /\.benefit-item p\s*\{[^}]*font-size:\s*1rem/s);
});

test("mobile footer links have a 44px touch target", () => {
  assert.match(
    css,
    /@media\s*\(max-width:\s*520px\)[\s\S]*?\.footer-links a,\s*\.footer-legal a\s*\{[^}]*min-height:\s*44px/s,
  );
});
