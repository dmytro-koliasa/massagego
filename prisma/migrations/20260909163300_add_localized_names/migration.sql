-- AlterTable
ALTER TABLE "User" ADD COLUMN "nameEn" TEXT;
ALTER TABLE "User" ADD COLUMN "nameUk" TEXT;

-- Copy existing auth name into English name field
UPDATE "User" SET "nameEn" = "name" WHERE "name" IS NOT NULL AND ("nameEn" IS NULL OR "nameEn" = '');
