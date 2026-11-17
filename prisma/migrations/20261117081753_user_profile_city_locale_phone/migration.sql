-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cityCountryCode" TEXT,
ADD COLUMN     "cityLat" DOUBLE PRECISION,
ADD COLUMN     "cityLon" DOUBLE PRECISION,
ADD COLUMN     "cityNameEn" TEXT,
ADD COLUMN     "cityNameUk" TEXT,
ADD COLUMN     "cityPlaceId" TEXT,
ADD COLUMN     "emailVerifyLastSentAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifySendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailVerifySendWindowStart" TIMESTAMP(3),
ADD COLUMN     "preferredLocale" TEXT NOT NULL DEFAULT 'en';
