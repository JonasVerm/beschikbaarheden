import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Function to link authenticated user to existing admin record
export const linkUserToAdminRole = mutation({
  args: {},
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        console.log("No user ID found in linkUserToAdminRole");
        return null;
      }
      
      const user = await ctx.db.get(userId);
      if (!user || !user.email) {
        console.log("No user or email found in linkUserToAdminRole");
        return null;
      }
      
      console.log("Linking user to admin role:", user.email);
      
      // Check if user already has a role
      const existingRole = await ctx.db
        .query("userRoles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      
      if (existingRole) {
        console.log("User already has role:", existingRole.role);
        return existingRole.role;
      }
      
      // Check if this user's email matches the pending super admin
      const pendingEmail = await ctx.db
        .query("organizationSettings")
        .withIndex("by_key", (q) => q.eq("key", "pending_superadmin_email"))
        .first();
      
      console.log("Pending email setting:", pendingEmail);
      
      if (pendingEmail && pendingEmail.value === user.email) {
        console.log("User matches pending super admin, creating role in linkUserToAdminRole");
        
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
        
        console.log("Super admin role created and pending setup cleaned up");
        return "superadmin";
      }
      
      // Look for an existing admin record with this email (legacy support)
      const existingAdminRecord = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", user.email))
        .filter((q) => q.neq(q.field("_id"), userId))
        .first();
      
      if (existingAdminRecord) {
        console.log("Found existing admin record for email:", user.email);
        
        // Check if this admin record has a role
        const adminRole = await ctx.db
          .query("userRoles")
          .withIndex("by_user", (q) => q.eq("userId", existingAdminRecord._id))
          .unique();
        
        if (adminRole) {
          console.log("Transferring role from old record:", adminRole.role);
          
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
      
      console.log("No admin role found for user:", user.email);
      return null;
    } catch (error) {
      console.error("Error in linkUserToAdminRole:", error);
      return null;
    }
  },
});
