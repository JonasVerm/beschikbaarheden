import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Organization settings - can store key-value pairs
  organizationSettings: defineTable({
    name: v.optional(v.string()),
    adminPassword: v.optional(v.string()),
    superAdminPassword: v.optional(v.string()),
    isSetup: v.optional(v.boolean()),
    // Additional fields for key-value storage
    key: v.optional(v.string()),
    value: v.optional(v.string()),
  }).index("by_key", ["key"]),

  // User roles for admin system
  userRoles: defineTable({
    userId: v.id("users"),
    role: v.string(), // "admin" or "superadmin"
  }).index("by_user", ["userId"]),

  // Groups for organizing people
  groups: defineTable({
    name: v.string(),
    displayName: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    isActive: v.boolean(),
  }).index("by_name", ["name"]),

  // People/staff members
  people: defineTable({
    name: v.string(),
    roles: v.array(v.string()),
    groupId: v.optional(v.id("groups")),
    isActive: v.optional(v.boolean()),
  }).index("by_group", ["groupId"]),

  // Roles that people can have
  roles: defineTable({
    name: v.string(), // Short name/identifier
    displayName: v.optional(v.string()), // Long/display name
    description: v.optional(v.string()), // Legacy field
    isActive: v.boolean(),
    order: v.optional(v.number()), // For custom ordering
  }),

  // Shows/performances
  shows: defineTable({
    name: v.string(),
    date: v.string(), // YYYY-MM-DD format
    startTime: v.string(), // HH:MM format
    openDate: v.optional(v.string()), // When availability opens
    closeDate: v.optional(v.string()), // When availability closes
    openTime: v.optional(v.string()), // Time when availability opens
    closeTime: v.optional(v.string()), // Time when availability closes
    roles: v.record(v.string(), v.number()), // Role name -> number of people needed
    isActive: v.optional(v.boolean()),
  }).index("by_date", ["date"]),

  // Shifts within shows
  shifts: defineTable({
    showId: v.id("shows"),
    role: v.string(),
    startTime: v.optional(v.string()), // HH:MM format, optional override
    peopleNeeded: v.optional(v.number()),
    position: v.optional(v.number()), // For multiple people in same role
    personId: v.optional(v.id("people")), // Assigned person
  }).index("by_show", ["showId"])
    .index("by_person", ["personId"])
    .index("by_role", ["role"]),

  // Availability responses
  availability: defineTable({
    personId: v.id("people"),
    shiftId: v.id("shifts"),
    available: v.boolean(),
  }).index("by_person", ["personId"])
    .index("by_shift", ["shiftId"])
    .index("by_person_and_shift", ["personId", "shiftId"]),

  // Role configurations for shows
  roleConfigurations: defineTable({
    role: v.string(),
    name: v.optional(v.string()),
    hoursBeforeShow: v.optional(v.number()),
    roles: v.optional(v.array(v.object({
      role: v.string(),
      peopleNeeded: v.number(),
      startTime: v.optional(v.string()),
    }))),
    isDefault: v.optional(v.boolean()),
  }).index("by_role", ["role"]),

  // Messages from staff to admins
  messages: defineTable({
    personId: v.id("people"),
    personName: v.string(), // Store name for easy display
    subject: v.string(),
    content: v.string(),
    isRead: v.boolean(),
  }).index("by_person", ["personId"])
    .index("by_read_status", ["isRead"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
