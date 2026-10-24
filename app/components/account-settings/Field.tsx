import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { Flex, Select, Switch, Text, TextArea, TextField } from "@radix-ui/themes";
import PasswordField from "@/app/components/PasswordField";
const CONTROL_TYPES = new Set<unknown>([TextField.Root, TextArea, PasswordField, Select.Trigger, Switch, "input", "select", "textarea"]);

// These components forward ARIA props to the native input/trigger. Walking the
// explicit children also covers Select.Root and layout wrappers without labelling
// password visibility buttons or putting nested labels around existing switches.
function labelControls(children: ReactNode, labelId: string, hintId?: string): ReactNode {
  // Preserve element/array shape, keys and empty children. Slot/asChild needs
  // its single element child to stay an element, including inside Slottable.
  if (Array.isArray(children)) {
    const labelled = children.map(child => labelControls(child, labelId, hintId));
    return labelled.every((child, index) => child === children[index]) ? children : labelled;
  }
  if (!isValidElement<Record<string, unknown>>(children)) return children;
  if (CONTROL_TYPES.has(children.type)) {
    return cloneElement(children, {
      "aria-labelledby": [children.props["aria-labelledby"], labelId].filter(Boolean).join(" "),
      "aria-describedby": [children.props["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined
    });
  }
  if (!("children" in children.props)) return children;
  const labelled = labelControls(children.props.children as ReactNode, labelId, hintId);
  if (labelled === children.props.children) return children;
  // Multiple JSX children are positional/static children, not a new dynamic list.
  if (Array.isArray(labelled) && labelled.length > 1) return cloneElement(children, {}, ...labelled);
  return cloneElement(children, { children: labelled });
}

/** Native control styling without a width, for controls sized by their content (table cells). 44px tall on phones. */
export const nativeControlBaseClass = "min-w-0 rounded-md border bg-background p-2 max-md:min-h-11";
/** Native select/input/textarea styling shared by the settings forms; fills and never widens its column. */
export const nativeControlClass = `w-full ${nativeControlBaseClass}`;

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export default function Field({ label, hint, children }: FieldProps) {
  const labelId = useId();
  const hintId = hint ? `${labelId}-hint` : undefined;
  return (
    <Flex direction="column" gap="1">
      <Text id={labelId} size="2" weight="medium">
        {label}
      </Text>
      {labelControls(children, labelId, hintId)}
      {hint && (
        <Text id={hintId} size="1" color="gray">
          {hint}
        </Text>
      )}
    </Flex>
  );
}
