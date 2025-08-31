import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Check if any super admin exists
export const hasSuperAdmin = query({
  handler: async (ctx) => {
    const existingSuperAdmin = await ctx.db
      .query("userRoles")
      .filter((q) => q.eq(q.field("role"), "superadmin"))
      .first();
    
    return !!existingSuperAdmin;
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
    
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .collect();
    
    if (existingUsers.length > 0) {
      throw new Error("Gebruiker bestaat al");
    }
    
    // Create the first super admin user record
    const newUserId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      emailVerificationTime: Date.now(),
    });
    
    // Assign super admin role
    await ctx.db.insert("userRoles", {
      userId: newUserId,
      role: "superadmin",
    });
    
    return newUserId;
  },
});
