import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");

const relativeLuminance = (hex) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (first, second) => {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));

  return (lighter + 0.05) / (darker + 0.05);
};

test("all anchored sections clear the sticky header", () => {
  assert.match(
    css,
    /#top,\s*#leistungen,\s*#ablauf,\s*#preis,\s*#gebiet,\s*#kontakt,\s*#kontaktformular\s*\{[^}]*scroll-margin-top:\s*92px/s,
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
    /@media\s*\(max-width:\s*899px\)[\s\S]*?\.footer-contact a,\s*\.footer-legal a\s*\{[^}]*min-height:\s*44px/s,
  );
});

test("open mobile navigation scrolls within a short viewport", () => {
  const openNavigation = css.match(/\.nav\.is-open\s*\{([^}]*)\}/s)?.[1] ?? "";

  assert.match(openNavigation, /max-height:\s*calc\(100dvh - 91px\)/);
  assert.match(openNavigation, /overflow-y:\s*auto/);
});

test("desktop footer uses three bounded semantic columns", () => {
  const desktop = css.match(/@media\s*\(min-width:\s*900px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(desktop, /\.footer\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
  assert.match(
    desktop,
    /\.footer\s*\{[^}]*padding-inline:\s*max\(20px,\s*calc\(\(100vw - var\(--max\)\) \/ 2\)\)/s,
  );
  assert.match(desktop, /\.footer-contact\s*\{[^}]*justify-self:\s*center/s);
  assert.match(desktop, /\.footer-meta\s*\{[^}]*justify-self:\s*end[^}]*text-align:\s*right/s);
  assert.doesNotMatch(desktop, /grid-template-columns:\s*1fr auto auto auto/);
});

test("desktop grids match the four benefits and three process steps", () => {
  const desktop = css.match(/@media\s*\(min-width:\s*900px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(
    desktop,
    /\.benefit-strip-inner\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s,
  );
  assert.match(desktop, /\.step-list\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
});

test("desktop hero scales the headline to its column", () => {
  const desktop = css.match(/@media\s*\(min-width:\s*900px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(
    desktop,
    /\.hero h1\s*\{[^}]*font-size:\s*clamp\(3rem,\s*4vw,\s*3\.6rem\)/s,
  );
});

test("short desktop hero keeps the primary CTA above the fold", () => {
  const shortDesktop =
    css.match(
      /@media\s*\(min-width:\s*900px\)\s*and\s*\(max-height:\s*760px\)\s*\{([\s\S]*?)\n\}/,
    )?.[1] ?? "";

  assert.match(
    shortDesktop,
    /\.hero\s*\{[^}]*padding-top:\s*36px[^}]*padding-bottom:\s*44px/s,
  );
  assert.match(
    shortDesktop,
    /\.hero-media,\s*\.hero-media img\s*\{[^}]*min-height:\s*460px/s,
  );
});

test("desktop contact navigation aligns the two-column block below the header", () => {
  const desktop = css.match(/@media\s*\(min-width:\s*900px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(desktop, /#kontakt\s*\{[^}]*scroll-margin-top:\s*24px/s);
});

test("mobile hero keeps the headline compact without shrinking buttons", () => {
  const mobile = css.match(/@media\s*\(max-width:\s*619px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(mobile, /\.hero\s*\{[^}]*gap:\s*24px[^}]*padding:\s*34px 0 24px/s);
  assert.match(mobile, /\.hero-headline\s*\{[^}]*font-size:\s*0\.92rem/s);
  assert.match(
    mobile,
    /\.hero h1\s*\{[^}]*font-size:\s*clamp\(2\.35rem,\s*10vw,\s*2\.8rem\)[^}]*line-height:\s*1\.02/s,
  );
  assert.match(
    mobile,
    /\.hero-copy\s*>\s*\.hero-script\s*\{[^}]*font-size:\s*clamp\(1\.85rem,\s*8vw,\s*2\.3rem\)/s,
  );
  assert.doesNotMatch(mobile, /\.btn\s*\{[^}]*min-height:\s*(?:[0-4]\d|5[0-7])px/s);
});

test("tablet contact form uses semantic full-width rows", () => {
  const tablet = css.match(/@media\s*\(min-width:\s*620px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(
    tablet,
    /\.contact-form \.form-field-full,\s*\.contact-form \.privacy-check,\s*\.contact-form \.form-error,/s,
  );
  assert.match(tablet, /grid-column:\s*1\s*\/\s*-1/);
  assert.doesNotMatch(tablet, /\.contact-form label:nth-child/);
});

test("contact fields keep a visible boundary and keyboard focus indicator", () => {
  const fieldBorder = css.match(/--field-border:\s*(#[0-9a-f]{6})/i)?.[1];
  const fields =
    css.match(
      /\.contact-form input:not\(\[type="checkbox"\]\),\s*\.contact-form textarea\s*\{([^}]*)\}/s,
    )?.[1] ?? "";
  const focus =
    css.match(
      /\.contact-form input:not\(\[type="checkbox"\]\):focus,\s*\.contact-form textarea:focus\s*\{([^}]*)\}/s,
    )?.[1] ?? "";
  const focusVisible =
    css.match(
      /\.contact-form input:not\(\[type="checkbox"\]\):focus-visible,\s*\.contact-form textarea:focus-visible\s*\{([^}]*)\}/s,
    )?.[1] ?? "";

  assert.ok(fieldBorder, "the contact field border color should be explicit");
  assert.ok(
    contrastRatio(fieldBorder, "#ffffff") >= 3,
    "the field boundary should have at least 3:1 contrast against white",
  );
  assert.match(fields, /border:\s*1px solid var\(--field-border\)/);
  assert.match(focus, /border-color:\s*var\(--accent-dark\)/);
  assert.match(focusVisible, /outline:\s*3px solid var\(--accent-dark\)/);
  assert.match(focusVisible, /outline-offset:\s*2px/);
});
