ALTER TABLE "chats" RENAME COLUMN "name" TO "title";--> statement-breakpoint
ALTER TABLE "chats" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "folders" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_state" ALTER COLUMN "chat_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "username" text;