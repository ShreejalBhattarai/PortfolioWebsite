// Hero typewriter (cycles name + roles)
const words = [
  "Shreejal Bhattarai",
  "an ECE student at Txstate",
  "a quantum device researcher",
  "an art enthusiast",
  "an aspiring leader",
];
let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typingSpeed = 100;
const deletingSpeed = 60;
const delayBetweenWords = 1500;
let typedText = null;

function type() {
  if (!typedText) return;
  const currentWord = words[wordIndex];

  if (isDeleting) {
    typedText.textContent = currentWord.substring(0, charIndex--);
  } else {
    typedText.textContent = currentWord.substring(0, charIndex++);
  }

  if (!isDeleting && charIndex === currentWord.length) {
    typedText.textContent = currentWord;
    isDeleting = true;
    setTimeout(type, delayBetweenWords);
  } else if (isDeleting && charIndex === 0) {
    isDeleting = false;
    wordIndex = (wordIndex + 1) % words.length;
    setTimeout(type, 300);
    return;
  } else {
    setTimeout(type, isDeleting ? deletingSpeed : typingSpeed);
  }
}

function initNavToggle() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("site-nav-menu");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}

const THEME_KEY = "portfolioTheme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    const next = theme === "dark" ? "light" : "dark";
    btn.setAttribute("aria-label", `Switch to ${next} theme`);
    btn.setAttribute("title", `Switch to ${next} theme`);
  }
}

function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  applyTheme(currentTheme());
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) { }
    applyTheme(next);
  });

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      try {
        if (localStorage.getItem(THEME_KEY)) return;
      } catch (err) { }
      applyTheme(e.matches ? "dark" : "light");
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  typedText = document.getElementById("typed-text");
  if (typedText) type();
  initNavToggle();
  initThemeToggle();
});
