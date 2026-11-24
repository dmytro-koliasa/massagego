import type { Portal } from "@/lib/portals";

export type AuthMode = "login" | "register" | "forgot";

export type AuthPanelProps = {
  portal?: Portal;
  /** @deprecated Use `portal` */
  role?: Portal;
  callbackUrl?: string;
};