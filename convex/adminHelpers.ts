import { getAuthUserId } from "@convex-dev/auth/server";
import { QueryCtx, MutationCtx } from "./_generated/server";

// Helper function to check if user is admin or super admin
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Niet geautoriseerd");
  }
  
  const userRole = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  
  if (!userRole || (userRole.role !== "admin" && userRole.role !== "superadmin")) {
    throw new Error("Admin rechten vereist");
  }
  
  return { userId, role: userRole.role };
}

// Helper function to check if user is super admin
export async function requireSuperAdmin(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Niet geautoriseerd");
  }
  
  const userRole = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  
  if (!userRole || userRole.role !== "superadmin") {
    throw new Error("Super admin rechten vereist");
  }
  
  return userId;
}
