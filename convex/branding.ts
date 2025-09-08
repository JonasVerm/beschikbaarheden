import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const setBrandingColors = mutation({
  args: { primaryColor: v.string(), secondaryColor: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const existingPrimary = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "primary_color"))
      .first();
    
    if (existingPrimary) {
      await ctx.db.patch(existingPrimary._id, { value: args.primaryColor });
    } else {
      await ctx.db.insert("organizationSettings", {
        key: "primary_color", value: args.primaryColor,
      });
    }
    
    const existingSecondary = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "secondary_color"))
      .first();
    
    if (existingSecondary) {
      await ctx.db.patch(existingSecondary._id, { value: args.secondaryColor });
    } else {
      await ctx.db.insert("organizationSettings", {
        key: "secondary_color", value: args.secondaryColor,
      });
    }
    
    return { success: true };
  },
});

export const setLogo = mutation({
  args: { logoId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const existingSetting = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "logo_id"))
      .first();
    
    if (existingSetting) {
      await ctx.db.patch(existingSetting._id, { value: args.logoId });
    } else {
      await ctx.db.insert("organizationSettings", {
        key: "logo_id", value: args.logoId,
      });
    }
    
    return { success: true };
  },
});

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
