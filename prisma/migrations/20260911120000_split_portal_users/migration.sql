-- Separate client/masseur identities: portal on User, drop PortalMembership.
-- Dual-membership users are split into two User rows (same email, different portal).

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "User_new";

CREATE TABLE "User_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "nameEn" TEXT,
    "nameUk" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "descriptionEn" TEXT,
    "descriptionUk" TEXT,
    "massageTypes" TEXT NOT NULL DEFAULT '[]',
    "passwordHash" TEXT,
    "portal" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Keep original row as the first membership (prefer masseur when both exist).
INSERT INTO "User_new" (
  "id", "name", "nameEn", "nameUk", "email", "emailVerified", "image",
  "descriptionEn", "descriptionUk", "massageTypes", "passwordHash", "portal",
  "createdAt", "updatedAt"
)
SELECT
  u."id",
  u."name",
  u."nameEn",
  u."nameUk",
  u."email",
  u."emailVerified",
  u."image",
  u."descriptionEn",
  u."descriptionUk",
  u."massageTypes",
  u."passwordHash",
  COALESCE(
    (
      SELECT m."portal"
      FROM "PortalMembership" m
      WHERE m."userId" = u."id" AND m."portal" = 'masseur'
      LIMIT 1
    ),
    (
      SELECT m."portal"
      FROM "PortalMembership" m
      WHERE m."userId" = u."id"
      ORDER BY m."createdAt"
      LIMIT 1
    ),
    CASE WHEN u."role" = 'client' THEN 'client' ELSE 'masseur' END
  ),
  u."createdAt",
  u."updatedAt"
FROM "User" u;

-- Clone a second identity for the other portal membership.
INSERT INTO "User_new" (
  "id", "name", "nameEn", "nameUk", "email", "emailVerified", "image",
  "descriptionEn", "descriptionUk", "massageTypes", "passwordHash", "portal",
  "createdAt", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))),
  u."name",
  CASE WHEN m."portal" = 'masseur' THEN u."nameEn" ELSE NULL END,
  CASE WHEN m."portal" = 'masseur' THEN u."nameUk" ELSE NULL END,
  u."email",
  u."emailVerified",
  CASE WHEN m."portal" = 'masseur' THEN u."image" ELSE NULL END,
  CASE WHEN m."portal" = 'masseur' THEN u."descriptionEn" ELSE NULL END,
  CASE WHEN m."portal" = 'masseur' THEN u."descriptionUk" ELSE NULL END,
  CASE WHEN m."portal" = 'masseur' THEN u."massageTypes" ELSE '[]' END,
  u."passwordHash",
  m."portal",
  u."createdAt",
  u."updatedAt"
FROM "User" u
JOIN "PortalMembership" m ON m."userId" = u."id"
WHERE m."portal" <> (
  SELECT n."portal" FROM "User_new" n WHERE n."id" = u."id"
);

-- Point client bookings at the client-portal clone when the original user became masseur-only.
UPDATE "Booking"
SET "clientUserId" = (
  SELECT n."id"
  FROM "User_new" n
  JOIN "User" u ON u."email" = n."email"
  WHERE u."id" = "Booking"."clientUserId"
    AND n."portal" = 'client'
    AND n."id" <> "Booking"."clientUserId"
  LIMIT 1
)
WHERE "clientUserId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "User_new" n
    WHERE n."id" = "Booking"."clientUserId"
      AND n."portal" = 'masseur'
  )
  AND EXISTS (
    SELECT 1
    FROM "User_new" n2
    JOIN "User" u2 ON u2."email" = n2."email"
    WHERE u2."id" = "Booking"."clientUserId"
      AND n2."portal" = 'client'
  );

-- Point masseur-owned rows at the masseur-portal clone when the original user became client-only.
UPDATE "Booking"
SET "masseurId" = (
  SELECT n."id"
  FROM "User_new" n
  JOIN "User" u ON u."email" = n."email"
  WHERE u."id" = "Booking"."masseurId"
    AND n."portal" = 'masseur'
    AND n."id" <> "Booking"."masseurId"
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "User_new" n
  WHERE n."id" = "Booking"."masseurId"
    AND n."portal" = 'client'
)
AND EXISTS (
  SELECT 1
  FROM "User_new" n2
  JOIN "User" u2 ON u2."email" = n2."email"
  WHERE u2."id" = "Booking"."masseurId"
    AND n2."portal" = 'masseur'
);

UPDATE "AvailabilitySlot"
SET "masseurId" = (
  SELECT n."id"
  FROM "User_new" n
  JOIN "User" u ON u."email" = n."email"
  WHERE u."id" = "AvailabilitySlot"."masseurId"
    AND n."portal" = 'masseur'
    AND n."id" <> "AvailabilitySlot"."masseurId"
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "User_new" n
  WHERE n."id" = "AvailabilitySlot"."masseurId"
    AND n."portal" = 'client'
)
AND EXISTS (
  SELECT 1
  FROM "User_new" n2
  JOIN "User" u2 ON u2."email" = n2."email"
  WHERE u2."id" = "AvailabilitySlot"."masseurId"
    AND n2."portal" = 'masseur'
);

UPDATE "GalleryImage"
SET "masseurId" = (
  SELECT n."id"
  FROM "User_new" n
  JOIN "User" u ON u."email" = n."email"
  WHERE u."id" = "GalleryImage"."masseurId"
    AND n."portal" = 'masseur'
    AND n."id" <> "GalleryImage"."masseurId"
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "User_new" n
  WHERE n."id" = "GalleryImage"."masseurId"
    AND n."portal" = 'client'
)
AND EXISTS (
  SELECT 1
  FROM "User_new" n2
  JOIN "User" u2 ON u2."email" = n2."email"
  WHERE u2."id" = "GalleryImage"."masseurId"
    AND n2."portal" = 'masseur'
);

-- Allow the same Google account on both portal identities, then rebuild Account.
DROP INDEX IF EXISTS "Account_provider_providerAccountId_key";

-- Duplicate OAuth accounts onto cloned portal users (same Google may serve both).
INSERT INTO "Account" (
  "id", "userId", "type", "provider", "providerAccountId",
  "refresh_token", "access_token", "expires_at", "token_type", "scope",
  "id_token", "session_state"
)
SELECT
  lower(hex(randomblob(16))),
  clone."id",
  a."type",
  a."provider",
  a."providerAccountId",
  a."refresh_token",
  a."access_token",
  a."expires_at",
  a."token_type",
  a."scope",
  a."id_token",
  a."session_state"
FROM "Account" a
JOIN "User" u ON u."id" = a."userId"
JOIN "User_new" original ON original."id" = u."id"
JOIN "User_new" clone
  ON clone."email" = original."email"
 AND clone."portal" <> original."portal"
 AND clone."id" <> original."id";

DROP TABLE "PortalMembership";
DROP TABLE "User";
ALTER TABLE "User_new" RENAME TO "User";

CREATE UNIQUE INDEX "User_email_portal_key" ON "User"("email", "portal");
CREATE INDEX "User_portal_idx" ON "User"("portal");

CREATE TABLE "Account_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Account_new" (
  "id", "userId", "type", "provider", "providerAccountId",
  "refresh_token", "access_token", "expires_at", "token_type", "scope",
  "id_token", "session_state"
)
SELECT
  "id", "userId", "type", "provider", "providerAccountId",
  "refresh_token", "access_token", "expires_at", "token_type", "scope",
  "id_token", "session_state"
FROM "Account";

DROP TABLE "Account";
ALTER TABLE "Account_new" RENAME TO "Account";

CREATE UNIQUE INDEX "Account_provider_providerAccountId_userId_key"
  ON "Account"("provider", "providerAccountId", "userId");
CREATE INDEX "Account_provider_providerAccountId_idx"
  ON "Account"("provider", "providerAccountId");

PRAGMA foreign_keys=ON;
