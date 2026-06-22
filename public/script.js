const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#primary-nav");
const contactForm = document.querySelector("[data-contact-form]");
const phone = contactForm?.querySelector('[name="phone"]');
const email = contactForm?.querySelector('[name="email"]');
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

const clearReturnContactError = () => {
  phone?.setCustomValidity("");
  email?.setCustomValidity("");
  if (contactError) {
    contactError.hidden = true;
  }
};

phone?.addEventListener("input", clearReturnContactError);
email?.addEventListener("input", clearReturnContactError);

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const name = String(formData.get("name") || "").trim();
  const phoneValue = String(formData.get("phone") || "").trim();
  const emailValue = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const privacy = formData.get("privacy") ? "ja" : "nein";

  if (!phoneValue && !emailValue) {
    const errorMessage = "Bitte geben Sie eine Telefonnummer oder E-Mail-Adresse an.";
    phone.setCustomValidity(errorMessage);
    email.setCustomValidity(errorMessage);
    contactError.hidden = false;
    phone.focus();
    phone.reportValidity();
    return;
  }

  clearReturnContactError();

  const subject = encodeURIComponent(`Kontaktanfrage von ${name || "der Website"}`);
  const body = encodeURIComponent(
    [
      `Name: ${name}`,
      `Telefon: ${phoneValue}`,
      `E-Mail: ${emailValue}`,
      `Datenschutz bestätigt: ${privacy}`,
      "",
      "Nachricht:",
      message,
    ].join("\n"),
  );

  window.location.href = `mailto:adelmarkt2015@gmail.com?subject=${subject}&body=${body}`;
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
