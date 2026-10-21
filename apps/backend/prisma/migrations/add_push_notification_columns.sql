-- Add push notification columns to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pushToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "assignmentAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;
