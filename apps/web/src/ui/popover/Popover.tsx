import { Popover as HeroPopover } from "@heroui/react";
import type { ComponentProps } from "react";

type PopoverRootProps = ComponentProps<typeof HeroPopover>;

function PopoverRoot(props: PopoverRootProps) {
  return <HeroPopover {...props} />;
}

function PopoverTrigger(props: ComponentProps<typeof HeroPopover.Trigger>) {
  return <HeroPopover.Trigger {...props} />;
}

function PopoverContent(props: ComponentProps<typeof HeroPopover.Content>) {
  return <HeroPopover.Content {...props} />;
}

function PopoverDialog(props: ComponentProps<typeof HeroPopover.Dialog>) {
  return <HeroPopover.Dialog {...props} />;
}

function PopoverHeading(props: ComponentProps<typeof HeroPopover.Heading>) {
  return <HeroPopover.Heading {...props} />;
}

export const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Dialog: PopoverDialog,
  Heading: PopoverHeading,
});

export type { PopoverRootProps as PopoverProps };
