import * as _guiiai_logg from '@guiiai/logg';
import { useLogg } from '@guiiai/logg';
import * as _trpc_server from '@trpc/server';
import * as _trpc_server_dist_unstable_core_do_not_import from '@trpc/server/dist/unstable-core-do-not-import';
import { z } from 'zod';

type Logger = ReturnType<typeof useLogg>;
declare function initLogger(): void;
/**
 * Get logger instance with directory name and filename
 * @returns logger instance configured with "directoryName/filename"
 */
declare function useLogger(): _guiiai_logg.Logg;

declare const appRouter: _trpc_server_dist_unstable_core_do_not_import.BuiltRouter<{
    ctx: any;
    meta: object;
    errorShape: {
        data: {
            zodError: z.typeToFlattenedError<any, string> | null;
            code: _trpc_server_dist_unstable_core_do_not_import.TRPC_ERROR_CODE_KEY;
            httpStatus: number;
            path?: string;
            stack?: string;
        };
        message: string;
        code: _trpc_server_dist_unstable_core_do_not_import.TRPC_ERROR_CODE_NUMBER;
    };
    transformer: false;
}, _trpc_server_dist_unstable_core_do_not_import.DecorateCreateRouterOptions<{
    getChats: _trpc_server.TRPCQueryProcedure<{
        input: void;
        output: {
            type: "user" | "group" | "channel" | "saved";
            id: number;
            name: string;
            lastMessage: string | null;
            lastMessageDate: Date | null;
            lastSyncTime: Date;
            messageCount: number;
            folderId: number | null;
        }[];
    }>;
    getFolders: _trpc_server.TRPCQueryProcedure<{
        input: void;
        output: {
            id: number;
            lastSyncTime: Date;
            title: string;
            emoji: string | null;
        }[];
    }>;
    getMessages: _trpc_server.TRPCQueryProcedure<{
        input: {
            chatId: number;
            limit?: number | undefined;
            offset?: number | undefined;
        };
        output: {
            type: "text" | "photo" | "video" | "document" | "sticker" | "other";
            id: number;
            chatId: number;
            content: string | null;
            mediaInfo: {
                type: string;
                mimeType?: string | undefined;
                fileName?: string | undefined;
                fileSize?: number | undefined;
                duration?: number | undefined;
                width?: number | undefined;
                height?: number | undefined;
                localPath?: string | undefined;
            } | null;
            fromId: number | null;
            replyToId: number | null;
            forwardFromChatId: number | null;
            forwardFromMessageId: number | null;
            views: number | null;
            forwards: number | null;
            createdAt: Date;
        }[];
    }>;
    search: _trpc_server.TRPCQueryProcedure<{
        input: {
            query: string;
            chatId?: number | undefined;
            limit?: number | undefined;
            offset?: number | undefined;
            startTime?: Date | undefined;
            endTime?: Date | undefined;
            messageTypes?: ("text" | "photo" | "video" | "document" | "sticker" | "other")[] | undefined;
        };
        output: {
            type: "text" | "photo" | "video" | "document" | "sticker" | "other";
            id: number;
            chatId: number;
            content: string | null;
            mediaInfo: {
                type: string;
                mimeType?: string | undefined;
                fileName?: string | undefined;
                fileSize?: number | undefined;
                duration?: number | undefined;
                width?: number | undefined;
                height?: number | undefined;
                localPath?: string | undefined;
            } | null;
            fromId: number | null;
            replyToId: number | null;
            forwardFromChatId: number | null;
            forwardFromMessageId: number | null;
            views: number | null;
            forwards: number | null;
            createdAt: Date;
        }[];
    }>;
    watchMessages: _trpc_server_dist_unstable_core_do_not_import.LegacyObservableSubscriptionProcedure<{
        input: {
            chatId?: number | undefined;
        };
        output: any;
    }>;
}>>;
type AppRouter = typeof appRouter;

declare const MessageTypeEnum: z.ZodEnum<["text", "photo", "video", "document", "sticker", "other"]>;
type MessageType = z.infer<typeof MessageTypeEnum>;
declare const ChatTypeEnum: z.ZodEnum<["user", "group", "channel", "saved"]>;
type ChatType = z.infer<typeof ChatTypeEnum>;
declare const MessageSchema: z.ZodObject<{
    id: z.ZodNumber;
    chatId: z.ZodNumber;
    type: z.ZodEnum<["text", "photo", "video", "document", "sticker", "other"]>;
    content: z.ZodNullable<z.ZodString>;
    mediaInfo: z.ZodNullable<z.ZodObject<{
        type: z.ZodString;
        mimeType: z.ZodOptional<z.ZodString>;
        fileName: z.ZodOptional<z.ZodString>;
        fileSize: z.ZodOptional<z.ZodNumber>;
        duration: z.ZodOptional<z.ZodNumber>;
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        localPath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        mimeType?: string | undefined;
        fileName?: string | undefined;
        fileSize?: number | undefined;
        duration?: number | undefined;
        width?: number | undefined;
        height?: number | undefined;
        localPath?: string | undefined;
    }, {
        type: string;
        mimeType?: string | undefined;
        fileName?: string | undefined;
        fileSize?: number | undefined;
        duration?: number | undefined;
        width?: number | undefined;
        height?: number | undefined;
        localPath?: string | undefined;
    }>>;
    fromId: z.ZodNullable<z.ZodNumber>;
    replyToId: z.ZodNullable<z.ZodNumber>;
    forwardFromChatId: z.ZodNullable<z.ZodNumber>;
    forwardFromMessageId: z.ZodNullable<z.ZodNumber>;
    views: z.ZodNullable<z.ZodNumber>;
    forwards: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    type: "text" | "photo" | "video" | "document" | "sticker" | "other";
    id: number;
    chatId: number;
    content: string | null;
    mediaInfo: {
        type: string;
        mimeType?: string | undefined;
        fileName?: string | undefined;
        fileSize?: number | undefined;
        duration?: number | undefined;
        width?: number | undefined;
        height?: number | undefined;
        localPath?: string | undefined;
    } | null;
    fromId: number | null;
    replyToId: number | null;
    forwardFromChatId: number | null;
    forwardFromMessageId: number | null;
    views: number | null;
    forwards: number | null;
    createdAt: Date;
}, {
    type: "text" | "photo" | "video" | "document" | "sticker" | "other";
    id: number;
    chatId: number;
    content: string | null;
    mediaInfo: {
        type: string;
        mimeType?: string | undefined;
        fileName?: string | undefined;
        fileSize?: number | undefined;
        duration?: number | undefined;
        width?: number | undefined;
        height?: number | undefined;
        localPath?: string | undefined;
    } | null;
    fromId: number | null;
    replyToId: number | null;
    forwardFromChatId: number | null;
    forwardFromMessageId: number | null;
    views: number | null;
    forwards: number | null;
    createdAt: Date;
}>;
declare const ChatSchema: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    type: z.ZodEnum<["user", "group", "channel", "saved"]>;
    lastMessage: z.ZodNullable<z.ZodString>;
    lastMessageDate: z.ZodNullable<z.ZodDate>;
    lastSyncTime: z.ZodDate;
    messageCount: z.ZodNumber;
    folderId: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "user" | "group" | "channel" | "saved";
    id: number;
    name: string;
    lastMessage: string | null;
    lastMessageDate: Date | null;
    lastSyncTime: Date;
    messageCount: number;
    folderId: number | null;
}, {
    type: "user" | "group" | "channel" | "saved";
    id: number;
    name: string;
    lastMessage: string | null;
    lastMessageDate: Date | null;
    lastSyncTime: Date;
    messageCount: number;
    folderId: number | null;
}>;
declare const FolderSchema: z.ZodObject<{
    id: z.ZodNumber;
    title: z.ZodString;
    emoji: z.ZodNullable<z.ZodString>;
    lastSyncTime: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: number;
    lastSyncTime: Date;
    title: string;
    emoji: string | null;
}, {
    id: number;
    lastSyncTime: Date;
    title: string;
    emoji: string | null;
}>;
declare const SearchOptionsSchema: z.ZodObject<{
    query: z.ZodString;
    chatId: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
    startTime: z.ZodOptional<z.ZodDate>;
    endTime: z.ZodOptional<z.ZodDate>;
    messageTypes: z.ZodOptional<z.ZodArray<z.ZodEnum<["text", "photo", "video", "document", "sticker", "other"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    query: string;
    chatId?: number | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
    messageTypes?: ("text" | "photo" | "video" | "document" | "sticker" | "other")[] | undefined;
}, {
    query: string;
    chatId?: number | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
    messageTypes?: ("text" | "photo" | "video" | "document" | "sticker" | "other")[] | undefined;
}>;
type Message = z.infer<typeof MessageSchema>;
type Chat = z.infer<typeof ChatSchema>;
type Folder = z.infer<typeof FolderSchema>;
type SearchOptions = z.infer<typeof SearchOptionsSchema>;

export { type AppRouter, type Chat, ChatSchema, type ChatType, ChatTypeEnum, type Folder, FolderSchema, type Logger, type Message, MessageSchema, type MessageType, MessageTypeEnum, type SearchOptions, SearchOptionsSchema, appRouter, initLogger, useLogger };
