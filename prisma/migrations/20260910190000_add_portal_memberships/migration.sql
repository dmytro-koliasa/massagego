-- CreateTable
CREATE TABLE "PortalMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "portal" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortalMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalMembership_userId_portal_key" ON "PortalMembership"("userId", "portal");

-- CreateIndex
CREATE INDEX "PortalMembership_portal_idx" ON "PortalMembership"("portal");

-- Backfill from legacy User.role
INSERT INTO "PortalMembership" ("id", "userId", "portal", "createdAt")
SELECT lower(hex(randomblob(16))), "id",
  CASE WHEN "role" = 'client' THEN 'client' ELSE 'masseur' END,
  CURRENT_TIMESTAMP
FROM "User";
