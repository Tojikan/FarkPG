// Counter functionality - example of a separate JS file in Jekyll
let count = 0;
const display = document.getElementById('counter-display');

function updateDisplay() {
  display.textContent = count;
}

function increment() {
  count++;
  updateDisplay();
}

function decrement() {
  count--;
  updateDisplay();
}

function resetCounter() {
  count = 0;
  updateDisplay();
}

// Initialize display on page load
document.addEventListener('DOMContentLoaded', function() {
  updateDisplay();
});
