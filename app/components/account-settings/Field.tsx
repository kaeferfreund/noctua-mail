import { Children, cloneElement, isValidElement, useId, type ReactNode } from "react";
import { Flex, Select, Switch, Text, TextArea, TextField } from "@radix-ui/themes";
import PasswordField from "@/app/components/PasswordField";
const CONTROL_TYPES = new Set<unknown>([TextField.Root, TextArea, PasswordField, Select.Trigger, Switch, "input", "select", "textarea"]);

// These components forward ARIA props to the native input/trigger. Walking the
// explicit children also covers Select.Root and layout wrappers without labelling
// password visibility buttons or putting nested labels around existing switches.
function labelControls(children: ReactNode, labelId: string, hintId?: string): ReactNode {
  return Children.map(children, child => {
    if (!isValidElement<Record<string, unknown>>(child)) return child;
    if (CONTROL_TYPES.has(child.type)) {
      return cloneElement(child, {
        "aria-labelledby": [child.props["aria-labelledby"], labelId].filter(Boolean).join(" "),
        "aria-describedby": [child.props["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined
      });
    }
    return child.props.children ? cloneElement(child, {}, labelControls(child.props.children as ReactNode, labelId, hintId)) : child;
  });
}

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
