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
    
    // Get all shifts for the month, grouped by show
    const showShifts = new Map();
    for (const show of shows) {
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      showShifts.set(show._id, shifts.map(shift => ({ ...shift, show })));
    }
    
    // Sort shows by date to assign in chronological order
    const sortedShows = shows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Track assignments per person across all shows
    const personAssignments = new Map<string, number>();
    const personShowAssignments = new Map<string, Set<string>>(); // Track which shows each person is assigned to
    
    let totalAssigned = 0;
    let totalUnassigned = 0;
    
    for (const show of sortedShows) {
      const shifts = showShifts.get(show._id) || [];
      const unassignedShifts = shifts.filter((shift: any) => !shift.personId);
      
      // Track who is already assigned to this show
      const assignedToThisShow = new Set<string>();
      shifts.filter((shift: any) => shift.personId).forEach((shift: any) => {
        assignedToThisShow.add(shift.personId);
      });
      
      for (const shift of unassignedShifts) {
        // Get available people for this shift
        const availabilities = await ctx.db
          .query("availability")
          .filter((q) => q.eq(q.field("shiftId"), shift._id))
          .collect();
        
        const availablePeople = [];
        for (const avail of availabilities) {
          if (avail.available) {
            const person = await ctx.db.get(avail.personId);
            if (person && person.roles.includes(shift.role)) {
              // Only include if not already assigned to this show
              if (!assignedToThisShow.has(person._id)) {
                availablePeople.push(person);
              }
            }
          }
        }
        
        if (availablePeople.length === 0) {
          totalUnassigned++;
          continue;
        }
        
        // Sort by total assignments across all shows (load balancing)
        availablePeople.sort((a, b) => {
          const aCount = personAssignments.get(a._id) || 0;
          const bCount = personAssignments.get(b._id) || 0;
          return aCount - bCount;
        });
        
        const selectedPerson = availablePeople[0];
        
        // Assign the person to this shift
        await ctx.db.patch(shift._id, {
          personId: selectedPerson._id,
        });
        
        // Update tracking
        assignedToThisShow.add(selectedPerson._id);
        const currentCount = personAssignments.get(selectedPerson._id) || 0;
        personAssignments.set(selectedPerson._id, currentCount + 1);
        
        // Track show assignments
        if (!personShowAssignments.has(selectedPerson._id)) {
          personShowAssignments.set(selectedPerson._id, new Set());
        }
        personShowAssignments.get(selectedPerson._id)!.add(show._id);
        
        totalAssigned++;
      }
    }
    
    return { 
      success: true, 
      message: `${totalAssigned} diensten toegewezen, ${totalUnassigned} niet toegewezen`,
      totalAssigned,
      totalUnassigned
    };
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
    let totalShifts = 0;
    let assignedShifts = 0;
    let unassignedShifts = 0;
    
    for (const show of shows) {
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      const shiftDetails = [];
      
      for (const shift of shifts) {
        totalShifts++;
        const assignedPerson = shift.personId ? await ctx.db.get(shift.personId) : null;
        
        if (assignedPerson) {
          assignedShifts++;
        } else {
          unassignedShifts++;
        }
        
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
          hasAvailablePeople: availablePeople.length > 0,
        });
      }
      
      summary.push({
        ...show,
        shifts: shiftDetails,
      });
    }
    
    const result = {
      shows: summary.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      stats: {
        totalShifts,
        assignedShifts,
        unassignedShifts,
        assignmentRate: totalShifts > 0 ? Math.round((assignedShifts / totalShifts) * 100) : 0
      }
    };
    
    return result;
  },
});
