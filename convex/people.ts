import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const people = await ctx.db.query("people").collect();
    
    // Enrich with group information
    const enrichedPeople = [];
    for (const person of people) {
      let group = null;
      if (person.groupId) {
        group = await ctx.db.get(person.groupId);
      }
      enrichedPeople.push({
        ...person,
        group,
      });
    }
    
    return enrichedPeople;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    roles: v.array(v.string()),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Validate that all roles exist and are active
    const activeRoles = await ctx.db.query("roles").filter((q) => q.eq(q.field("isActive"), true)).collect();
    const activeRoleNames = activeRoles.map(role => role.name);
    
    for (const roleName of args.roles) {
      if (!activeRoleNames.includes(roleName)) {
        throw new Error(`Functie '${roleName}' bestaat niet of is niet actief`);
      }
    }
    
    // Validate group if provided
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group || !group.isActive) {
        throw new Error("Groep bestaat niet of is niet actief");
      }
    }
    
    return await ctx.db.insert("people", {
      name: args.name,
      roles: args.roles,
      groupId: args.groupId,
    });
  },
});

export const update = mutation({
  args: {
    personId: v.id("people"),
    name: v.string(),
    roles: v.array(v.string()),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Validate that all roles exist and are active
    const activeRoles = await ctx.db.query("roles").filter((q) => q.eq(q.field("isActive"), true)).collect();
    const activeRoleNames = activeRoles.map(role => role.name);
    
    for (const roleName of args.roles) {
      if (!activeRoleNames.includes(roleName)) {
        throw new Error(`Functie '${roleName}' bestaat niet of is niet actief`);
      }
    }
    
    // Validate group if provided
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group || !group.isActive) {
        throw new Error("Groep bestaat niet of is niet actief");
      }
    }
    
    await ctx.db.patch(args.personId, {
      name: args.name,
      roles: args.roles,
      groupId: args.groupId,
    });
  },
});

export const remove = mutation({
  args: { personId: v.id("people") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Check if person is assigned to any shifts
    const shifts = await ctx.db
      .query("shifts")
      .filter((q) => q.eq(q.field("personId"), args.personId))
      .collect();
    
    if (shifts.length > 0) {
      throw new Error("Kan persoon niet verwijderen: is toegewezen aan diensten");
    }
    
    // Delete all availability records for this person
    const availabilities = await ctx.db
      .query("availability")
      .filter((q) => q.eq(q.field("personId"), args.personId))
      .collect();
    
    for (const availability of availabilities) {
      await ctx.db.delete(availability._id);
    }
    
    // Delete the person
    await ctx.db.delete(args.personId);
  },
});
