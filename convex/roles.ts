import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

// Initialize default roles
export const initializeDefaultRoles = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    const existingRoles = await ctx.db.query("roles").collect();
    if (existingRoles.length > 0) {
      return { message: "Roles already exist" };
    }
    
    const defaultRoles = [
      { name: "Bar", displayName: "Bar", description: "Bar medewerker", isActive: true },
      { name: "BA", displayName: "BA", description: "Bar assistent", isActive: true },
      { name: "FA", displayName: "FA", description: "Front assistent", isActive: true },
      { name: "MW", displayName: "MW", description: "Medewerker", isActive: true },
      { name: "FOH", displayName: "FOH", description: "Front of house", isActive: true },
    ];
    
    for (const role of defaultRoles) {
      await ctx.db.insert("roles", role);
    }
    
    return { message: "Default roles created" };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("roles").collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("roles").filter((q) => q.eq(q.field("isActive"), true)).collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Check if role name already exists
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    
    if (existing) {
      throw new Error("Een functie met deze naam bestaat al");
    }
    
    const roleId = await ctx.db.insert("roles", {
      name: args.name,
      displayName: args.displayName,
      description: args.description,
      isActive: true,
    });
    
    // Create default role configuration (2 hours before show)
    await ctx.db.insert("roleConfigurations", {
      role: args.name,
      hoursBeforeShow: 2.0,
    });
    
    return roleId;
  },
});

export const update = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const role = await ctx.db.get(args.roleId);
    if (!role) {
      throw new Error("Functie niet gevonden");
    }
    
    // If name is changing, check if new name already exists
    if (role.name !== args.name) {
      const existing = await ctx.db
        .query("roles")
        .withIndex("by_name", (q) => q.eq("name", args.name))
        .unique();
      
      if (existing) {
        throw new Error("Een functie met deze naam bestaat al");
      }
      
      // Update all references to this role
      await updateRoleReferences(ctx, role.name, args.name);
    }
    
    await ctx.db.patch(args.roleId, {
      name: args.name,
      displayName: args.displayName,
      description: args.description,
    });
    
    return { success: true };
  },
});

export const toggleActive = mutation({
  args: {
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const role = await ctx.db.get(args.roleId);
    if (!role) {
      throw new Error("Functie niet gevonden");
    }
    
    await ctx.db.patch(args.roleId, {
      isActive: !role.isActive,
    });
    
    return { success: true };
  },
});

export const remove = mutation({
  args: {
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const role = await ctx.db.get(args.roleId);
    if (!role) {
      throw new Error("Functie niet gevonden");
    }
    
    // Check if role is being used
    const allPeople = await ctx.db.query("people").collect();
    const peopleWithRole = allPeople.filter(person => person.roles.includes(role.name));
    
    const allShifts = await ctx.db.query("shifts").collect();
    const shiftsWithRole = allShifts.filter(shift => shift.role === role.name);
    
    if (peopleWithRole.length > 0 || shiftsWithRole.length > 0) {
      throw new Error("Kan functie niet verwijderen: wordt nog gebruikt door medewerkers of diensten");
    }
    
    // Remove role configuration
    const roleConfig = await ctx.db
      .query("roleConfigurations")
      .withIndex("by_role", (q) => q.eq("role", role.name))
      .unique();
    
    if (roleConfig) {
      await ctx.db.delete(roleConfig._id);
    }
    
    // Remove the role
    await ctx.db.delete(args.roleId);
    
    return { success: true };
  },
});

// Helper function to update all references when a role name changes
async function updateRoleReferences(ctx: any, oldName: string, newName: string) {
  // Update people roles
  const allPeople = await ctx.db.query("people").collect();
  const peopleWithRole = allPeople.filter((person: any) => person.roles.includes(oldName));
  
  for (const person of peopleWithRole) {
    const updatedRoles = person.roles.map((role: string) => role === oldName ? newName : role);
    await ctx.db.patch(person._id, { roles: updatedRoles });
  }
  
  // Update shifts
  const allShifts = await ctx.db.query("shifts").collect();
  const shiftsWithRole = allShifts.filter((shift: any) => shift.role === oldName);
  
  for (const shift of shiftsWithRole) {
    await ctx.db.patch(shift._id, { role: newName });
  }
  
  // Update role configuration
  const roleConfig = await ctx.db
    .query("roleConfigurations")
    .withIndex("by_role", (q: any) => q.eq("role", oldName))
    .unique();
  
  if (roleConfig) {
    await ctx.db.patch(roleConfig._id, { role: newName });
  }
  
  // Update shows roles object
  const shows = await ctx.db.query("shows").collect();
  for (const show of shows) {
    if (show.roles && show.roles[oldName] !== undefined) {
      const updatedRoles = { ...show.roles };
      updatedRoles[newName] = updatedRoles[oldName];
      delete updatedRoles[oldName];
      await ctx.db.patch(show._id, { roles: updatedRoles });
    }
  }
}
