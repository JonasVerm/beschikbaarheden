import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { handleSuperAdminSetup } from "./authCallbacks";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, Anonymous],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { existingUserId, userId }) {
      await handleSuperAdminSetup(ctx, existingUserId, userId);
    },
  },
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    
    // Get user's admin role
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    
    return {
      ...user,
      adminRole: userRole?.role || null,
    };
  },
});

export const createAdminAccount = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    role: v.union(v.literal("admin"), v.literal("superadmin")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Niet geautoriseerd");
    }
    
    // Check if current user is super admin
    const currentUserRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    
    if (!currentUserRole || currentUserRole.role !== "superadmin") {
      throw new Error("Alleen super admins kunnen nieuwe beheerders aanmaken");
    }
    
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .collect();
    
    if (existingUsers.length > 0) {
      throw new Error("Gebruiker bestaat al");
    }
    
    // Create a basic user record
    const newUserId = await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
      emailVerificationTime: Date.now(),
    });
    
    // Assign admin role
    await ctx.db.insert("userRoles", {
      userId: newUserId,
      role: args.role,
    });
    
    return newUserId;
  },
});

export const listAdmins = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Niet geautoriseerd");
    }
    
    // Check if current user is super admin (only super admins can see admin list)
    const currentUserRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    
    if (!currentUserRole || currentUserRole.role !== "superadmin") {
      throw new Error("Alleen super admins kunnen beheerders bekijken");
    }
    
    // Get all users with admin roles
    const userRoles = await ctx.db.query("userRoles").collect();
    const admins = [];
    
    for (const userRole of userRoles) {
      const user = await ctx.db.get(userRole.userId);
      if (user) {
        admins.push({
          ...user,
          adminRole: userRole.role,
        });
      }
    }
    
    return admins;
  },
});

export const removeAdmin = mutation({
  args: {
    adminId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Niet geautoriseerd");
    }
    
    // Check if current user is super admin
    const currentUserRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    
    if (!currentUserRole || currentUserRole.role !== "superadmin") {
      throw new Error("Alleen super admins kunnen beheerders verwijderen");
    }
    
    if (userId === args.adminId) {
      throw new Error("Je kunt jezelf niet verwijderen");
    }
    
    // Remove user role first
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.adminId))
      .unique();
    
    if (userRole) {
      await ctx.db.delete(userRole._id);
    }
    
    // Then remove the user
    await ctx.db.delete(args.adminId);
  },
});
