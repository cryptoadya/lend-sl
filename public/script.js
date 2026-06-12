const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#primary-nav");
const contactForm = document.querySelector("[data-contact-form]");

menuToggle?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  document.body.classList.toggle("nav-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    nav.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    nav?.classList.remove("is-open");
    document.body.classList.remove("nav-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  }
});

contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const privacy = formData.get("privacy") ? "ja" : "nein";

  const subject = encodeURIComponent(`Kontaktanfrage von ${name || "der Website"}`);
  const body = encodeURIComponent(
    [
      `Name: ${name}`,
      `Telefon: ${phone}`,
      `E-Mail: ${email}`,
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
