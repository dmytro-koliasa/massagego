/**
 * Shared server-rendered layout for portal login pages (#207 AD-4).
 * Localized copy and auth UI live in the client island (`children`).
 */
export function PortalLoginShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-1 flex-col bg-background py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-start gap-8 px-[15px] text-center">
        {children}
      </div>
    </main>
  );
}
