import { ListBox, Select as HeroSelect } from "@heroui/react";
import type { ComponentProps, Key, ReactNode } from "react";

export type SelectOption = {
  id: string;
  label: string;
};

export type SelectProps = {
  "aria-label"?: string;
  label?: ReactNode;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  className?: string;
  fullWidth?: boolean;
};

/**
 * Simplified single-select adapter over HeroUI Select + ListBox.
 * Consumers pass options; they never import ListBox/Select from HeroUI.
 */
export function Select({
  "aria-label": ariaLabel,
  label,
  placeholder,
  value,
  onChange,
  options,
  className,
  fullWidth = true,
}: SelectProps) {
  return (
    <div className={className}>
      {label ? (
        <span className="mb-1 block text-xs text-[var(--app-muted)]">{label}</span>
      ) : null}
      <HeroSelect
        aria-label={ariaLabel}
        selectedKey={value || null}
        onSelectionChange={(key: Key | null) => {
          if (key == null) return;
          onChange?.(String(key));
        }}
        fullWidth={fullWidth}
        placeholder={placeholder}
      >
        <HeroSelect.Trigger>
          <HeroSelect.Value />
          <HeroSelect.Indicator />
        </HeroSelect.Trigger>
        <HeroSelect.Popover>
          <ListBox>
            {options.map((opt) => (
              <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                {opt.label}
              </ListBox.Item>
            ))}
          </ListBox>
        </HeroSelect.Popover>
      </HeroSelect>
    </div>
  );
}

export type SelectRootProps = ComponentProps<typeof HeroSelect>;
