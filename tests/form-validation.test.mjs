import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

class FakeClassList {
  toggle() {
    return false;
  }

  remove() {}
}

const createField = ({ name, type = "text", required = false, value = "" }) => ({
  name,
  type,
  required,
  value,
  checked: false,
  customValidity: "",
  focused: false,
  listeners: new Map(),
  addEventListener(event, listener) {
    this.listeners.set(event, listener);
  },
  focus() {
    this.focused = true;
  },
  reportValidity() {
    this.focus();
    return this.validity.valid;
  },
  setCustomValidity(message) {
    this.customValidity = message;
  },
  get validity() {
    const valueMissing = this.required && (this.type === "checkbox" ? !this.checked : !this.value);
    const typeMismatch =
      this.type === "email" && Boolean(this.value) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value);

    return {
      customError: Boolean(this.customValidity),
      typeMismatch,
      valid: !this.customValidity && !valueMissing && !typeMismatch,
      valueMissing,
    };
  },
});

const createHarness = async (overrides = {}) => {
  const script = await readFile(new URL("../public/script.js", import.meta.url), "utf8");
  const fields = {
    name: createField({ name: "name", required: true, value: "Test Person" }),
    phone: createField({ name: "phone" }),
    email: createField({ name: "email", type: "email", value: "test@example.com" }),
    message: createField({ name: "message", required: true, value: "Testnachricht" }),
    privacy: createField({ name: "privacy", type: "checkbox", required: true }),
    website: createField({ name: "website" }),
  };
  fields.privacy.checked = true;

  for (const [name, value] of Object.entries(overrides)) {
    if (name === "privacy") {
      fields.privacy.checked = value;
    } else {
      fields[name].value = value;
    }
  }

  const contactError = { hidden: true };
  const status = {
    hidden: true,
    textContent: "",
    focus() {},
  };
  const submitButton = { disabled: false };
  const selectors = new Map([
    ['[name="name"]', fields.name],
    ['[name="phone"]', fields.phone],
    ['[name="email"]', fields.email],
    ['[name="message"]', fields.message],
    ['[name="privacy"]', fields.privacy],
    ['[name="website"]', fields.website],
    ["[data-contact-error]", contactError],
    ["[data-contact-status]", status],
    ["[type='submit']", submitButton],
  ]);
  const form = {
    checkValidityCalls: 0,
    reportValidityCalls: 0,
    listeners: new Map(),
    addEventListener(event, listener) {
      this.listeners.set(event, listener);
    },
    checkValidity() {
      this.checkValidityCalls += 1;
      return Object.values(fields).every((field) => field.validity.valid);
    },
    querySelector(selector) {
      return selectors.get(selector) ?? null;
    },
    reportValidity() {
      this.reportValidityCalls += 1;
      const firstInvalid = Object.values(fields).find((field) => !field.validity.valid);
      firstInvalid?.focus();
      return !firstInvalid;
    },
    reset() {},
  };
  const document = {
    body: { classList: new FakeClassList() },
    addEventListener() {},
    querySelector(selector) {
      if (selector === "[data-contact-form]") return form;
      return null;
    },
  };
  let fetchCalls = 0;

  class FakeFormData {
    get(name) {
      const field = fields[name];
      if (field.type === "checkbox") return field.checked ? "on" : null;
      return field.value;
    }
  }

  vm.runInNewContext(script, {
    AbortController: class {
      signal = {};
      abort() {}
    },
    clearTimeout() {},
    document,
    fetch: async () => {
      fetchCalls += 1;
      return { ok: true, json: async () => ({ ok: true, message: "ok" }) };
    },
    FormData: FakeFormData,
    HTMLAnchorElement: class {},
    IntersectionObserver: class {
      observe() {}
    },
    setTimeout: () => 1,
    window: {
      matchMedia: () => ({ addEventListener() {} }),
    },
  });

  return {
    fields,
    form,
    getFetchCalls: () => fetchCalls,
    submit: () => form.listeners.get("submit")({ preventDefault() {} }),
  };
};

test("invalid email is reported before the contact request is sent", async () => {
  const harness = await createHarness({ email: "ungueltig" });

  await harness.submit();

  assert.equal(harness.form.checkValidityCalls, 1);
  assert.equal(harness.form.reportValidityCalls, 1);
  assert.equal(harness.fields.email.focused, true);
  assert.equal(harness.getFetchCalls(), 0);
});

test("custom validation messages clear when their fields change", async () => {
  const { fields } = await createHarness();
  const cases = [
    [fields.name, "input"],
    [fields.message, "input"],
    [fields.privacy, "change"],
  ];

  for (const [field, event] of cases) {
    field.setCustomValidity("Alte Fehlermeldung");
    const listener = field.listeners.get(event);

    assert.equal(typeof listener, "function", `${field.name} needs a ${event} listener`);
    listener({ currentTarget: field });
    assert.equal(field.validity.customError, false);
  }
});
