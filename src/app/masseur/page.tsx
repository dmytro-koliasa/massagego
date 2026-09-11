import { Suspense } from "react";
import MasseurEntryPage from "./masseur-entry";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center bg-background px-[15px] py-10">
          <p className="text-sm text-muted">Loading…</p>
        </main>
      }
    >
      <MasseurEntryPage />
    </Suspense>
  );
}
