import { Id } from "./_generated/dataModel";

// Helper function to handle super admin setup during user registration
export async function handleSuperAdminSetup(
  ctx: any, 
  existingUserId: Id<"users"> | null, 
  userId: Id<"users">
) {
  try {
    console.log("Auth callback triggered", { existingUserId, userId });
    
    // If this is a new user, check if they should be the super admin
    if (!existingUserId) {
      const user = await ctx.db.get(userId);
      
      if (!user || !user.email) {
        console.log("No user or email found");
        return;
      }

      console.log("Checking for pending super admin setup for:", user.email);

      // Check if this user's email matches the pending super admin
      const pendingEmail = await ctx.db
        .query("organizationSettings")
        .withIndex("by_key", (q: any) => q.eq("key", "pending_superadmin_email"))
        .first();

      if (pendingEmail && pendingEmail.value === user.email) {
        console.log("User matches pending super admin, creating role");
        
        // Check if role already exists to avoid duplicates
        const existingRole = await ctx.db
          .query("userRoles")
          .withIndex("by_user", (q: any) => q.eq("userId", userId))
          .first();
        
        if (!existingRole) {
          // This user should become the super admin
          await ctx.db.insert("userRoles", {
            userId: userId,
            role: "superadmin",
          });
          console.log("Super admin role created successfully");
        }

        // Clean up pending setup
        await ctx.db.delete(pendingEmail._id);

        const pendingName = await ctx.db
          .query("organizationSettings")
          .withIndex("by_key", (q: any) => q.eq("key", "pending_superadmin_name"))
          .first();

        if (pendingName) {
          await ctx.db.delete(pendingName._id);
        }
        
        console.log("Pending setup cleaned up");
      }
    }
  } catch (error) {
    console.error("Error in handleSuperAdminSetup:", error);
    // Don't throw the error to prevent auth from failing
  }
}
