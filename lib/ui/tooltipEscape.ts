/**
 * Radix prevents default when Escape closes a tooltip. A tooltip is only a hint,
 * so page-level Escape handlers may still act on that same key press.
 */
const tooltipEscapes = new WeakSet<Event>();
export function markTooltipEscape(event: Event) {
  tooltipEscapes.add(event);
}
export function isTooltipEscape(event: Event) {
  return tooltipEscapes.has(event);
}
