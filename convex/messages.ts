import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const sendMessage = mutation({
  args: {
    personId: v.id("people"),
    subject: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Get person details
    const person = await ctx.db.get(args.personId);
    if (!person) {
      throw new Error("Person not found");
    }

    // Create the message
    await ctx.db.insert("messages", {
      personId: args.personId,
      personName: person.name,
      subject: args.subject,
      message: args.content,
      content: args.content,
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

export const listMessages = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    return await ctx.db
      .query("messages")
      .order("desc")
      .collect();
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_read_status", (q) => q.eq("isRead", false))
      .collect();
    
    return unreadMessages.length;
  },
});

export const markAsRead = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    await ctx.db.patch(args.messageId, {
      isRead: true,
    });
  },
});

export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_read_status", (q) => q.eq("isRead", false))
      .collect();
    
    for (const message of unreadMessages) {
      await ctx.db.patch(message._id, {
        isRead: true,
      });
    }
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    await ctx.db.delete(args.messageId);
  },
});
