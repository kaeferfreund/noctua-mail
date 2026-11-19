/**
 * Places inside the newsletter area and their URLs. Kept free of component imports: the
 * sidebar entry needs the href without loading the area itself.
 */

export const OUTREACH_SECTIONS = ["overview", "contacts", "lists", "templates", "campaigns", "sequences"] as const;
export type OutreachSection = (typeof OUTREACH_SECTIONS)[number];

/** Where the area is: a section, optionally one item (id or `new`) and, for contacts, a list filter. */
export type OutreachLocation = { section: OutreachSection; id?: string | null; listId?: string | null };

export function parseOutreachLocation(params: { get(name: string): string | null }): OutreachLocation {
  const section = params.get("section");
  return {
    section: (OUTREACH_SECTIONS as readonly string[]).includes(section ?? "") ? section as OutreachSection : "overview",
    id: params.get("id") || null,
    listId: params.get("list") || null
  };
}

export function outreachLocationSearch(accountId: string, location: OutreachLocation) {
  const params = new URLSearchParams({ accountId });
  if (location.section !== "overview") params.set("section", location.section);
  if (location.id) params.set("id", location.id);
  if (location.listId) params.set("list", location.listId);
  return `?${params.toString()}`;
}

/** Path of the newsletter area; the sidebar entry and deep links point here. */
export const OUTREACH_PAGE_PATH = "/newsletter";

export function outreachPageHref(accountId: string, location: OutreachLocation = { section: "overview" }) {
  return `${OUTREACH_PAGE_PATH}${outreachLocationSearch(accountId, location)}`;
}
