// Helper function to handle super admin setup during user registration
export async function handleSuperAdminSetup(ctx: any, existingUserId: any, userId: any) {
  // If this is a new user, check if they should be the super admin
  if (!existingUserId) {
    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      return;
    }

    // Check if this user's email matches the pending super admin
    const pendingEmail = await ctx.db
      .query("organizationSettings")
      .withIndex("by_key", (q: any) => q.eq("key", "pending_superadmin_email"))
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
        .withIndex("by_key", (q: any) => q.eq("key", "pending_superadmin_name"))
        .unique();

      if (pendingName) {
        await ctx.db.delete(pendingName._id);
      }
    }
  }
}
