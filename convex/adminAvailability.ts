import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

// Admin-only query that returns all shows regardless of availability status
export const adminGetAllShowsForPerson = query({
  args: { 
    personId: v.id("people"),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const person = await ctx.db.get(args.personId);
    if (!person) return [];
    
    const startDate = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, '0')}-31`;
    
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    
    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    
    const result = [];
    
    for (const show of shows) {
      // Determine availability status (for display purposes)
      let availabilityStatus = 'open';
      
      if (show.openDate && show.closeDate) {
        if (today < show.openDate) {
          availabilityStatus = 'not_yet_open';
        } else if (today > show.closeDate) {
          availabilityStatus = 'closed';
        }
      } else if (show.openTime && show.closeTime) {
        const openTime = typeof show.openTime === 'string' ? parseInt(show.openTime) : show.openTime;
        const closeTime = typeof show.closeTime === 'string' ? parseInt(show.closeTime) : show.closeTime;
        if (now < openTime) {
          availabilityStatus = 'not_yet_open';
        } else if (now > closeTime) {
          availabilityStatus = 'closed';
        }
      }
      
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      // Group shifts by role for staff view
      const roleGroups = new Map<string, any[]>();
      
      shifts.forEach(shift => {
        if (person.roles.includes(shift.role)) {
          if (!roleGroups.has(shift.role)) {
            roleGroups.set(shift.role, []);
          }
          roleGroups.get(shift.role)!.push(shift);
        }
      });
      
      // For each role group, create one representative shift for staff to see
      for (const [role, roleShifts] of roleGroups.entries()) {
        const representativeShift = roleShifts[0];
        
        // Check if person has availability for any shift in this role
        let hasAvailability = null;
        let hasUnrespondedShifts = false;
        
        for (const shift of roleShifts) {
          const availability = await ctx.db
            .query("availability")
            .withIndex("by_person_and_shift", (q) => 
              q.eq("personId", args.personId).eq("shiftId", shift._id)
            )
            .unique();
          
          if (availability) {
            hasAvailability = availability.available;
          } else {
            hasUnrespondedShifts = true;
          }
        }
        
        result.push({
          ...representativeShift,
          show,
          availability: hasAvailability,
          availabilityStatus, // Include status but don't restrict based on it
          hasUnrespondedShifts,
          totalPositions: roleShifts.length,
          allShiftIds: roleShifts.map(s => s._id),
        });
      }
    }
    
    return result;
  },
});
