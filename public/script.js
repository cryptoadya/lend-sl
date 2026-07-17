const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#primary-nav");
const contactForm = document.querySelector("[data-contact-form]");
const nameInput = contactForm?.querySelector('[name="name"]');
const phone = contactForm?.querySelector('[name="phone"]');
const email = contactForm?.querySelector('[name="email"]');
const messageInput = contactForm?.querySelector('[name="message"]');
const privacyInput = contactForm?.querySelector('[name="privacy"]');
const contactError = contactForm?.querySelector("[data-contact-error]");

menuToggle?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  document.body.classList.toggle("nav-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Menü schließen" : "Menü öffnen");
});

nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    nav.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Menü öffnen");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const wasOpen = nav?.classList.contains("is-open");
    nav?.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Menü öffnen");
    if (wasOpen) {
      menuToggle?.focus();
    }
  }
});

const desktopNavigation = window.matchMedia("(min-width: 900px)");

desktopNavigation.addEventListener("change", (event) => {
  if (event.matches) {
    nav?.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Menü öffnen");
  }
});

const clearReturnContactError = () => {
  phone?.setCustomValidity("");
  email?.setCustomValidity("");
  if (contactError) {
    contactError.hidden = true;
  }
};

phone?.addEventListener("input", clearReturnContactError);
email?.addEventListener("input", clearReturnContactError);

const clearFieldValidity = (event) => {
  event.currentTarget.setCustomValidity("");
};

nameInput?.addEventListener("input", clearFieldValidity);
messageInput?.addEventListener("input", clearFieldValidity);
privacyInput?.addEventListener("change", clearFieldValidity);

let contactSubmitting = false;

contactForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Prevent double-submit
  if (contactSubmitting) return;

  const formData = new FormData(contactForm);
  const name = String(formData.get("name") || "").trim();
  const phoneValue = String(formData.get("phone") || "").trim();
  const emailValue = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const privacyChecked = Boolean(formData.get("privacy"));
  const website = String(formData.get("website") || "").trim();

  const statusEl = contactForm.querySelector("[data-contact-status]");
  const submitBtn = contactForm.querySelector("[type='submit']");

  const showStatus = (msg, isError = false) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.hidden = false;
    if (isError) {
      statusEl.focus();
    }
  };

  const clearStatus = () => {
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.hidden = true;
    }
  };

  clearStatus();

  nameInput?.setCustomValidity(name ? "" : "Bitte geben Sie Ihren Namen an.");
  messageInput?.setCustomValidity(message ? "" : "Bitte geben Sie eine Nachricht ein.");
  privacyInput?.setCustomValidity(
    privacyChecked ? "" : "Bitte bestätigen Sie die Datenschutzerklärung.",
  );

  if (!phoneValue && !emailValue) {
    const errorMessage = "Bitte geben Sie eine Telefonnummer oder E-Mail-Adresse an.";
    phone.setCustomValidity(errorMessage);
    email.setCustomValidity(errorMessage);
    contactError.hidden = false;
  } else {
    clearReturnContactError();
  }

  if (!contactForm.checkValidity()) {
    contactForm.reportValidity();
    return;
  }

  // Disable button and guard against double-submit
  contactSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone: phoneValue,
        email: emailValue,
        message,
        privacy: privacyChecked,
        website,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (response.ok && data?.ok) {
      showStatus(data.message || "Vielen Dank. Wir melden uns zeitnah bei Ihnen.");
      contactForm.reset();
    } else {
      showStatus(
        "Ihre Anfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut oder rufen Sie uns an.",
        true,
      );
    }
  } catch {
    clearTimeout(timeoutId);
    showStatus(
      "Ihre Anfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut oder rufen Sie uns an.",
      true,
    );
  } finally {
    contactSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
});


const observer = new IntersectionObserver(
  ([entry]) => {
    header?.classList.toggle("is-scrolled", !entry.isIntersecting);
  },
  { threshold: 0 },
);

const hero = document.querySelector(".hero");
if (hero) {
  observer.observe(hero);
}
