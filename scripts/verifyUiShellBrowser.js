/**
 * Browser geometry regressions for the UI shell. Run this function in the
 * collaborative preview after opening the named surface in a synthetic mailbox.
 * Layout assertions need a real browser; happy-dom has no layout engine.
 * Scenarios: rows, reader, menu, settings, compose, related-results, saved-panes.
 */
export function verifyUiShellBrowser(scenario) {
  const mobile = innerWidth < 768;
  const rect = (element) => element.getBoundingClientRect();
  const visible = (element) => rect(element).width > 0 && rect(element).height > 0;
  const assert = (condition, message) => { if (!condition) throw new Error(`${scenario}: ${message}`); };
  const all = (selector) => [...document.querySelectorAll(selector)].filter(visible);
  const report = { scenario, width: innerWidth, height: innerHeight, theme: document.documentElement.className };
  if (scenario === "rows") {
    const rows = all('[data-message-layout="stacked"]');
    assert(rows.length > 1, "need at least two rendered message rows");
    for (const [index, row] of rows.entries()) {
      const subject = row.querySelector('[data-message-subject]');
      const sender = row.querySelector('[data-message-cell="from"]');
      const more = row.querySelector('button[aria-label="Message actions"]');
      const unread = row.querySelector('[data-message-cell="unread"] button');
      if (mobile) {
        assert(rect(subject).width > 40, `subject ${index} collapsed`);
        assert(rect(subject).top >= rect(sender).bottom, `subject ${index} must be below sender`);
        assert(rect(more).right <= innerWidth && rect(more).left >= 0, `menu ${index} outside viewport`);
        assert(rect(more).width >= 44 && rect(more).height >= 44, `menu ${index} touch area`);
        assert(rect(unread).width === 8 && rect(unread).height === 8, `unread ${index} glyph enlarged`);
        const hit = getComputedStyle(unread, "::after");
        assert(parseFloat(hit.width) >= 44 && parseFloat(hit.height) >= 44, `unread ${index} hit area`);
        assert(row.scrollWidth <= row.clientWidth + 1, `row ${index} overflows horizontally`);
      }
      const virtual = row.closest('[style*="translateY"]');
      assert(rect(virtual).height === (mobile ? 72 : 40), `row ${index} virtual height`);
      if (index) {
        const previous = rect(rows[index - 1]);
        assert(rect(row).top >= previous.bottom, `row ${index} overlaps previous hit area`);
      }
    }
    report.rows = rows.length;
    report.subjectWidth = rect(rows[0].querySelector('[data-message-subject]')).width;
    report.moreRight = rect(rows[0].querySelector('button[aria-label="Message actions"]')).right;
  } else if (scenario === "reader") {
    const senders = all('[class*="metaSegmentFrom"]');
    assert(senders.length > 0, "need an expanded message");
    for (const sender of senders) {
      const date = sender.parentElement.querySelector('[class*="metaSegmentDate"]');
      if (mobile) assert(rect(date).top >= rect(sender).bottom, "sender and date overlap");
      assert(sender.scrollWidth <= sender.clientWidth + 1, "sender address overflows");
    }
    report.messages = senders.length;
  } else if (scenario === "menu") {
    const items = all('[role="menuitem"]');
    assert(items.some((item) => item.textContent.trim() === "Move to"), "Move to missing");
    for (const item of items) assert(rect(item).height >= 44, `${item.textContent} touch area`);
    report.items = items.length;
  } else if (scenario === "settings") {
    const tabs = all('[role="dialog"] [role="tab"]');
    assert(tabs.some((tab) => tab.textContent.includes("Categorization")), "long tab missing");
    for (const tab of tabs) {
      assert(rect(tab).height >= 44, "tab touch area");
      for (const label of tab.querySelectorAll('span')) {
        assert(label.scrollWidth <= label.clientWidth + 1, `${label.textContent} overflows tab label`);
        assert(rect(label).right <= rect(tab).right + 1, "label escapes tab rail");
      }
    }
    report.tabs = tabs.length;
  } else if (scenario === "compose") {
    const dialog = all('[role="dialog"][aria-modal="true"]')[0];
    assert(dialog, "labelled modal dialog missing");
    assert(dialog.getAttribute("aria-labelledby"), "dialog title missing");
    assert(dialog.contains(document.activeElement), "focus escaped composer");
    assert(rect(dialog).width === innerWidth && rect(dialog).height === innerHeight, "composer not full screen");
    report.focus = document.activeElement.getAttribute("aria-label") || document.activeElement.tagName;
  } else if (scenario === "related-results") {
    assert(document.querySelector('[data-mobile-view]').getAttribute("data-mobile-view") === "list", "related results hidden by reader");
    assert(all('[role="dialog"]').length === 0, "calendar Sheet remained open");
    assert(document.querySelector('[data-slot="shell-header"]').textContent, "shell missing");
    report.view = "list";
  } else if (scenario === "saved-panes") {
    const group = document.querySelector('[data-slot="resizable-panel-group"]');
    const list = group.querySelector('[id="list"]');
    const reader = group.querySelector('[id="reader"]');
    const percentage = rect(list).width / (rect(list).width + rect(reader).width) * 100;
    assert(Math.abs(percentage - 30) < 1, `saved 30% list rendered at ${percentage}%`);
    report.listPercentage = percentage;
  } else throw new Error(`Unknown scenario: ${scenario}`);
  return report;
}
