import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const getPublicPassword = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "public_password"))
      .unique();
    
    return setting?.value || null;
  },
});

export const setPublicPassword = mutation({
  args: {
    password: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const existingSetting = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "public_password"))
      .unique();
    
    if (existingSetting) {
      await ctx.db.patch(existingSetting._id, {
        value: args.password,
      });
    } else {
      await ctx.db.insert("organizationSettings", {
        key: "public_password",
        value: args.password,
      });
    }
    
    return { success: true };
  },
});

export const verifyPublicPassword = query({
  args: {
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "public_password"))
      .unique();
    
    // If no password is set, allow access
    if (!setting || !setting.value) {
      return true;
    }
    
    return setting.value === args.password;
  },
});

export const hasPublicPassword = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "public_password"))
      .unique();
    
    return !!(setting && setting.value);
  },
});
