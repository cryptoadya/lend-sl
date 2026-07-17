import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  toggle(name) {
    if (this.names.has(name)) {
      this.names.delete(name);
      return false;
    }

    this.names.add(name);
    return true;
  }

  remove(name) {
    this.names.delete(name);
  }

  contains(name) {
    return this.names.has(name);
  }
}

const createElement = (...classNames) => ({
  attributes: new Map(),
  classList: new FakeClassList(...classNames),
  listeners: new Map(),
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  },
  setAttribute(name, value) {
    this.attributes.set(name, value);
  },
});

test("open mobile navigation closes when the desktop breakpoint is entered", async () => {
  const script = await readFile(new URL("../public/script.js", import.meta.url), "utf8");
  const menuToggle = createElement("menu-toggle");
  const navigation = createElement("nav");
  const body = createElement();
  let breakpointQuery;
  let breakpointHandler;

  const document = {
    body,
    listeners: new Map(),
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    },
    querySelector(selector) {
      if (selector === ".menu-toggle") return menuToggle;
      if (selector === "#primary-nav") return navigation;
      return null;
    },
  };

  const window = {
    matchMedia(query) {
      breakpointQuery = query;
      return {
        matches: false,
        addEventListener(type, listener) {
          if (type === "change") breakpointHandler = listener;
        },
      };
    },
  };

  vm.runInNewContext(script, {
    document,
    window,
    HTMLAnchorElement: class {},
    IntersectionObserver: class {
      observe() {}
    },
  });

  menuToggle.listeners.get("click")();
  assert.equal(navigation.classList.contains("is-open"), true);
  assert.equal(body.classList.contains("nav-open"), true);

  assert.equal(breakpointQuery, "(min-width: 900px)");
  assert.equal(typeof breakpointHandler, "function");
  breakpointHandler({ matches: true });

  assert.equal(navigation.classList.contains("is-open"), false);
  assert.equal(body.classList.contains("nav-open"), false);
  assert.equal(menuToggle.attributes.get("aria-expanded"), "false");
  assert.equal(menuToggle.attributes.get("aria-label"), "Menü öffnen");
});
