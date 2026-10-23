"use client";

import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import MDEditor, { commands as markdownCommands, type ICommand } from "@uiw/react-md-editor";
import { useTranslations } from "next-intl";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import remarkBreaks from "remark-breaks";
import styles from "./ComposeMarkdownEditor.module.css";

type ComposeMarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  resetKey?: number | string;
};

// Library command names → Editor.markdown.commands keys. Headings (heading1–6)
// share one message with a level parameter; dividers carry no label.
const MARKDOWN_COMMAND_KEYS = {
  bold: "bold",
  italic: "italic",
  strikethrough: "strikethrough",
  hr: "hr",
  title: "title",
  link: "link",
  quote: "quote",
  code: "code",
  codeBlock: "codeBlock",
  comment: "comment",
  image: "image",
  table: "table",
  "unordered-list": "unorderedList",
  "ordered-list": "orderedList",
  "checked-list": "checkedList",
  help: "help",
  edit: "edit",
  live: "live",
  preview: "preview",
  fullscreen: "fullscreen"
} as const;

type MarkdownCommandName = keyof typeof MARKDOWN_COMMAND_KEYS;
type MarkdownCommandText = { label?: string; iconText?: string };

function isMarkdownCommandName(name: string | undefined): name is MarkdownCommandName {
  return Boolean(name && Object.hasOwn(MARKDOWN_COMMAND_KEYS, name));
}

/**
 * Clones the library's command tree (same commands, order, shortcuts and
 * execute handlers) and replaces only the button label and, for text icons
 * such as "Heading 1", the visible icon text.
 */
export function localizeMarkdownCommands(
  list: ICommand[],
  localize: (command: ICommand) => MarkdownCommandText,
  parent?: ICommand
): ICommand[] {
  return list.map((command) => {
    const { label, iconText } = localize(command);
    const next = { ...command } as ICommand;
    if (parent) next.parent = parent;
    if (label) next.buttonProps = { ...command.buttonProps, "aria-label": label, title: label };
    if (iconText && isValidElement(command.icon)) next.icon = cloneElement(command.icon, undefined, iconText);
    if (Array.isArray(command.children)) {
      (next as { children?: ICommand[] }).children = localizeMarkdownCommands(command.children, localize, next);
    }
    return next;
  });
}

function useLocalizedMarkdownCommands() {
  const t = useTranslations("Editor.markdown");
  return useMemo(() => {
    // Shortcut bindings stay library data ("ctrlcmd+shift+j"); only the
    // modifier names in the hint are localized.
    const shortcut = (binding: string | undefined) =>
      (binding ?? "")
        .split("+")
        .map((key) =>
          key === "ctrlcmd" || key === "ctrl" ? t("keys.ctrl") : key === "shift" ? t("keys.shift") : key
        )
        .join(" + ");
    const localize = (command: ICommand): MarkdownCommandText => {
      const heading = /^heading([1-6])$/.exec(command.name ?? "");
      if (heading) {
        const level = Number(heading[1]);
        return {
          label: t("commands.heading", { level, shortcut: shortcut(command.shortcuts) }),
          iconText: t("headingIcon", { level })
        };
      }
      if (!isMarkdownCommandName(command.name)) return {};
      return {
        label: t(`commands.${MARKDOWN_COMMAND_KEYS[command.name]}`, { shortcut: shortcut(command.shortcuts) })
      };
    };
    return {
      commands: localizeMarkdownCommands(markdownCommands.getCommands(), localize),
      extraCommands: localizeMarkdownCommands(markdownCommands.getExtraCommands(), localize)
    };
  }, [t]);
}

const DEFAULT_EDITOR_HEIGHT = 440;
const MIN_EDITOR_HEIGHT = 60;

export default function ComposeMarkdownEditor({
  value,
  onChange,
  resetKey,
}: ComposeMarkdownEditorProps) {
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const [editorHeight, setEditorHeight] = useState(DEFAULT_EDITOR_HEIGHT);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [localValue, setLocalValue] = useState(value);
  const { commands, extraCommands } = useLocalizedMarkdownCommands();

  // Detect dark mode from Radix theme
  useEffect(() => {
    const updateColorMode = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setColorMode(isDark ? "dark" : "light");
    };

    updateColorMode();

    // Watch for theme changes
    const observer = new MutationObserver(updateColorMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const syncHeight = (nextHeight: number) => {
      const normalizedHeight = Math.max(MIN_EDITOR_HEIGHT, Math.round(nextHeight));
      setEditorHeight((currentHeight) =>
        currentHeight === normalizedHeight ? currentHeight : normalizedHeight
      );
    };

    syncHeight(node.getBoundingClientRect().height);

    if (typeof ResizeObserver === "undefined") {
      const handleWindowResize = () => {
        syncHeight(node.getBoundingClientRect().height);
      };
      window.addEventListener("resize", handleWindowResize);
      return () => window.removeEventListener("resize", handleWindowResize);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      syncHeight(entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={styles.container} data-color-mode={colorMode}>
      <MDEditor
        value={localValue}
        onChange={(val) => {
          const nextVal = val || "";
          setLocalValue(nextVal);
          onChange(nextVal);
        }}
        preview="live"
        commands={commands}
        extraCommands={extraCommands}
        previewOptions={{
          // Mail compose treats single newlines as intentional line breaks.
          pluginsFilter(type, plugins) {
            if (type !== "remark") return plugins;
            return [...plugins, remarkBreaks];
          }
        }}
        height={editorHeight}
        visibleDragbar={false}
        key={resetKey}
      />
    </div>
  );
}
