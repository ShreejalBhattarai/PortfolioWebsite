// Simple typewriter loop for the hero subtitle
const words = ["an engineering student", "a son and a brother", "an art enthusiast", "a fellow naive human"];
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

document.addEventListener("DOMContentLoaded", () => {
  typedText = document.getElementById("typed-text");
  if (!typedText) return;
  type();
});

