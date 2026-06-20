import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  layout?: "lobby" | "game" | "centered";
}

export function HostViewport({ children, className, layout = "game" }: Props) {
  return (
    <div
      className={`host-viewport host-viewport--${layout}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
