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
        // Setting to not available
        if (existingAvailability) {
          await ctx.db.patch(existingAvailability._id, {
            available: false,
          });
        } else {
          await ctx.db.insert("availability", {
            personId: args.personId,
            shiftId: roleShift._id,
            available: false,
          });
        }
      }
    }
    
    return { success: true };
  },
});

export const clearAvailability = mutation({
  args: {
    personId: v.id("people"),
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args) => {
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) throw new Error("Shift not found");
    
    const allRoleShifts = await ctx.db
      .query("shifts")
      .withIndex("by_show", (q) => q.eq("showId", shift.showId))
      .filter((q) => q.eq(q.field("role"), shift.role))
      .collect();
    
    for (const roleShift of allRoleShifts) {
      const existing = await ctx.db
        .query("availability")
        .withIndex("by_person_and_shift", (q) => 
          q.eq("personId", args.personId).eq("shiftId", roleShift._id)
        )
        .unique();
      
      if (existing) {
        await ctx.db.delete(existing._id);
      }
    }
    
    return { success: true };
  },
});

export const markRestAsUnavailable = mutation({
  args: {
    personId: v.id("people"),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    // Get all shows in the month
    const startDateStr = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const endDate = new Date(args.year, args.month, 0);
    const endDateStr = `${args.year}-${String(args.month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    
    const shows = await ctx.db
      .query("shows")
      .filter((q) => 
        q.and(
          q.gte(q.field("date"), startDateStr),
          q.lte(q.field("date"), endDateStr)
        )
      )
      .collect();
    
    const person = await ctx.db.get(args.personId);
    if (!person) throw new Error("Person not found");
    
    let markedUnavailable = 0;
    
    for (const show of shows) {
      // Check if availability is open for this show
      const now = new Date();
      const openDate = show.openDate ? new Date(show.openDate + 'T00:00:00') : null;
      const closeDate = show.closeDate ? new Date(show.closeDate + 'T23:59:59') : null;
      
      // Skip if availability is not open
      if (openDate && now < openDate) continue;
      if (closeDate && now > closeDate) continue;
      
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      // Filter shifts to only include roles the person can do
      const relevantShifts = shifts.filter(shift => person.roles.includes(shift.role));
      
      for (const shift of relevantShifts) {
        const existingAvailability = await ctx.db
          .query("availability")
          .withIndex("by_person_and_shift", (q) => 
            q.eq("personId", args.personId).eq("shiftId", shift._id)
          )
          .unique();
        
        // If no availability is set (null response), mark as unavailable
        if (!existingAvailability) {
          await ctx.db.insert("availability", {
            personId: args.personId,
            shiftId: shift._id,
            available: false,
          });
          markedUnavailable++;
        }
      }
    }
    
    return { 
      success: true, 
      markedUnavailable,
      message: `${markedUnavailable} diensten gemarkeerd als niet beschikbaar.`
    };
  },
});
