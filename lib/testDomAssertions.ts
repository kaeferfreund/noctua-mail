// DOM-test assertions that stay cheap when they fail. A failing
// `expect(document.activeElement).toBe(element)` makes bun format both happy-dom
// nodes, which walks the whole window graph (~20 MB of text, seconds under load).
// Inside a `waitFor` loop the first miss then blocks synchronously past the test
// timeout, so a focus that lands one tick later turns into a bimodal 6 s failure.

const describeElement = (element: Element) =>
  `<${element.tagName.toLowerCase()}> ${JSON.stringify((element.textContent ?? "").trim().slice(0, 80))}`;

/** Asserts focus identity and reports a short description of both elements on failure. */
export function expectFocused(element: Element) {
  const active = document.activeElement;
  if (active !== element) throw new Error(`Expected focus on ${describeElement(element)}, found ${active ? describeElement(active) : "nothing"}`);
}
