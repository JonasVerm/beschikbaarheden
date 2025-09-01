import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("roles").collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db
      .query("roles")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
    
    // Sort by order if available, otherwise by name
    return roles.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name);
    });
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Get the highest order number and add 1
    const existingRoles = await ctx.db.query("roles").collect();
    const maxOrder = Math.max(...existingRoles.map(r => r.order || 0), 0);
    
    return await ctx.db.insert("roles", {
      name: args.name,
      displayName: args.displayName,
      isActive: true,
      order: maxOrder + 1,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("roles"),
    name: v.string(),
    displayName: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    await ctx.db.patch(args.id, {
      name: args.name,
      displayName: args.displayName,
      isActive: args.isActive,
    });
  },
});

export const updateOrder = mutation({
  args: {
    roleOrders: v.array(v.object({
      id: v.id("roles"),
      order: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Update each role's order
    for (const roleOrder of args.roleOrders) {
      await ctx.db.patch(roleOrder.id, {
        order: roleOrder.order,
      });
    }
  },
});

export const remove = mutation({
  args: {
    id: v.id("roles"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Get the role first
    const role = await ctx.db.get(args.id);
    if (!role) {
      throw new Error("Role not found");
    }
    
    // Check if role is being used by any people
    const peopleWithRole = await ctx.db.query("people").collect();
    const isRoleInUse = peopleWithRole.some(person => 
      person.roles.includes(role.name)
    );
    
    if (isRoleInUse) {
      throw new Error("Cannot delete role that is assigned to people");
    }
    
    // Check if role is being used in any shifts
    const shifts = await ctx.db.query("shifts").collect();
    const isRoleInShifts = shifts.some(shift => shift.role === role.name);
    
    if (isRoleInShifts) {
      throw new Error("Cannot delete role that is used in shifts");
    }
    
    await ctx.db.delete(args.id);
  },
});
