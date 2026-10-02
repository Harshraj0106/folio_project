export function el(tag, { className, text, attrs = {}, dataset = {} } = {}, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  Object.assign(node.dataset, dataset);
  node.append(...children);
  return node;
}

// Skips the write when nothing changed, so untouched cells are never repainted.
export function setText(node, text) {
  if (node.textContent === text) return false;
  node.textContent = text;
  return true;
}
