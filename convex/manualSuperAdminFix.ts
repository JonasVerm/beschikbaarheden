import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Manual function to check and fix super admin setup
export const checkAndFixSuperAdminSetup = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("Not authenticated");
      }
      
      const user = await ctx.db.get(userId);
      if (!user || !user.email) {
        throw new Error("User not found or no email");
      }
      
      console.log("Manual check for super admin setup:", user.email);
      
      // Check if user already has a role
      const existingRole = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      
      if (existingRole) {
        console.log("User already has role:", existingRole.role);
        return { success: true, message: `User already has role: ${existingRole.role}` };
      }
      
      // Check if this user's email matches the pending super admin
      const pendingEmail = await ctx.db
        .query("organizationSettings")
        .withIndex("by_key", (q) => q.eq("key", "pending_superadmin_email"))
        .unique();
      
      console.log("Pending email setting:", pendingEmail);
      
      if (pendingEmail && pendingEmail.value === user.email) {
        console.log("User matches pending super admin, creating role manually");
        
        // This user should become the super admin
        await ctx.db.insert("userRoles", {
          userId: userId,
          role: "superadmin",
        });
        
        // Clean up pending setup
        await ctx.db.delete(pendingEmail._id);
        
        const pendingName = await ctx.db
          .query("organizationSettings")
          .withIndex("by_key", (q) => q.eq("key", "pending_superadmin_name"))
          .unique();
        
        if (pendingName) {
          await ctx.db.delete(pendingName._id);
        }
        
        console.log("Super admin role created manually and pending setup cleaned up");
        return { success: true, message: "Super admin role created successfully!" };
      }
      
      return { success: false, message: "No pending super admin setup found for this email" };
    } catch (error) {
      console.error("Error in checkAndFixSuperAdminSetup:", error);
      return { success: false, message: `Error: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  },
});

// Query to check current setup status
export const checkSetupStatus = query({
  args: {},
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        return { authenticated: false };
      }
      
      const user = await ctx.db.get(userId);
      if (!user) {
        return { authenticated: false };
      }
      
      const userRole = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      
      const pendingEmail = await ctx.db
        .query("organizationSettings")
        .withIndex("by_key", (q) => q.eq("key", "pending_superadmin_email"))
        .unique();
      
      return {
        authenticated: true,
        email: user.email,
        hasRole: !!userRole,
        role: userRole?.role || null,
        pendingEmail: pendingEmail?.value || null,
        shouldBeSuperAdmin: pendingEmail?.value === user.email
      };
    } catch (error) {
      console.error("Error in checkSetupStatus:", error);
      return { authenticated: false };
    }
  },
});
