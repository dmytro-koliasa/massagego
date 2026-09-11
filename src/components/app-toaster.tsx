"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={3500}
      toastOptions={{
        classNames: {
          toast: "font-sans",
        },
      }}
    />
  );
}
