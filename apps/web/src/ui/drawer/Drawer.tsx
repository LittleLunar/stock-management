import { Drawer as HeroDrawer, useOverlayState } from "@heroui/react";
import type { ComponentProps } from "react";

type DrawerRootProps = ComponentProps<typeof HeroDrawer>;

function DrawerRoot(props: DrawerRootProps) {
  return <HeroDrawer {...props} />;
}

function DrawerTrigger(props: ComponentProps<typeof HeroDrawer.Trigger>) {
  return <HeroDrawer.Trigger {...props} />;
}

function DrawerBackdrop(props: ComponentProps<typeof HeroDrawer.Backdrop>) {
  return <HeroDrawer.Backdrop {...props} />;
}

function DrawerContent(props: ComponentProps<typeof HeroDrawer.Content>) {
  return <HeroDrawer.Content {...props} />;
}

function DrawerDialog(props: ComponentProps<typeof HeroDrawer.Dialog>) {
  return <HeroDrawer.Dialog {...props} />;
}

function DrawerHeader(props: ComponentProps<typeof HeroDrawer.Header>) {
  return <HeroDrawer.Header {...props} />;
}

function DrawerHeading(props: ComponentProps<typeof HeroDrawer.Heading>) {
  return <HeroDrawer.Heading {...props} />;
}

function DrawerBody(props: ComponentProps<typeof HeroDrawer.Body>) {
  return <HeroDrawer.Body {...props} />;
}

function DrawerFooter(props: ComponentProps<typeof HeroDrawer.Footer>) {
  return <HeroDrawer.Footer {...props} />;
}

function DrawerCloseTrigger(
  props: ComponentProps<typeof HeroDrawer.CloseTrigger>,
) {
  return <HeroDrawer.CloseTrigger {...props} />;
}

export const Drawer = Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Backdrop: DrawerBackdrop,
  Content: DrawerContent,
  Dialog: DrawerDialog,
  Header: DrawerHeader,
  Heading: DrawerHeading,
  Body: DrawerBody,
  Footer: DrawerFooter,
  CloseTrigger: DrawerCloseTrigger,
});

export { useOverlayState };
export type { DrawerRootProps as DrawerProps };
