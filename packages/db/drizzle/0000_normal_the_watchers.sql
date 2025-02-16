CREATE TYPE "public"."chat_type" AS ENUM('user', 'group', 'channel', 'saved');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'photo', 'video', 'document', 'sticker', 'other');--> statement-breakpoint
CREATE TABLE "chats" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" bigint,
	"name" text NOT NULL,
	"type" "chat_type" NOT NULL,
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
	"id" integer,
	"title" text NOT NULL,
	"emoji" text,
	"last_sync_time" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "folders_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" bigint NOT NULL,
	"chat_id" bigint NOT NULL,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"partition_table" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" bigint,
	"last_message_id" bigint,
	"last_sync_time" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sync_state_chat_id_unique" UNIQUE("chat_id")
);
