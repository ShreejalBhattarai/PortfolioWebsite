// Hero typewriter (cycles name + roles, Kylie-style)
const words = [
  "Shreejal Bhattarai",
  "an electrical & computer engineering student",
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

document.addEventListener("DOMContentLoaded", () => {
  typedText = document.getElementById("typed-text");
  if (typedText) type();
  initNavToggle();
});
