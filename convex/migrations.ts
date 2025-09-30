import { v } from "convex/values";
import { mutation } from "./_generated/server";
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

// Migration to add password fields to existing people
export const migrateExistingPeopleToPasswords = mutation({
  args: {},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    // Check if user has super admin role
    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (!userRole || userRole.role !== 'superadmin') {
      throw new Error("Not authorized - super admin access required");
    }

    // Get all people who don't have password fields yet
    const allPeople = await ctx.db.query("people").collect();
    const peopleToMigrate = allPeople.filter(person => !person.password);

    const results = [];

    for (const person of peopleToMigrate) {
      const tempPassword = generateTempPassword();
      const hashedPassword = hashPassword(tempPassword);

      await ctx.db.patch(person._id, {
        password: hashedPassword,
        mustChangePassword: true,
        lastPasswordChange: Date.now(),
      });

      results.push({
        personId: person._id,
        name: person.name,
        tempPassword,
      });
    }

    return {
      migratedCount: results.length,
      results,
    };
  },
});
