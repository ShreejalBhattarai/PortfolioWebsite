const words = ["an engineering student", "a cricketer", "an art enthusiast", "a tech savy lad"];
let wordIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typedText = document.getElementById("typed-text");
const typingSpeed = 100;
const deletingSpeed = 60;
const delayBetweenWords = 1500;

function type() {
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
  type();
});

