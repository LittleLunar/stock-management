import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Cancel01Icon,
  Globe02Icon,
  LanguageCircleIcon,
  Menu01Icon,
  Notification03Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

const icons = {
  notification: Notification03Icon,
  menu: Menu01Icon,
  close: Cancel01Icon,
  globe: Globe02Icon,
  language: LanguageCircleIcon,
  user: UserIcon,
  chevronDown: ArrowDown01Icon,
} as const;

export type IconName = keyof typeof icons;

export type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
};

export function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 1.5,
  "aria-hidden": ariaHidden = true,
}: IconProps) {
  return (
    <HugeiconsIcon
      icon={icons[name]}
      size={size}
      color="currentColor"
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={ariaHidden}
    />
  );
}
