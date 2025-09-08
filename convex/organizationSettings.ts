import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const getPublicPassword = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "public_password"))
      .first();
    
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
      .first();
    
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
      .first();
    
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
      .first();
    
    return !!(setting && setting.value);
  },
});

export const getBrandingSettings = query({
  args: {},
  handler: async (ctx) => {
    const [siteName, primaryColor, secondaryColor, logoId] = await Promise.all([
      ctx.db.query("organizationSettings").withIndex("by_key", (q) => q.eq("key", "site_name")).first(),
      ctx.db.query("organizationSettings").withIndex("by_key", (q) => q.eq("key", "primary_color")).first(),
      ctx.db.query("organizationSettings").withIndex("by_key", (q) => q.eq("key", "secondary_color")).first(),
      ctx.db.query("organizationSettings").withIndex("by_key", (q) => q.eq("key", "logo_id")).first(),
    ]);

    return {
      siteName: siteName?.value || "Capitole Gent",
      primaryColor: primaryColor?.value || "#161616",
      secondaryColor: secondaryColor?.value || "#FAE682",
      logoId: logoId?.value || null,
    };
  },
});

export const setSiteName = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const existingSetting = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "site_name"))
      .first();
    
    if (existingSetting) {
      await ctx.db.patch(existingSetting._id, {
        value: args.name,
      });
    } else {
      await ctx.db.insert("organizationSettings", {
        key: "site_name",
        value: args.name,
      });
    }
    
    return { success: true };
  },
});
