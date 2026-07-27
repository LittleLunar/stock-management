import { Avatar as HeroAvatar } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";

type AvatarRootProps = ComponentProps<typeof HeroAvatar>;

export type AvatarProps = {
  children?: ReactNode;
  className?: string;
  size?: AvatarRootProps["size"];
  color?: AvatarRootProps["color"];
  variant?: AvatarRootProps["variant"];
};

function AvatarRoot({ children, className, size, color, variant }: AvatarProps) {
  return (
    <HeroAvatar className={className} size={size} color={color} variant={variant}>
      {children}
    </HeroAvatar>
  );
}

function AvatarImage(props: ComponentProps<typeof HeroAvatar.Image>) {
  return <HeroAvatar.Image {...props} />;
}

function AvatarFallback(props: ComponentProps<typeof HeroAvatar.Fallback>) {
  return <HeroAvatar.Fallback {...props} />;
}

export const Avatar = Object.assign(AvatarRoot, {
  Image: AvatarImage,
  Fallback: AvatarFallback,
});
