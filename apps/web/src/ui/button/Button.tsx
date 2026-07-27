import {
  Button as HeroButton,
  type ButtonProps as HeroButtonProps,
} from "@heroui/react";
import type { ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isDisabled?: boolean;
  isPending?: boolean;
  isIconOnly?: boolean;
  fullWidth?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  "aria-label"?: string;
  "aria-expanded"?: boolean | "true" | "false";
  "aria-controls"?: string;
  onPress?: HeroButtonProps["onPress"];
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  isDisabled,
  isPending,
  isIconOnly,
  fullWidth,
  className,
  type = "button",
  onPress,
  ...aria
}: ButtonProps) {
  return (
    <HeroButton
      variant={variant}
      size={size}
      isDisabled={isDisabled}
      isPending={isPending}
      isIconOnly={isIconOnly}
      fullWidth={fullWidth}
      className={className}
      type={type}
      onPress={onPress}
      {...aria}
    >
      {children}
    </HeroButton>
  );
}
