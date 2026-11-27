import { PortalLoginClient } from "@/components/portal-login-client";
import { PortalLoginShell } from "@/components/portal-login-shell";

export default function MasseurLoginPage() {
  return (
    <PortalLoginShell>
      <PortalLoginClient portal="masseur" />
    </PortalLoginShell>
  );
}
