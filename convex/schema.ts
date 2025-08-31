import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // New groups table
  groups: defineTable({
    name: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()), // Hex color for visual distinction
    isActive: v.boolean(),
  }).index("by_name", ["name"]),
  
  // New roles table to manage role definitions
  roles: defineTable({
    name: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  }).index("by_name", ["name"]),
  
  people: defineTable({
    name: v.string(),
    roles: v.array(v.string()), // Now uses dynamic role names
    groupId: v.optional(v.id("groups")), // New field for group assignment
  }),
  
  // Extend users table to add admin roles
  userRoles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("superadmin")),
  }).index("by_user", ["userId"]),
  
  // Organization settings table
  organizationSettings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
  
  shows: defineTable({
    name: v.string(),
    date: v.string(), // YYYY-MM-DD format
    startTime: v.string(), // HH:MM format
    openDate: v.optional(v.string()), // YYYY-MM-DD format when availability opens
    closeDate: v.optional(v.string()), // YYYY-MM-DD format when availability closes
    roles: v.optional(v.record(v.string(), v.number())), // Dynamic roles with counts
    // Legacy fields for backward compatibility
    openTime: v.optional(v.number()),
    closeTime: v.optional(v.number()),
  }).index("by_date", ["date"]),
  
  shifts: defineTable({
    showId: v.id("shows"),
    role: v.string(), // Now uses dynamic role names
    personId: v.optional(v.id("people")), // assigned person
    peopleNeeded: v.optional(v.number()), // how many people are needed for this role
    position: v.optional(v.number()), // position number (1, 2, 3, etc.) for multiple people in same role
    startTime: v.optional(v.string()), // HH:MM format - when this shift starts
  }).index("by_show", ["showId"]),
  
  availability: defineTable({
    personId: v.id("people"),
    shiftId: v.id("shifts"),
    available: v.boolean(),
  }).index("by_person_and_shift", ["personId", "shiftId"]),
  
  roleConfigurations: defineTable({
    role: v.string(), // Now uses dynamic role names
    hoursBeforeShow: v.number(), // hours before show start time
  }).index("by_role", ["role"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
