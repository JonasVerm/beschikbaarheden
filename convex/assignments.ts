import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const autoAssignStaffForMonth = mutation({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const startDate = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, '0')}-31`;
    
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    
    const allShifts = [];
    for (const show of shows) {
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      allShifts.push(...shifts.map(shift => ({ ...shift, show })));
    }
    
    allShifts.sort((a, b) => new Date(a.show.date).getTime() - new Date(b.show.date).getTime());
    
    const personAssignments = new Map<string, number>();
    
    for (const shift of allShifts) {
      if (shift.personId) continue;
      
      const availabilities = await ctx.db
        .query("availability")
        .filter((q) => q.eq(q.field("shiftId"), shift._id))
        .collect();
      
      const availablePeople = [];
      for (const avail of availabilities) {
        if (avail.available) {
          const person = await ctx.db.get(avail.personId);
          if (person && person.roles.includes(shift.role)) {
            availablePeople.push(person);
          }
        }
      }
      
      if (availablePeople.length === 0) continue;
      
      availablePeople.sort((a, b) => {
        const aCount = personAssignments.get(a._id) || 0;
        const bCount = personAssignments.get(b._id) || 0;
        return aCount - bCount;
      });
      
      const selectedPerson = availablePeople[0];
      await ctx.db.patch(shift._id, {
        personId: selectedPerson._id,
      });
      
      const currentCount = personAssignments.get(selectedPerson._id) || 0;
      personAssignments.set(selectedPerson._id, currentCount + 1);
    }
    
    return { success: true, message: "Personeel automatisch toegewezen" };
  },
});

export const getMonthlyAssignmentSummary = query({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const startDate = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, '0')}-31`;
    
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    
    const summary = [];
    
    for (const show of shows) {
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      const shiftDetails = [];
      
      for (const shift of shifts) {
        const assignedPerson = shift.personId ? await ctx.db.get(shift.personId) : null;
        
        // Get all available people for this shift
        const availabilities = await ctx.db
          .query("availability")
          .filter((q) => q.eq(q.field("shiftId"), shift._id))
          .collect();
        
        const availablePeople = [];
        for (const avail of availabilities) {
          if (avail.available) {
            const person = await ctx.db.get(avail.personId);
            if (person && person.roles.includes(shift.role)) {
              availablePeople.push(person);
            }
          }
        }
        
        // Filter out assigned person from available list
        const unassignedAvailable = availablePeople.filter(p => p._id !== shift.personId);
        
        shiftDetails.push({
          ...shift,
          assignedPerson,
          availablePeople: unassignedAvailable,
        });
      }
      
      summary.push({
        ...show,
        shifts: shiftDetails,
      });
    }
    
    return summary.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },
});
