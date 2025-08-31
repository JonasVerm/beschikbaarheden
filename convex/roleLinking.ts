import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Function to link authenticated user to existing admin record
export const linkUserToAdminRole = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    
    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      return null;
    }
    
    // Check if user already has a role
    const existingRole = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    
    if (existingRole) {
      return existingRole.role;
    }
    
    // Check if this user's email matches the pending super admin
    const pendingEmail = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q) => q.eq("key", "pending_superadmin_email"))
      .unique();
    
    if (pendingEmail && pendingEmail.value === user.email) {
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
      
      return "superadmin";
    }
    
    // Look for an existing admin record with this email (legacy support)
    const existingAdminRecord = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", user.email))
      .filter((q) => q.neq(q.field("_id"), userId))
      .first();
    
    if (existingAdminRecord) {
      // Check if this admin record has a role
      const adminRole = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", existingAdminRecord._id))
        .unique();
      
      if (adminRole) {
        // Transfer the role to the authenticated user
        await ctx.db.insert("userRoles", {
          userId: userId,
          role: adminRole.role,
        });
        
        // Clean up old records
        await ctx.db.delete(adminRole._id);
        await ctx.db.delete(existingAdminRecord._id);
        
        return adminRole.role;
      }
    }
    
    return null;
  },
});
