import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

// Initialize default groups
export const initializeDefaultGroups = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    
    const existingGroups = await ctx.db.query("groups").collect();
    if (existingGroups.length > 0) {
      return { message: "Groups already exist" };
    }
    
    const defaultGroups = [
      { 
        name: "front-team", 
        displayName: "Front Team", 
        description: "Front of house medewerkers", 
        color: "#3B82F6", 
        isActive: true,
      },
      { 
        name: "bar-team", 
        displayName: "Bar Team", 
        description: "Bar medewerkers", 
        color: "#10B981", 
        isActive: true
      },
      { 
        name: "tech-team", 
        displayName: "Tech Team", 
        description: "Technische medewerkers", 
        color: "#8B5CF6", 
        isActive: true
      },
    ];
    
    for (const group of defaultGroups) {
      await ctx.db.insert("groups", group);
    }
    
    return { message: "Default groups created" };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("groups").collect();
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("groups").filter((q) => q.eq(q.field("isActive"), true)).collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Check if group name already exists
    const existing = await ctx.db
      .query("groups")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    
    if (existing) {
      throw new Error("Een groep met deze naam bestaat al");
    }
    
    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      displayName: args.displayName,
      description: args.description,
      color: args.color || "#6B7280",
      isActive: true,
    });
    
    return groupId;
  },
});

export const update = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Groep niet gevonden");
    }
    
    // If name is changing, check if new name already exists
    if (group.name !== args.name) {
      const existing = await ctx.db
        .query("groups")
        .withIndex("by_name", (q) => q.eq("name", args.name))
        .unique();
      
      if (existing) {
        throw new Error("Een groep met deze naam bestaat al");
      }
    }
    
    await ctx.db.patch(args.groupId, {
      name: args.name,
      displayName: args.displayName,
      description: args.description,
      color: args.color || "#6B7280",
    });
    
    return { success: true };
  },
});

export const toggleActive = mutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Groep niet gevonden");
    }
    
    await ctx.db.patch(args.groupId, {
      isActive: !group.isActive,
    });
    
    return { success: true };
  },
});

export const remove = mutation({
  args: {
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Groep niet gevonden");
    }
    
    // Check if group is being used by people
    const peopleInGroup = await ctx.db
      .query("people")
      .filter((q) => q.eq(q.field("groupId"), args.groupId))
      .collect();
    
    if (peopleInGroup.length > 0) {
      throw new Error("Kan groep niet verwijderen: wordt nog gebruikt door medewerkers");
    }
    
    // Remove the group
    await ctx.db.delete(args.groupId);
    
    return { success: true };
  },
});

export const getPeopleByGroup = query({
  args: {},
  handler: async (ctx) => {
    const people = await ctx.db.query("people").collect();
    const groups = await ctx.db.query("groups").filter((q) => q.eq(q.field("isActive"), true)).collect();
    
    const result = [];
    
    // Add groups with their people
    for (const group of groups) {
      const groupPeople = people.filter(person => person.groupId === group._id);
      result.push({
        group,
        people: groupPeople,
      });
    }
    
    // Add ungrouped people
    const ungroupedPeople = people.filter(person => !person.groupId);
    if (ungroupedPeople.length > 0) {
      result.push({
        group: {
          _id: null,
          name: "ungrouped",
          displayName: "Geen Groep",
          description: "Medewerkers zonder groep",
          color: "#9CA3AF",
          isActive: true,
        },
        people: ungroupedPeople,
      });
    }
    
    return result;
  },
});
