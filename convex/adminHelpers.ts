import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Helper function to require admin access
export async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Authentication required");
  }

  const userRole = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!userRole) {
    throw new Error("Admin access required");
  }

  return { userId, role: userRole.role };
}

// Helper function to require super admin access
export async function requireSuperAdmin(ctx: any) {
  const { userId, role } = await requireAdmin(ctx);
  
  if (role !== "superadmin") {
    throw new Error("Super admin access required");
  }

  return { userId, role };
}

export const changeAdminPassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      throw new Error("Gebruiker niet gevonden");
    }

    // For this demo, we'll implement a simplified password change
    // In a production system, you'd want to integrate with Convex Auth's password change functionality
    
    try {
      // Since Convex Auth handles password management internally,
      // we'll provide a message to the user about the password change
      return { 
        success: true, 
        message: "Voor beveiliging moet je wachtwoord handmatig gewijzigd worden. Neem contact op met een super admin." 
      };
    } catch (error) {
      throw new Error("Fout bij wijzigen wachtwoord");
    }
  },
});

export const getCurrentAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    const userRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .unique();

    if (!userRole) {
      return null;
    }

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: userRole.role,
    };
  },
});
