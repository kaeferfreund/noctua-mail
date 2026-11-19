"use client";

import { useTranslations } from "next-intl";
import { useCallback, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { ArrowLeft, FileCode2, LayoutDashboard, ListChecks, Megaphone, Repeat, Users } from "lucide-react";
import type { AccountRole, SenderIdentity } from "@/lib/data";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import { adminRequest } from "@/app/hooks/useAdminApi";
import type { ContactList, EmailTemplateSummary } from "@/lib/addons/outreach/types";
import { cn } from "@/lib/utils";
import { createOutreachApi } from "./outreachApi";
import { OUTREACH_SECTIONS, OutreachManageContext, useSharedResource, type OutreachLocation, type OutreachManageContextValue, type OutreachMember, type OutreachSection } from "./manageContext";
import { ConfirmDialog, outreachRootClass } from "./ui";
import OverviewSection from "./OverviewSection";
import ContactsSection from "./ContactsSection";
import ListsSection from "./ListsSection";
import TemplatesSection from "./TemplatesSection";
import CampaignsSection from "./CampaignsSection";
import SequencesSection from "./SequencesSection";

const ICONS: Record<OutreachSection, ReactNode> = {
  overview: <LayoutDashboard />, contacts: <Users />, lists: <ListChecks />,
  templates: <FileCode2 />, campaigns: <Megaphone />, sequences: <Repeat />
};

/** Lets the page send browser Back/Forward through the unsaved-changes dialog. */
export type OutreachLeaveGuard = {
  /** Whether an editor holds unsaved changes. */
  blocks: () => boolean;
  /** Opens the unsaved-changes dialog; `leave` runs when the user discards the changes. */
  ask: (leave: () => void) => void;
};

export type OutreachManageProps = {
  accountId: string;
  /** Mailbox label shown in the header (name or address). */
  accountLabel: string;
  role: AccountRole;
  location: OutreachLocation;
  onLocationChange: (location: OutreachLocation) => void;
  /** Link back to the mail program. */
  mailHref: string;
  fetchImpl?: AdminFetch;
  leaveGuard?: Ref<OutreachLeaveGuard>;
};

/** The newsletter area of one mailbox: section navigation, shared data and the unsaved-changes guard. */
export default function OutreachManage({ accountId, accountLabel, role, location, onLocationChange, mailHref, fetchImpl = fetch, leaveGuard }: OutreachManageProps) {
  const t = useTranslations("outreach");
  const api = useMemo(() => createOutreachApi(accountId, fetchImpl), [accountId, fetchImpl]);
  const dirty = useRef(new Set<string>());
  /** The way out the unsaved-changes dialog is asking about. */
  const [pending, setPending] = useState<{ leave: () => void } | null>(null);

  const setDirty = useCallback((key: string, value: boolean) => {
    if (value) dirty.current.add(key); else dirty.current.delete(key);
  }, []);
  const navigate = useCallback((next: OutreachLocation) => {
    if (dirty.current.size > 0) { setPending({ leave: () => onLocationChange(next) }); return; }
    onLocationChange(next);
  }, [onLocationChange]);
  useImperativeHandle(leaveGuard, () => ({ blocks: () => dirty.current.size > 0, ask: leave => setPending({ leave }) }), []);

  const lists = useSharedResource(() => api.get<{ lists: ContactList[] }>("lists").then(body => body.lists), accountId);
  const templates = useSharedResource(() => api.get<{ templates: EmailTemplateSummary[] }>("templates").then(body => body.templates), accountId);
  const identities = useSharedResource(
    () => adminRequest<{ identities: SenderIdentity[] }>(fetchImpl, `/api/accounts/${encodeURIComponent(accountId)}/identities`).then(body => body.identities),
    accountId
  );
  const members = useSharedResource(
    () => adminRequest<{ members: OutreachMember[] }>(fetchImpl, `/api/accounts/${encodeURIComponent(accountId)}/members`).then(body => body.members),
    accountId
  );

  const canEdit = role === "editor" || role === "manager";
  const value: OutreachManageContextValue = {
    api, accountId, role, canEdit,
    isManager: role === "manager",
    navigate, setDirty, lists, templates, identities, members
  };

  return (
    <OutreachManageContext.Provider value={value}>
      <div data-shell="newsletter" className={cn(outreachRootClass, "flex h-full min-h-0 flex-col bg-background text-foreground md:flex-row")}>
        <nav aria-label={t("nav.label")} className="flex shrink-0 flex-col gap-2 border-b p-3 md:w-56 md:border-r md:border-b-0">
          <div className="flex items-center gap-2">
            <a href={mailHref} className="inline-flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring max-md:size-11"
              aria-label={t("nav.backToMail")} title={t("nav.backToMail")}>
              <ArrowLeft className="size-4" />
            </a>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-base font-semibold">{t("title")}</h1>
              <p className="truncate text-xs text-muted-foreground">{accountLabel}</p>
            </div>
          </div>
          <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {OUTREACH_SECTIONS.map(section => {
              const active = location.section === section;
              return (
                <li key={section} className="shrink-0">
                  <button type="button" aria-current={active ? "page" : undefined} onClick={() => navigate({ section })}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11 [&_svg]:size-4",
                      active && "bg-[var(--iris-3)] text-[var(--iris-11)] hover:bg-[var(--iris-3)]")}>
                    {ICONS[section]}<span>{t(`nav.${section}`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!canEdit ? <p className="text-xs text-muted-foreground">{t("nav.readOnly")}</p> : null}
        </nav>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-[calc(1rem+var(--sab,0px))]">
            <SectionView location={location} />
          </div>
        </div>
      </div>
      {pending ? (
        <ConfirmDialog title={t("unsaved.title")} description={t("unsaved.description")} confirmLabel={t("unsaved.discard")} destructive busy={false}
          onCancel={() => setPending(null)}
          onConfirm={() => { dirty.current.clear(); setPending(null); pending.leave(); }} />
      ) : null}
    </OutreachManageContext.Provider>
  );
}

function SectionView({ location }: { location: OutreachLocation }) {
  switch (location.section) {
    case "contacts": return <ContactsSection id={location.id ?? null} listId={location.listId ?? null} />;
    case "lists": return <ListsSection />;
    case "templates": return <TemplatesSection id={location.id ?? null} />;
    case "campaigns": return <CampaignsSection id={location.id ?? null} />;
    case "sequences": return <SequencesSection id={location.id ?? null} />;
    default: return <OverviewSection />;
  }
}
