import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

// Default configurations for backward compatibility
const DEFAULT_ROLE_CONFIGS = {
  Bar: 1.5,    // 1:30 hours before
  BA: 1.75,    // 1:45 hours before  
  FA: 2.0,     // 2:00 hours before
  MW: 2.5,     // 2:30 hours before
  FOH: 4.0,    // 4:00 hours before
};

export const initializeRoleConfigurations = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    // Check if configurations already exist
    const existingConfigs = await ctx.db.query("roleConfigurations").collect();
    if (existingConfigs.length > 0) {
      return { message: "Role configurations already exist" };
    }
    
    // Get all active roles
    const roles = await ctx.db.query("roles").filter((q) => q.eq(q.field("isActive"), true)).collect();
    
    // Create configurations for all active roles
    for (const role of roles) {
      const defaultHours = DEFAULT_ROLE_CONFIGS[role.name as keyof typeof DEFAULT_ROLE_CONFIGS] || 2.0;
      await ctx.db.insert("roleConfigurations", {
        role: role.name,
        hoursBeforeShow: defaultHours,
      });
    }
    
    return { message: "Role configurations created for all active roles" };
  },
});

export const getRoleConfigurations = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    const configs = await ctx.db.query("roleConfigurations").collect();
    const roles = await ctx.db.query("roles").filter((q) => q.eq(q.field("isActive"), true)).collect();
    
    // Create a map of existing configurations
    const configMap = new Map(configs.map(config => [config.role, config]));
    
    // Return configurations for all active roles, using defaults if not configured
    return roles.map(role => {
      const existingConfig = configMap.get(role.name);
      return {
        _id: existingConfig?._id,
        role: role.name,
        displayName: role.name,
        hoursBeforeShow: existingConfig?.hoursBeforeShow !== undefined ? existingConfig.hoursBeforeShow : (DEFAULT_ROLE_CONFIGS[role.name as keyof typeof DEFAULT_ROLE_CONFIGS] || 2.0),
        isConfigured: !!existingConfig,
      };
    });
  },
});

export const updateRoleConfiguration = mutation({
  args: {
    role: v.string(),
    hoursBeforeShow: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const existingConfig = await ctx.db
      .query("roleConfigurations")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .unique();
    
    if (existingConfig) {
      await ctx.db.patch(existingConfig._id, {
        hoursBeforeShow: args.hoursBeforeShow,
      });
    } else {
      await ctx.db.insert("roleConfigurations", {
        role: args.role,
        hoursBeforeShow: args.hoursBeforeShow,
      });
    }
    
    return { success: true };
  },
});

// Helper function to calculate shift start time
export const calculateShiftStartTime = (showStartTime: string, hoursBeforeShow: number): string => {
  const [hours, minutes] = showStartTime.split(':').map(Number);
  const showDate = new Date();
  showDate.setHours(hours, minutes, 0, 0);
  
  const shiftStartDate = new Date(showDate.getTime() - (hoursBeforeShow * 60 * 60 * 1000));
  
  return `${String(shiftStartDate.getHours()).padStart(2, '0')}:${String(shiftStartDate.getMinutes()).padStart(2, '0')}`;
};
