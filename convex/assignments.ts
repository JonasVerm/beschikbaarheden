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
    
    // Track assignments per person across all shows for fairness
    const personAssignments = new Map<string, number>();
    const personShowAssignments = new Map<string, Set<string>>();
    
    let totalAssigned = 0;
    let totalUnassigned = 0;
    
    for (const show of sortedShows) {
      const shifts = showShifts.get(show._id) || [];
      const unassignedShifts = shifts.filter((shift: any) => !shift.personId);
      
      // Track who is already assigned to this show to avoid double-booking
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
        
        // Enhanced fair assignment algorithm
        availablePeople.sort((a, b) => {
          const aCount = personAssignments.get(a._id) || 0;
          const bCount = personAssignments.get(b._id) || 0;
          
          // Primary: Sort by total assignments (load balancing)
          if (aCount !== bCount) {
            return aCount - bCount;
          }
          
          // Secondary: Sort by number of shows assigned to (spread across shows)
          const aShowCount = personShowAssignments.get(a._id)?.size || 0;
          const bShowCount = personShowAssignments.get(b._id)?.size || 0;
          if (aShowCount !== bShowCount) {
            return aShowCount - bShowCount;
          }
          
          // Tertiary: Random selection for true fairness when all else is equal
          return Math.random() - 0.5;
        });
        
        const selectedPerson = availablePeople[0];
        
        // Assign the person to this shift
        await ctx.db.patch(shift._id, {
          personId: selectedPerson._id,
        });
        
        // Update tracking for fairness
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
    
    // Generate fairness report
    const fairnessReport = [];
    for (const [personId, count] of personAssignments.entries()) {
      const person = await ctx.db.get(personId as any);
      if (person && 'name' in person && 'roles' in person) {
        const showCount = personShowAssignments.get(personId)?.size || 0;
        fairnessReport.push({
          name: person.name,
          totalShifts: count,
          totalShows: showCount,
          roles: person.roles
        });
      }
    }
    
    // Sort by total shifts for easy comparison
    fairnessReport.sort((a, b) => a.totalShifts - b.totalShifts);
    
    // Calculate fairness metrics
    const minShifts = fairnessReport.length > 0 ? fairnessReport[0].totalShifts : 0;
    const maxShifts = fairnessReport.length > 0 ? fairnessReport[fairnessReport.length - 1].totalShifts : 0;
    const fairnessScore = maxShifts > 0 ? Math.round(((maxShifts - minShifts) / maxShifts) * 100) : 100;
    
    return { 
      success: true, 
      message: `${totalAssigned} diensten toegewezen, ${totalUnassigned} niet toegewezen. Eerlijkheid: ${100 - fairnessScore}%`,
      totalAssigned,
      totalUnassigned,
      fairnessReport,
      fairnessScore: 100 - fairnessScore, // Higher percentage = more fair
      minShifts,
      maxShifts
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

// New query to get fairness statistics for the month
export const getFairnessReport = query({
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
    
    // Track assignments per person
    const personStats = new Map();
    
    for (const show of shows) {
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      for (const shift of shifts) {
        if (shift.personId) {
          const person = await ctx.db.get(shift.personId);
          if (person) {
            if (!personStats.has(person._id)) {
              personStats.set(person._id, {
                name: person.name,
                roles: person.roles,
                totalShifts: 0,
                shows: new Set()
              });
            }
            const stats = personStats.get(person._id);
            stats.totalShifts++;
            stats.shows.add(show._id);
          }
        }
      }
    }
    
    // Convert to array and add show counts
    const fairnessReport = Array.from(personStats.values()).map(stats => ({
      ...stats,
      totalShows: stats.shows.size,
      shows: undefined // Remove the Set object
    }));
    
    // Sort by total shifts
    fairnessReport.sort((a, b) => a.totalShifts - b.totalShifts);
    
    // Calculate fairness metrics
    const minShifts = fairnessReport.length > 0 ? fairnessReport[0].totalShifts : 0;
    const maxShifts = fairnessReport.length > 0 ? fairnessReport[fairnessReport.length - 1].totalShifts : 0;
    const avgShifts = fairnessReport.length > 0 ? 
      Math.round(fairnessReport.reduce((sum, p) => sum + p.totalShifts, 0) / fairnessReport.length * 10) / 10 : 0;
    
    return {
      fairnessReport,
      metrics: {
        minShifts,
        maxShifts,
        avgShifts,
        fairnessScore: maxShifts > 0 ? Math.round((1 - (maxShifts - minShifts) / maxShifts) * 100) : 100,
        totalPeople: fairnessReport.length
      }
    };
  },
});
