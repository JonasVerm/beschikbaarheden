import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Check if any super admin exists
export const hasSuperAdmin = query({
  args: {},
  handler: async (ctx) => {
    const existingSuperAdmin = await ctx.db
      .query("userRoles")
      .filter((q) => q.eq(q.field("role"), "superadmin"))
      .first();
    
    if (existingSuperAdmin) {
      return true;
    }
    
    // Also check if there's a pending super admin setup
    const pendingSetup = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "pending_superadmin_email"))
      .first();
    
    return !!pendingSetup;
  },
});

// Function to create the first super admin (for initial setup)
export const createFirstSuperAdmin = mutation({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if any super admin already exists
    const existingSuperAdmin = await ctx.db
      .query("userRoles")
      .filter((q) => q.eq(q.field("role"), "superadmin"))
      .first();
    
    if (existingSuperAdmin) {
      throw new Error("Er bestaat al een super admin");
    }
    
    // Check if there's already a pending super admin setup
    const existingSetup = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "pending_superadmin_email"))
      .first();
    
    if (existingSetup) {
      throw new Error("Er is al een super admin setup in behandeling");
    }
    
    // Store the email for the pending super admin (don't create user record yet)
    await ctx.db.insert("organizationSettings", {
      key: "pending_superadmin_email",
      value: args.email,
    });
    
    await ctx.db.insert("organizationSettings", {
      key: "pending_superadmin_name",
      value: args.name,
    });
    
    return { success: true, email: args.email };
  },
});
