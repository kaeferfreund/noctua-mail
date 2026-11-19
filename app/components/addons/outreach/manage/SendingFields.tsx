"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";
import { Switch } from "@/app/components/ui/switch";
import { useOutreachManage } from "./manageContext";
import { ErrorNote, Field, nativeControlClass, useOutreachFormat } from "./ui";

/** Sender identity of the mailbox; empty means the addon's default identity (settings tab). */
export function SenderSelect({ value, onChange, disabled }: { value: string | null; onChange: (value: string | null) => void; disabled?: boolean }) {
  const t = useTranslations("outreach");
  const { identities } = useOutreachManage();
  const { ensure } = identities;
  useEffect(() => { ensure(); }, [ensure]);
  const options = (identities.data ?? []).filter(identity => identity.enabled || identity.id === value);
  return (
    <Field label={t("sending.sender")} hint={t("sending.senderHint")}>
      <select className={nativeControlClass} disabled={disabled} value={value ?? ""} onChange={event => onChange(event.target.value || null)}>
        <option value="">{t("sending.senderDefault")}</option>
        {options.map(identity => (
          <option key={identity.id} value={identity.id}>{identity.displayName ? `${identity.displayName} <${identity.email}>` : identity.email}</option>
        ))}
      </select>
    </Field>
  );
}

/** Checkbox list of the mailbox's active lists with their member counts. */
export function ListChecklist({ legend, hint, selected, disabledIds, onChange, disabled }: {
  legend: string; hint?: string; selected: string[]; disabledIds?: string[]; onChange: (ids: string[]) => void; disabled?: boolean;
}) {
  const t = useTranslations("outreach");
  const { lists } = useOutreachManage();
  const format = useOutreachFormat();
  const { ensure } = lists;
  useEffect(() => { ensure(); }, [ensure]);
  const available = (lists.data ?? []).filter(list => !list.archivedAt || selected.includes(list.id));
  return (
    <fieldset className="flex min-w-0 flex-col gap-1" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <ErrorNote error={lists.error} />
      {lists.data && available.length === 0 ? <p className="text-sm text-muted-foreground">{t("sending.noLists")}</p> : null}
      {available.map(list => {
        const checked = selected.includes(list.id);
        return (
          <label key={list.id} className="flex items-center gap-2 text-sm max-md:min-h-11">
            <input type="checkbox" checked={checked} disabled={!checked && disabledIds?.includes(list.id)}
              onChange={() => onChange(checked ? selected.filter(id => id !== list.id) : [...selected, list.id])} />
            <span className="min-w-0 flex-1 truncate">{list.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{t("lists.members", { count: list.memberCount, formatted: format.number(list.memberCount) })}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function LabeledSwitch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 text-sm max-md:min-h-11">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export function TrackingSwitches({ trackOpens, trackClicks, onChange, disabled }: {
  trackOpens: boolean; trackClicks: boolean; onChange: (value: { trackOpens: boolean; trackClicks: boolean }) => void; disabled?: boolean;
}) {
  const t = useTranslations("outreach");
  return (
    <fieldset className="flex flex-col gap-1" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{t("sending.tracking")}</legend>
      <LabeledSwitch label={t("sending.trackOpens")} checked={trackOpens} disabled={disabled} onChange={value => onChange({ trackOpens: value, trackClicks })} />
      <LabeledSwitch label={t("sending.trackClicks")} checked={trackClicks} disabled={disabled} onChange={value => onChange({ trackOpens, trackClicks: value })} />
    </fieldset>
  );
}

export { LabeledSwitch };
