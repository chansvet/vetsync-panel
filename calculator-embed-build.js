const fs = require('fs');

// Embed the original calculator, including its styles, recipes and settings.
// Attribute handlers become delegated listeners so no inline script/eval is needed.
module.exports = () => {
  const source = fs.readFileSync('../vet_calculator/index.html', 'utf8')
    .replace(/\bon(click|change|focus)=/g, 'data-vc-$1=');
  const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  const html = source.replace(/<script>[\s\S]*?<\/script>/g, '');
  const names = [...scripts.matchAll(/^function (\w+)\(/gm)].map((m) => m[1]);
  return `const calculatorDocument = ${JSON.stringify(html)};
const startCalculator = (document, window, localStorage, location, history) => {
${scripts}
return {${names.join(',')}};
};
const mountCalculator = (frame, storage) => {
  const doc = frame.contentDocument;
  doc.open(); doc.write(calculatorDocument); doc.close();
  const api = startCalculator(doc, frame.contentWindow, storage, {hash:''}, {});
  const invoke = (code, element, event) => {
    if (code === 'event.stopPropagation()') { event.stopPropagation(); return; }
    if (code === 'this.select()') { element.select(); return; }
    const match = code.match(/^(\\w+)\\((.*)\\)$/);
    if (!match || !api[match[1]]) return;
    const args = match[2].trim() ? match[2].split(',').map((part) => {
      const value = part.trim();
      if (value === 'event') return event;
      if (value === 'this.value') return element.value;
      if (/^['\"]/.test(value)) return value.slice(1, -1);
      return Number(value);
    }) : [];
    api[match[1]](...args);
  };
  ['click','change','focus'].forEach((type) => doc.addEventListener(type === 'focus' ? 'focusin' : type, (event) => {
    const element = event.target.closest('[data-vc-' + type + ']');
    if (element) invoke(element.getAttribute('data-vc-' + type), element, event);
  }));
  return {setWeight(value) { doc.getElementById('weightInput').value = value; api.renderDrugs(doc.getElementById('searchInput').value); },
    text() { return doc.body.innerText; }};
};`;
};
