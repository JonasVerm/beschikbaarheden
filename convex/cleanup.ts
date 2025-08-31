import { mutation } from "./_generated/server";
import { requireSuperAdmin } from "./adminHelpers";

export const cleanupDuplicateUsers = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    
    // Get all users
    const users = await ctx.db.query("users").collect();
    const emailMap = new Map<string, any[]>();
    
    // Group users by email
    for (const user of users) {
      if (user.email) {
        if (!emailMap.has(user.email)) {
          emailMap.set(user.email, []);
        }
        emailMap.get(user.email)!.push(user);
      }
    }
    
    let duplicatesFound = 0;
    let duplicatesRemoved = 0;
    
    // Process duplicates
    for (const [email, userList] of emailMap.entries()) {
      if (userList.length > 1) {
        duplicatesFound++;
        
        // Keep the user with the most recent creation time
        userList.sort((a, b) => b._creationTime - a._creationTime);
        const keepUser = userList[0];
        const removeUsers = userList.slice(1);
        
        for (const user of removeUsers) {
          // Remove associated user roles
          const userRole = await ctx.db
            .query("userRoles")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .unique();
          
          if (userRole) {
            await ctx.db.delete(userRole._id);
          }
          
          // Remove the duplicate user
          await ctx.db.delete(user._id);
          duplicatesRemoved++;
        }
      }
    }
    
    return {
      duplicatesFound,
      duplicatesRemoved,
      message: `Found ${duplicatesFound} duplicate email groups, removed ${duplicatesRemoved} duplicate users`
    };
  },
});

export const checkDatabaseHealth = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    
    const users = await ctx.db.query("users").collect();
    const userRoles = await ctx.db.query("userRoles").collect();
    
    const emailMap = new Map<string, number>();
    let usersWithoutEmail = 0;
    
    for (const user of users) {
      if (user.email) {
        emailMap.set(user.email, (emailMap.get(user.email) || 0) + 1);
      } else {
        usersWithoutEmail++;
      }
    }
    
    const duplicateEmails = Array.from(emailMap.entries())
      .filter(([_, count]) => count > 1)
      .map(([email, count]) => ({ email, count }));
    
    // Check for orphaned user roles
    let orphanedRoles = 0;
    for (const role of userRoles) {
      const user = await ctx.db.get(role.userId);
      if (!user) {
        orphanedRoles++;
      }
    }
    
    return {
      totalUsers: users.length,
      totalUserRoles: userRoles.length,
      usersWithoutEmail,
      duplicateEmails,
      orphanedRoles,
    };
  },
});
