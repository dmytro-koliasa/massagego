-- CreateIndex
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_sentAt_idx" ON "NotificationOutbox"("status", "sentAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_updatedAt_idx" ON "NotificationOutbox"("status", "updatedAt");
