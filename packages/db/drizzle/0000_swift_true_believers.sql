CREATE TYPE "public"."chat_type" AS ENUM('user', 'group', 'channel', 'saved');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'photo', 'video', 'document', 'sticker', 'other');--> statement-breakpoint
CREATE TABLE "chats" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" bigint NOT NULL,
	"type" "chat_type" NOT NULL,
	"title" text NOT NULL,
	"last_message" text,
	"last_message_date" timestamp,
	"last_sync_time" timestamp DEFAULT now() NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"folder_id" integer,
	CONSTRAINT "chats_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"emoji" text,
	"last_sync_time" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "folders_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" bigint NOT NULL,
	"username" text,
	"display_name" text NOT NULL,
	"avatar" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE INDEX "user_id_idx" ON "users" USING btree ("id");--> statement-breakpoint
CREATE INDEX "user_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "user_updated_at_idx" ON "users" USING btree ("updated_at");