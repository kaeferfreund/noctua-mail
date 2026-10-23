import { useSenderMessages } from "@/lib/i18n/useSenderMessages";
import { senderOption } from "@/lib/senderMessages";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type React from "react";
import { Button, Select, Text, TextField } from "@radix-ui/themes";
import type { Message, RecipientSuggestion, SenderIdentity } from "@/lib/data";
import InReplyToReferenceRow from "../InReplyToReferenceRow";
import styles from "./Compose.module.css";

type RecipientFocus = "to" | "cc" | "bcc" | null;

type ComposeFieldsProps = {
  variant: "inline" | "modal";
  composeSubject: string;
  composeTo: string;
  composeCc: string;
  composeBcc: string;
  composeShowBcc: boolean;
  composeOpenedAt?: string;
  activeAccountId: string | null;
  fromValue?: string;
  identities?: SenderIdentity[];
  identityId?: string;
  identityDisabled?: boolean;
  senderMessage?: string | null;
  onSenderRetry?: () => void;
  onIdentityChange?: (id: string) => void;
  inReplyToMessage?: Message | null;
  onJumpToMessage?: (messageId: string) => void;
  setComposeSubject: React.Dispatch<React.SetStateAction<string>>;
  setComposeTo: React.Dispatch<React.SetStateAction<string>>;
  setComposeCc: React.Dispatch<React.SetStateAction<string>>;
  setComposeBcc: React.Dispatch<React.SetStateAction<string>>;
  setComposeShowBcc: React.Dispatch<React.SetStateAction<boolean>>;
  applyRecipientSelection: (
    current: string,
    selection: RecipientSuggestion,
    setter: React.Dispatch<React.SetStateAction<string>>,
    focusAfter?: RecipientFocus
  ) => string;
  loadRecipientOptions: (query: string, signal: AbortSignal) => Promise<RecipientSuggestion[]>;
  getComposeToken: (value: string) => string;
  markComposeDirty: () => void;
};

type RecipientFieldProps = {
  variant: "inline" | "modal";
  label: string;
  focusKey: Exclude<RecipientFocus, null>;
  value: string;
  placeholder: string;
  recipientOptions: RecipientSuggestion[];
  recipientActiveIndex: number;
  recipientLoading: boolean;
  recipientFocus: RecipientFocus;
  setRecipientQuery: React.Dispatch<React.SetStateAction<string>>;
  setRecipientFocus: React.Dispatch<React.SetStateAction<RecipientFocus>>;
  setRecipientActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  onChangeValue: (next: string) => void;
  onPickRecipient: (current: string, selection: RecipientSuggestion) => void;
  getComposeToken: (value: string) => string;
  showToggle?: boolean;
  toggleLabel?: string;
  toggleTitle?: string;
  toggleDisabled?: boolean;
  onToggle?: () => void;
};

function RecipientField({
  variant,
  label,
  focusKey,
  value,
  placeholder,
  recipientOptions,
  recipientActiveIndex,
  recipientLoading,
  recipientFocus,
  setRecipientQuery,
  setRecipientFocus,
  setRecipientActiveIndex,
  onChangeValue,
  onPickRecipient,
  getComposeToken,
  showToggle,
  toggleLabel,
  toggleTitle,
  toggleDisabled,
  onToggle
}: RecipientFieldProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const t = useTranslations("Compose.fields");

  return (
    <div className={styles.composeGridRow}>
      <Text as="label" htmlFor={`compose-${variant}-${focusKey}`} size="2" weight="medium" className={styles.label}>
        {label}
      </Text>
      <div className={styles.composeRow}>
        <div className={styles.composeInputWrap}>
          <TextField.Root
            id={`compose-${variant}-${focusKey}`}
            name={`compose_${focusKey}`}
            size="2"
            value={value}
            onChange={(event) => {
              onChangeValue(event.target.value);
              setRecipientQuery(getComposeToken(event.target.value));
              setShowSuggestions(true);
            }}
            onFocus={() => {
              setRecipientFocus(focusKey);
              setRecipientQuery(getComposeToken(value));
              setShowSuggestions(false);
            }}
            onBlur={() => {
              setShowSuggestions(false);
              setTimeout(() => {
                setRecipientFocus((current) => (current === focusKey ? null : current));
              }, 150);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (!showSuggestions) {
                  setShowSuggestions(true);
                  return;
                }
                if (!recipientOptions.length) return;
                setRecipientActiveIndex((prev) => Math.min(prev + 1, recipientOptions.length - 1));
              }
              if (event.key === "ArrowUp") {
                if (!recipientOptions.length) return;
                event.preventDefault();
                setRecipientActiveIndex((prev) => Math.max(prev - 1, 0));
              }
              if (event.key === "Enter" && recipientFocus === focusKey) {
                if (!recipientOptions.length) return;
                event.preventDefault();
                const pick = recipientOptions[recipientActiveIndex];
                if (pick) {
                  setShowSuggestions(false);
                  onPickRecipient(value, pick);
                }
              }
            }}
            placeholder={placeholder}
          />
          {recipientFocus === focusKey && showSuggestions && recipientOptions.length > 0 && (
            <div className={styles.composeSuggestions}>
              {recipientOptions.map((option, index) => (
                <button
                  key={`${option.kind}-${option.insertValue}-${index}`}
                  type="button"
                  className={`${styles.composeSuggestion} ${
                    index === recipientActiveIndex ? styles.composeSuggestionActive : ""
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setShowSuggestions(false);
                    onPickRecipient(value, option);
                  }}
                >
                  <span>{option.label}</span>
                  {option.kind === "alias" && (
                    <span className={styles.composeSuggestionMuted}>{option.recipients}</span>
                  )}
                </button>
              ))}
              {recipientLoading && (
                <span className={`${styles.composeSuggestion} ${styles.composeSuggestionMuted}`}>
                  {t("loadingSuggestions")}
                </span>
              )}
            </div>
          )}
        </div>
        {showToggle && (
          <Button
            type="button"
            size="1"
            variant="soft"
            color="gray"
            title={toggleTitle ?? toggleLabel}
            onClick={onToggle}
            disabled={toggleDisabled}
          >
            {toggleLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ComposeFields({
  variant,
  composeSubject,
  composeTo,
  composeCc,
  composeBcc,
  composeShowBcc,
  activeAccountId,
  fromValue,
  identities = [], identityId, identityDisabled = false, senderMessage, onSenderRetry, onIdentityChange,
  inReplyToMessage,
  onJumpToMessage,
  setComposeSubject,
  setComposeTo,
  setComposeCc,
  setComposeBcc,
  setComposeShowBcc,
  applyRecipientSelection,
  loadRecipientOptions,
  getComposeToken,
  markComposeDirty
}: ComposeFieldsProps) {
  const { messages: senderMessages } = useSenderMessages();
  const t = useTranslations();
  const [recipientOptions, setRecipientOptions] = useState<RecipientSuggestion[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientFocus, setRecipientFocus] = useState<RecipientFocus>(null);
  const [recipientActiveIndex, setRecipientActiveIndex] = useState(0);

  useEffect(() => {
    if (!activeAccountId) {
      setRecipientOptions([]);
      setRecipientLoading(false);
      setRecipientActiveIndex(0);
      return;
    }
    if (!recipientFocus) {
      setRecipientLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setRecipientLoading(true);
        const list = await loadRecipientOptions(recipientQuery.trim(), controller.signal);
        if (!active) return;
        setRecipientOptions(list);
        setRecipientActiveIndex(0);
      } catch {
        if (!active || controller.signal.aborted) return;
        setRecipientOptions([]);
      } finally {
        if (active) setRecipientLoading(false);
      }
    }, 180);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeAccountId, recipientFocus, recipientQuery, loadRecipientOptions]);

  const commitSubject = (next: string) => {
    markComposeDirty();
    // Controlled inputs and the send/autosave snapshot share one urgent state.
    setComposeSubject(next);
  };

  const commitRecipient = (
    next: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    markComposeDirty();
    setter(next);
  };

  const pickRecipient = (
    current: string,
    selection: RecipientSuggestion,
    setter: React.Dispatch<React.SetStateAction<string>>,
    focusKey: Exclude<RecipientFocus, null>
  ) => {
    markComposeDirty();
    applyRecipientSelection(current, selection, setter, focusKey);
    setRecipientQuery("");
  };

  const hasCcOrBccValue =
    composeCc.trim().length > 0 ||
    composeBcc.trim().length > 0;
  const showCcBccFields = composeShowBcc || hasCcOrBccValue;
  const canHideCcBcc = !hasCcOrBccValue;
  const toggleLabel = t(showCcBccFields ? "Compose.fields.hideCcBcc" : "Compose.fields.showCcBcc");
  const toggleTitle = showCcBccFields
    ? canHideCcBcc
      ? t("Compose.fields.hideCcBccTitle")
      : t("Compose.fields.clearCcBccToHide")
    : t("Compose.fields.showCcBccTitle");
  const inReplyToRow = inReplyToMessage ? (
    <InReplyToReferenceRow
      variant="compose"
      label={t("Reader.inReplyTo")}
      value={t("Compose.fields.inReplyTo", { subject: inReplyToMessage.subject || t("Reader.noSubject"), from: inReplyToMessage.from })}
      onClick={onJumpToMessage ? () => onJumpToMessage(inReplyToMessage.id) : undefined}
    />
  ) : null;
  const subjectRow = (
    <div className={styles.composeGridRow}>
      <Text as="label" htmlFor={`compose-${variant}-subject`} size="2" weight="medium" className={styles.label}>
        {t("Compose.fields.subject")}
      </Text>
      <TextField.Root
        id={`compose-${variant}-subject`}
        name="compose_subject"
        size="2"
        value={composeSubject}
        onChange={(event) => {
          commitSubject(event.target.value);
        }}
        placeholder={t("Compose.fields.subjectPlaceholder")}
      />
    </div>
  );
  const fromRow = (
    <div className={styles.composeGridRow}>
      <Text as="label" htmlFor={`compose-${variant}-from`} size="2" weight="medium" className={styles.label}>
        {senderMessages.from}
      </Text>
      <div className={styles.composeInputWrap}>
        <Select.Root value={identityId || "__unavailable"} disabled={identityDisabled || !onIdentityChange} onValueChange={id => { markComposeDirty(); onIdentityChange?.(id); }}>
          <Select.Trigger id={`compose-${variant}-from`} title={fromValue} aria-describedby={senderMessage ? `compose-${variant}-sender-message` : undefined} className={styles.composeFromTrigger} />
          <Select.Content position="popper" className={styles.composeFromMenu} collisionPadding={16}>
            {!identities.some(identity => identity.id === identityId && identity.enabled) && <Select.Item value={identityId || "__unavailable"} disabled>{fromValue ? senderOption(fromValue, "unavailable", senderMessages) : senderMessages.chooseSender}</Select.Item>}
            {identities.filter(identity => identity.enabled).map(identity => <Select.Item key={identity.id} value={identity.id}>
              {senderOption(identity.displayName ? `${identity.displayName} <${identity.email}>` : identity.email, identity.isDefault ? "default" : "enabled", senderMessages)}
            </Select.Item>)}
          </Select.Content>
        </Select.Root>
        {senderMessage && <Text as="p" size="1" id={`compose-${variant}-sender-message`} role="alert">{senderMessage} {onSenderRetry ? <button type="button" onClick={onSenderRetry}>{senderMessages.retrySender}</button> : <a href={`#compose-${variant}-from`}>{senderMessages.reviewSender}</a>}</Text>}
      </div>
    </div>
  );

  return (
    <div className={styles.composeGrid}>
      {fromRow}
      <RecipientField
        variant={variant}
        label={t("Compose.fields.to")}
        focusKey="to"
        value={composeTo}
        placeholder={t("Compose.fields.toPlaceholder")}
        recipientOptions={recipientOptions}
        recipientActiveIndex={recipientActiveIndex}
        recipientLoading={recipientLoading}
        recipientFocus={recipientFocus}
        setRecipientQuery={setRecipientQuery}
        setRecipientFocus={setRecipientFocus}
        setRecipientActiveIndex={setRecipientActiveIndex}
        onChangeValue={(next) => commitRecipient(next, setComposeTo)}
        onPickRecipient={(current, selection) =>
          pickRecipient(current, selection, setComposeTo, "to")
        }
        getComposeToken={getComposeToken}
        showToggle
        toggleLabel={toggleLabel}
        toggleDisabled={showCcBccFields && !canHideCcBcc}
        onToggle={() => {
          if (!canHideCcBcc) {
            setComposeShowBcc(true);
            return;
          }
          setComposeShowBcc((value) => !value);
        }}
        toggleTitle={toggleTitle}
      />
      {showCcBccFields && (
        <RecipientField
          variant={variant}
          label={t("Compose.fields.cc")}
          focusKey="cc"
          value={composeCc}
          placeholder="cc@example.com"
          recipientOptions={recipientOptions}
          recipientActiveIndex={recipientActiveIndex}
          recipientLoading={recipientLoading}
          recipientFocus={recipientFocus}
          setRecipientQuery={setRecipientQuery}
          setRecipientFocus={setRecipientFocus}
          setRecipientActiveIndex={setRecipientActiveIndex}
          onChangeValue={(next) => commitRecipient(next, setComposeCc)}
          onPickRecipient={(current, selection) =>
            pickRecipient(current, selection, setComposeCc, "cc")
          }
          getComposeToken={getComposeToken}
        />
      )}
      {showCcBccFields && (
        <RecipientField
          variant={variant}
          label={t("Compose.fields.bcc")}
          focusKey="bcc"
          value={composeBcc}
          placeholder="bcc@example.com"
          recipientOptions={recipientOptions}
          recipientActiveIndex={recipientActiveIndex}
          recipientLoading={recipientLoading}
          recipientFocus={recipientFocus}
          setRecipientQuery={setRecipientQuery}
          setRecipientFocus={setRecipientFocus}
          setRecipientActiveIndex={setRecipientActiveIndex}
          onChangeValue={(next) => commitRecipient(next, setComposeBcc)}
          onPickRecipient={(current, selection) =>
            pickRecipient(current, selection, setComposeBcc, "bcc")
          }
          getComposeToken={getComposeToken}
        />
      )}
      {subjectRow}
      {inReplyToRow}
    </div>
  );
}
