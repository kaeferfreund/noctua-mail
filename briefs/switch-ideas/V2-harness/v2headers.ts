// Client-side group headers (buildGroupedMessages + collapse merge) for base vs branch diff outputs.
//   cd <worktree> && bun --tsconfig-override tsconfig.json .tmp/harness/v2headers.ts base.json branch.json
import { readFileSync } from "node:fs";
import { buildGroupedMessages } from "@/app/components/mailclient/messagelist/listModel";
import { buildThreadTree, flattenThread } from "@/app/components/mailclient/messagelist/threadTree";
import { mergeCollapsedGroupsWithMeta, computeToggleAllGroupsState } from "@/app/components/mailclient/messagelist/listState";
import { computeGroupMeta, isFlaggedMessage } from "@/app/components/mailclient/utils/messageHelpers";
const [a, b] = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, "utf8")));
let compared = 0, same = 0;
for (const key of Object.keys(a)) {
  const x = a[key]?.body, y = b[key]?.body;
  if (!x?.items || !y?.items) continue;
  if (JSON.stringify(x.groups) === JSON.stringify(y.groups)) continue;
  const groupBy = new URLSearchParams(key).get("groupBy") ?? (/(week|year|sender|domain|none|event|inviteDate)$/.test(key) ? "other" : "date");
  const render = (body: any) => {
    const groups = buildGroupedMessages({ listScopeMessages: body.items, supportsThreads: true, groupMeta: body.groups, groupBy: "date",
      buildThreadTree, flattenThread: flattenThread as any, isFlaggedMessage, computeGroupMeta: (items: any[]) => computeGroupMeta(items, "date") });
    const headers = groups.map((g: any) => ({ key: g.key, label: g.label, count: g.count, countIsLoaded: g.countIsLoaded, ids: g.items.map((i: any) => i.id) }));
    const collapsed = mergeCollapsedGroupsWithMeta({ Today: true, Yesterday: true, "This Week": true, Older: true }, body.groups);
    const toggle = computeToggleAllGroupsState({ groupMeta: body.groups, combinedGroups: groups, collapsedGroups: {} });
    return { headers, collapsed, toggle };
  };
  compared++;
  const rx = render(x), ry = render(y);
  const hs = JSON.stringify(rx.headers) === JSON.stringify(ry.headers);
  if (hs) same++;
  console.log(key, groupBy, "headers identical:", hs, "| collapse kept base:", Object.keys(rx.collapsed).join("/"), "branch:", Object.keys(ry.collapsed).join("/"),
    "| toggle base:", Object.keys(rx.toggle).join("/"), "branch:", Object.keys(ry.toggle).join("/"));
  if (!hs) console.log("  base", JSON.stringify(rx.headers.map((h: any) => [h.key, h.count])), "branch", JSON.stringify(ry.headers.map((h: any) => [h.key, h.count])));
}
console.log(`views with changed groups: ${compared}, client headers identical: ${same}`);
