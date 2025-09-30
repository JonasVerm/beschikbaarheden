import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Organization settings - using key-value pairs for flexibility
  organizationSettings: defineTable({
    key: v.string(),
    value: v.string(),
  })
    .index("by_key", ["key"]),

  // Groups for organizing people
  groups: defineTable({
    name: v.string(),
    displayName: v.string(),
    color: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
  })
    .index("by_name", ["name"]),

  // People (staff members)
  people: defineTable({
    name: v.string(),
    roles: v.array(v.string()),
    groupId: v.id("groups"),
    isActive: v.boolean(),
    password: v.optional(v.string()), // Personal password for login
    mustChangePassword: v.optional(v.boolean()), // Flag to force password change on first login
    lastPasswordChange: v.optional(v.number()), // Timestamp of last password change
    excludeFromAutoAssignment: v.optional(v.boolean()), // Flag to exclude from automatic assignment
  }),

  // Roles
  roles: defineTable({
    name: v.string(),
    displayName: v.optional(v.string()),
    order: v.optional(v.number()),
    isActive: v.boolean(),
  }),

  // Shows/performances
  shows: defineTable({
    name: v.string(),
    date: v.string(), // YYYY-MM-DD format
    startTime: v.string(), // HH:MM format
    openDate: v.optional(v.string()), // When availability opens
    closeDate: v.optional(v.string()), // When availability closes
    openTime: v.optional(v.union(v.string(), v.number())), // Time when availability opens
    closeTime: v.optional(v.union(v.string(), v.number())), // Time when availability closes
    roles: v.optional(v.record(v.string(), v.number())), // Legacy field for role requirements
    isActive: v.boolean(),
  })
    .index("by_date", ["date"]),

  // Shifts within shows
  shifts: defineTable({
    showId: v.id("shows"),
    role: v.string(),
    startTime: v.optional(v.string()), // HH:MM format, can be different from show start
    positions: v.optional(v.number()), // Number of people needed for this role
    peopleNeeded: v.optional(v.number()), // Legacy field
    position: v.optional(v.number()), // Legacy field for individual position number
    personId: v.optional(v.id("people")), // Assigned person
    isSecuAssigned: v.optional(v.boolean()), // Security assignment flag
    isActive: v.optional(v.boolean()),
  })
    .index("by_show", ["showId"]),

  // Availability responses
  availability: defineTable({
    personId: v.id("people"),
    shiftId: v.id("shifts"),
    available: v.boolean(),
    submittedAt: v.optional(v.number()),
  })
    .index("by_person", ["personId"])
    .index("by_shift", ["shiftId"])
    .index("by_person_and_shift", ["personId", "shiftId"]),

  // Role configurations for availability windows
  roleConfigurations: defineTable({
    role: v.string(),
    daysBeforeShowToOpen: v.optional(v.number()),
    daysBeforeShowToClose: v.optional(v.number()),
    hoursBeforeShow: v.optional(v.number()), // Legacy field
    isActive: v.optional(v.boolean()),
  })
    .index("by_role", ["role"]),

  // Assignments (who is actually assigned to work)
  assignments: defineTable({
    personId: v.id("people"),
    shiftId: v.id("shifts"),
    assignedAt: v.number(),
    assignedBy: v.id("users"), // Admin who made the assignment
  })
    .index("by_person", ["personId"])
    .index("by_shift", ["shiftId"])
    .index("by_person_and_shift", ["personId", "shiftId"]),

  // Messages from staff to admins
  messages: defineTable({
    personId: v.id("people"),
    personName: v.string(),
    subject: v.string(),
    message: v.string(),
    content: v.optional(v.string()), // Alternative field name
    isRead: v.boolean(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
    readBy: v.optional(v.id("users")),
  })
    .index("by_person", ["personId"])
    .index("by_read_status", ["isRead"])
    .index("by_created_at", ["createdAt"]),

  // User roles for admin access
  userRoles: defineTable({
    userId: v.id("users"),
    role: v.string(), // "admin" or "superadmin"
  })
    .index("by_user", ["userId"]),


};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
