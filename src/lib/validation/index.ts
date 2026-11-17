export * from "@/lib/validation/common";
export * from "@/lib/validation/auth";
export * from "@/lib/validation/booking";
export * from "@/lib/validation/profile";
// notificationPreferencesPatchSchema is imported directly by API routes
// (not re-exported here) so client barrels stay free of notification modules.
