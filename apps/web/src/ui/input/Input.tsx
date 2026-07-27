import { Input as HeroInput } from "@heroui/react";
import type { ComponentProps } from "react";

export type InputProps = ComponentProps<typeof HeroInput>;

export function Input(props: InputProps) {
  return <HeroInput {...props} />;
}
