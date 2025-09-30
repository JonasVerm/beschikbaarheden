import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Import bcrypt for secure password hashing
const bcrypt = require('bcryptjs');

// Hash a password securely using bcrypt
function hashPassword(password: string): string {
  const saltRounds = 12; // Higher number = more secure but slower
  return bcrypt.hashSync(password, saltRounds);
}

// Generate a random temporary password
function generateTempPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to check admin access
async function checkAdminAccess(ctx: any, userId: string) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  // Check if user has admin role
  const userRole = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  
  if (!userRole) {
    throw new Error("Not authorized - admin access required");
  }
  
  return { user, userRole };
}

export const add = mutation({
  args: {
    name: v.string(),
    roles: v.array(v.string()),
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await checkAdminAccess(ctx, userId);
    
    const tempPassword = generateTempPassword();
    const hashedPassword = hashPassword(tempPassword);

    const personId = await ctx.db.insert("people", {
      name: args.name,
      roles: args.roles,
      groupId: args.groupId,
      isActive: true,
      password: hashedPassword,
      mustChangePassword: true,
      lastPasswordChange: Date.now(),
      excludeFromAutoAssignment: false, // Default to false for new people
    });

    return personId;
  },
});

export const update = mutation({
  args: {
    id: v.id("people"),
    name: v.string(),
    roles: v.array(v.string()),
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await checkAdminAccess(ctx, userId);

    await ctx.db.patch(args.id, {
      name: args.name,
      roles: args.roles,
      groupId: args.groupId,
    });
  },
});

export const toggleAutoAssignmentExclusion = mutation({
  args: {
    id: v.id("people"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await checkAdminAccess(ctx, userId);

    const person = await ctx.db.get(args.id);
    if (!person) {
      throw new Error("Person not found");
    }

    await ctx.db.patch(args.id, {
      excludeFromAutoAssignment: !person.excludeFromAutoAssignment,
    });

    return {
      excluded: !person.excludeFromAutoAssignment,
      name: person.name,
    };
  },
});

export const remove = mutation({
  args: {
    id: v.id("people"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await checkAdminAccess(ctx, userId);

    await ctx.db.patch(args.id, {
      isActive: false,
    });
  },
});

export const list = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("people")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("people") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const resetPassword = mutation({
  args: {
    id: v.id("people"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await checkAdminAccess(ctx, userId);

    const person = await ctx.db.get(args.id);
    if (!person) {
      throw new Error("Person not found");
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = hashPassword(tempPassword);

    await ctx.db.patch(args.id, {
      password: hashedPassword,
      mustChangePassword: true,
      lastPasswordChange: Date.now(),
    });

    return {
      tempPassword,
      name: person.name,
    };
  },
});

// Internal query for use by actions
export const getByIdInternal = internalQuery({
  args: { id: v.id("people") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal query to get all active people
export const getAllActivePeople = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("people")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});
