import { Dropdown as HeroDropdown, Label } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";

type DropdownRootProps = ComponentProps<typeof HeroDropdown>;
type MenuProps = ComponentProps<typeof HeroDropdown.Menu>;
type ItemProps = ComponentProps<typeof HeroDropdown.Item>;

function DropdownRoot({ children, ...props }: DropdownRootProps) {
  return <HeroDropdown {...props}>{children}</HeroDropdown>;
}

function DropdownTrigger(props: ComponentProps<typeof HeroDropdown.Trigger>) {
  return <HeroDropdown.Trigger {...props} />;
}

function DropdownPopover(props: ComponentProps<typeof HeroDropdown.Popover>) {
  return <HeroDropdown.Popover {...props} />;
}

function DropdownMenu(props: MenuProps) {
  return <HeroDropdown.Menu {...props} />;
}

function DropdownItem({
  children,
  label,
  ...props
}: ItemProps & { label?: ReactNode }) {
  return (
    <HeroDropdown.Item {...props}>
      {label != null ? <Label>{label}</Label> : children}
    </HeroDropdown.Item>
  );
}

export const Dropdown = Object.assign(DropdownRoot, {
  Trigger: DropdownTrigger,
  Popover: DropdownPopover,
  Menu: DropdownMenu,
  Item: DropdownItem,
});

export type { DropdownRootProps as DropdownProps };
