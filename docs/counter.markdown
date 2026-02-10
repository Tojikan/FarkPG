---
layout: default
title: Counter
permalink: /counter/
scripts:
  - /assets/js/counter.js
custom_css: |
  .counter-container {
    text-align: center;
    padding: 2rem;
  }

  .counter-display {
    font-size: 4rem;
    font-weight: bold;
    color: #1a1a1a;
    margin: 2rem 0;
    font-family: monospace;
  }

  .counter-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .counter-btn {
    padding: 1rem 2rem;
    font-size: 1.25rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.1s, box-shadow 0.2s;
  }

  .counter-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }

  .counter-btn:active {
    transform: translateY(0);
  }

  .counter-btn.increment {
    background-color: #2ecc71;
    color: white;
  }

  .counter-btn.decrement {
    background-color: #e74c3c;
    color: white;
  }

  .counter-btn.reset {
    background-color: #3498db;
    color: white;
  }

  .code-example {
    margin-top: 3rem;
    text-align: left;
    background-color: #f4f4f4;
    padding: 1.5rem;
    border-radius: 8px;
    overflow-x: auto;
  }

  .code-example h3 {
    margin-bottom: 1rem;
  }

  .code-example pre {
    background-color: #1a1a1a;
    color: #f8f8f2;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.9rem;
  }
---

# Counter Example

This page demonstrates how to add pure JavaScript to a Jekyll page.

<div class="counter-container">
  <div id="counter-display" class="counter-display">0</div>
  <div class="counter-buttons">
    <button class="counter-btn decrement" onclick="decrement()">- Decrease</button>
    <button class="counter-btn reset" onclick="resetCounter()">Reset</button>
    <button class="counter-btn increment" onclick="increment()">+ Increase</button>
  </div>
</div>

<div class="code-example">

### How It Works

This counter uses a **separate JavaScript file** referenced in the page's front matter:

<pre>
---
layout: default
scripts:
  - /assets/js/counter.js
---
</pre>

The JavaScript lives in `assets/js/counter.js` and is loaded by the layout template:

<pre>
{% raw %}{% for script in page.scripts %}
&lt;script src="{{ script | relative_url }}"&gt;&lt;/script&gt;
{% endfor %}{% endraw %}
</pre>

### Other Options

**Remote CDN scripts:**
<pre>
scripts:
  - https://cdn.example.com/library.min.js
  - /assets/js/my-local-script.js
</pre>

**Inline JavaScript** (for small scripts):
<pre>
custom_js: |
  console.log('Hello from inline JS!');
</pre>

</div>
