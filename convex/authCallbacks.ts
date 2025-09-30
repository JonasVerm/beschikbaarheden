import { Id } from "./_generated/dataModel";

// Helper function to handle super admin setup during user registration
export async function handleSuperAdminSetup(
  ctx: any, 
  existingUserId: Id<"users"> | null, 
  userId: Id<"users">
) {
  try {
    console.log("Auth callback triggered", { existingUserId, userId });
    
    // If this is a new user, check if they should be allowed to register
    if (!existingUserId) {
      const user = await ctx.db.get(userId);
      
      if (!user || !user.email) {
        console.log("No user or email found");
        return;
      }

      console.log("Checking registration permissions for:", user.email);

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
        return; // Allow registration
      }

      // Check if this email was pre-approved by a super admin
      const existingAdminRecord = await ctx.db
        .query("users")
        .withIndex("email", (q: any) => q.eq("email", user.email))
        .filter((q: any) => q.neq(q.field("_id"), userId))
        .first();

      if (existingAdminRecord) {
        console.log("Found existing admin record for email:", user.email);
        
        // Check if this admin record has a role
        const adminRole = await ctx.db
          .query("userRoles")
          .withIndex("by_user", (q: any) => q.eq("userId", existingAdminRecord._id))
          .first();
        
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
          
          console.log("Role transferred successfully");
          return; // Allow registration
        }
      }

      // If we get here, this email is not authorized to register
      console.log("Unauthorized registration attempt for:", user.email);
      
      // Delete the unauthorized user account
      await ctx.db.delete(userId);
      
      throw new Error("Dit e-mailadres is niet geautoriseerd om te registreren. Neem contact op met een beheerder.");
    }
  } catch (error) {
    console.error("Error in handleSuperAdminSetup:", error);
    // Re-throw the error to prevent unauthorized registration
    throw error;
  }
}
