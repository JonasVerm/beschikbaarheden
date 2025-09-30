import { v } from "convex/values";
import { mutation, action, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Import bcrypt for secure password hashing
const bcrypt = require('bcryptjs');

// Hash a password securely using bcrypt
function hashPassword(password: string): string {
  const saltRounds = 12; // Higher number = more secure but slower
  return bcrypt.hashSync(password, saltRounds);
}

// Verify a password against a hash
function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch (error) {
    // If bcrypt fails, try the old simple hash method for backward compatibility
    return verifyOldPassword(password, hash);
  }
}

// Legacy password verification for backward compatibility
function verifyOldPassword(password: string, hash: string): boolean {
  let oldHash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    oldHash = ((oldHash << 5) - oldHash) + char;
    oldHash = oldHash & oldHash; // Convert to 32-bit integer
  }
  return Math.abs(oldHash).toString(36) === hash;
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

// Admin function to set a temporary password for a person
export const setTempPassword = mutation({
  args: {
    personId: v.id("people"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await checkAdminAccess(ctx, userId);

    const person = await ctx.db.get(args.personId);
    if (!person) {
      throw new Error("Person not found");
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = hashPassword(tempPassword);

    await ctx.db.patch(args.personId, {
      password: hashedPassword,
      mustChangePassword: true,
      lastPasswordChange: Date.now(),
    });

    return {
      tempPassword,
      message: `Temporary password set for ${person.name}`,
    };
  },
});

// Admin function to reset a person's password
export const resetPassword = mutation({
  args: {
    personId: v.id("people"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await checkAdminAccess(ctx, userId);

    const person = await ctx.db.get(args.personId);
    if (!person) {
      throw new Error("Person not found");
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = hashPassword(tempPassword);

    await ctx.db.patch(args.personId, {
      password: hashedPassword,
      mustChangePassword: true,
      lastPasswordChange: Date.now(),
    });

    return {
      tempPassword,
      message: `Password reset for ${person.name}`,
    };
  },
});

// Public mutation to verify a person's password
export const verifyPersonPassword = mutation({
  args: {
    personId: v.id("people"),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId);
    if (!person || !person.password) {
      return { valid: false, mustChangePassword: false };
    }

    const isValid = verifyPassword(args.password, person.password);
    
    return {
      valid: isValid,
      mustChangePassword: isValid ? (person.mustChangePassword || false) : false,
    };
  },
});

// Public function to change a person's password
export const changePersonPassword = mutation({
  args: {
    personId: v.id("people"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId);
    if (!person) {
      throw new Error("Person not found");
    }

    if (!person.password) {
      throw new Error("No password set for this person");
    }

    // Verify current password
    if (!verifyPassword(args.currentPassword, person.password)) {
      throw new Error("Current password is incorrect");
    }

    // Validate new password
    if (args.newPassword.length < 4) {
      throw new Error("New password must be at least 4 characters long");
    }

    const hashedNewPassword = hashPassword(args.newPassword);

    await ctx.db.patch(args.personId, {
      password: hashedNewPassword,
      mustChangePassword: false,
      lastPasswordChange: Date.now(),
    });

    return { success: true, message: "Password changed successfully" };
  },
});

// Public query to get person info (for password change form)
export const getPersonInfo = query({
  args: {
    personId: v.id("people"),
  },
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId);
    if (!person) {
      return null;
    }

    return {
      _id: person._id,
      name: person.name,
      mustChangePassword: person.mustChangePassword || false,
      lastPasswordChange: person.lastPasswordChange,
    };
  },
});
