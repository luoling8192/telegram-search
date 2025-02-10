import { setGlobalLogLevel, LogLevel, setGlobalFormat, Format, useLogg } from '@guiiai/logg';
import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError, z } from 'zod';
import { observable } from '@trpc/server/observable';

function initLogger() {
  setGlobalLogLevel(LogLevel.Debug);
  setGlobalFormat(Format.Pretty);
  const logger = useLogg("logger").useGlobalConfig();
  logger.log("Logger initialized");
}
function useLogger() {
  const stack = new Error("logger").stack;
  const caller = stack?.split("\n")[2];
  const match = caller?.match(/\/([^/]+)\/([^/]+?)\.[jt]s/);
  const dirName = match?.[1] || "unknown";
  const fileName = match?.[2] || "unknown";
  return useLogg(`${dirName}/${fileName}`).useGlobalConfig();
}

const t = initTRPC.context().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null
      }
    };
  }
});
const router = t.router;
const publicProcedure = t.procedure;
const middleware = t.middleware;
const errorMiddleware = middleware(async ({ path, type, next }) => {
  try {
    return await next();
  } catch (error) {
    console.error(`Error in ${type} '${path}':`, error);
    throw error;
  }
});

const MessageTypeEnum = z.enum(["text", "photo", "video", "document", "sticker", "other"]);
const ChatTypeEnum = z.enum(["user", "group", "channel", "saved"]);
const MessageSchema = z.object({
  id: z.number(),
  chatId: z.number(),
  type: MessageTypeEnum,
  content: z.string().nullable(),
  mediaInfo: z.object({
    type: z.string(),
    mimeType: z.string().optional(),
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    duration: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    localPath: z.string().optional()
  }).nullable(),
  fromId: z.number().nullable(),
  replyToId: z.number().nullable(),
  forwardFromChatId: z.number().nullable(),
  forwardFromMessageId: z.number().nullable(),
  views: z.number().nullable(),
  forwards: z.number().nullable(),
  createdAt: z.date()
});
const ChatSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: ChatTypeEnum,
  lastMessage: z.string().nullable(),
  lastMessageDate: z.date().nullable(),
  lastSyncTime: z.date(),
  messageCount: z.number(),
  folderId: z.number().nullable()
});
const FolderSchema = z.object({
  id: z.number(),
  title: z.string(),
  emoji: z.string().nullable(),
  lastSyncTime: z.date()
});
const SearchOptionsSchema = z.object({
  query: z.string(),
  chatId: z.number().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  messageTypes: z.array(MessageTypeEnum).optional()
});

const checkContext = (ctx) => {
  if (!ctx.telegram) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Telegram client not initialized"
    });
  }
  if (!ctx.db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Database not initialized"
    });
  }
};
const appRouter = router({
  // Chat related routes
  getChats: publicProcedure.use(errorMiddleware).output(z.array(ChatSchema)).query(async ({ ctx }) => {
    checkContext(ctx);
    return await ctx.telegram.getChats();
  }),
  // Folder related routes
  getFolders: publicProcedure.use(errorMiddleware).output(z.array(FolderSchema)).query(async ({ ctx }) => {
    checkContext(ctx);
    return await ctx.telegram.getFolders();
  }),
  // Message related routes
  getMessages: publicProcedure.use(errorMiddleware).input(z.object({
    chatId: z.number(),
    limit: z.number().optional(),
    offset: z.number().optional()
  })).output(z.array(MessageSchema)).query(async ({ ctx, input }) => {
    checkContext(ctx);
    const messages = [];
    for await (const message of ctx.telegram.getMessages(input.chatId, input.limit, {
      skipMedia: true
      // Skip media download for performance
    })) {
      messages.push(message);
      if (messages.length >= (input.limit || 100)) {
        break;
      }
    }
    return messages;
  }),
  // Search related routes
  search: publicProcedure.use(errorMiddleware).input(SearchOptionsSchema).output(z.array(MessageSchema)).query(async ({ ctx, input }) => {
    checkContext(ctx);
    const messages = await ctx.db.searchMessages({
      query: input.query,
      chatId: input.chatId,
      limit: input.limit || 100,
      offset: input.offset || 0,
      startTime: input.startTime,
      endTime: input.endTime,
      messageTypes: input.messageTypes
    });
    return messages;
  }),
  // Watch messages
  watchMessages: publicProcedure.use(errorMiddleware).input(z.object({
    chatId: z.number().optional()
  })).subscription(({ ctx, input }) => {
    checkContext(ctx);
    return observable((emit) => {
      const callback = async (message) => {
        if (input.chatId && message.chatId !== input.chatId) {
          return;
        }
        emit.next(message);
      };
      ctx.telegram.onMessage(callback);
      return () => {
        ctx.telegram.onMessage(() => {
        });
      };
    });
  })
});

export { ChatSchema, ChatTypeEnum, FolderSchema, MessageSchema, MessageTypeEnum, SearchOptionsSchema, appRouter, initLogger, useLogger };
