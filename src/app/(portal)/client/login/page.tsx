import { PortalLoginClient } from "@/components/portal-login-client";
import { PortalLoginShell } from "@/components/portal-login-shell";

export default function ClientLoginPage() {
  return (
    <PortalLoginShell>
      <PortalLoginClient portal="client" />
    </PortalLoginShell>
  );
}
