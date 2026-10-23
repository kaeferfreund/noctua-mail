/**
 * FullCalendar renders day numbers and column headers as `<a>` without `href`
 * when nav links are off. Browsers skip them in the tab order, but
 * `HTMLAnchorElement.tabIndex` still reports 0, so Radix FocusScope picks one
 * as the first/last tabbable element of a popover or sheet and its Tab loop
 * never wraps. An explicit -1 makes both agree.
 */
export function removeDateLabelsFromTabOrder({ el }: { el: HTMLElement }) {
  for (const anchor of el.querySelectorAll<HTMLAnchorElement>("a:not([href]):not([tabindex])")) anchor.tabIndex = -1;
}
