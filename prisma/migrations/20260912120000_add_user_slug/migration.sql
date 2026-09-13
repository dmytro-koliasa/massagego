-- AlterTable
ALTER TABLE "User" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_slug_key" ON "User"("slug");
