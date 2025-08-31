import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const setAvailability = mutation({
  args: {
    personId: v.id("people"),
    shiftId: v.id("shifts"),
    available: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Get the shift to find its role and show
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) {
      throw new Error("Shift not found");
    }
    
    // Find all shifts for the same role in the same show
    const allRoleShifts = await ctx.db
      .query("shifts")
      .withIndex("by_show", (q) => q.eq("showId", shift.showId))
      .filter((q) => q.eq(q.field("role"), shift.role))
      .collect();
    
    // Set availability for all shifts of this role
    for (const roleShift of allRoleShifts) {
      const existingAvailability = await ctx.db
        .query("availability")
        .withIndex("by_person_and_shift", (q) => 
          q.eq("personId", args.personId).eq("shiftId", roleShift._id)
        )
        .unique();
      
      if (args.available) {
        // Setting to available
        if (existingAvailability) {
          await ctx.db.patch(existingAvailability._id, {
            available: true,
          });
        } else {
          await ctx.db.insert("availability", {
            personId: args.personId,
            shiftId: roleShift._id,
            available: true,
          });
        }
      } else {
        // Setting to not available - delete the record to represent "no response"
        if (existingAvailability) {
          await ctx.db.delete(existingAvailability._id);
        }
      }
    }
    
    return { success: true };
  },
});
