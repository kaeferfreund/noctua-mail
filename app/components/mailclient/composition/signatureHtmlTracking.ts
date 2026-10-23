/** Capture Lexical's first serialization of the seeded paragraph. No body mutation. */
export function findSerializedSignatureBlock(html: string, text: string): string | undefined {
  const document = new DOMParser().parseFromString(html, "text/html");
  const matches = [...document.querySelectorAll("p")].filter(paragraph => {
    const copy = paragraph.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("br").forEach(br => br.replaceWith("\n"));
    return copy.textContent === text;
  });
  if (matches.length !== 1) return;
  const block = matches[0].outerHTML;
  return html.includes(block) ? block : undefined;
}
