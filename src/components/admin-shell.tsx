import { AdminNav } from "@/components/admin-nav";

/**
 * Server-rendered admin chrome with a small client nav island (#207 AD-1).
 * Page bodies stay outside the client boundary as `children`.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col bg-background py-8">
      <div className="mx-auto w-full max-w-6xl flex-1 px-[15px]">
        <AdminNav />
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
