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
    
    if (shows.length === 0) {
      return { 
        success: true, 
        message: "Geen voorstellingen gevonden voor deze maand",
        totalAssigned: 0,
        totalUnassigned: 0,
        fairnessReport: [],
        fairnessScore: 100,
        minShifts: 0,
        maxShifts: 0
      };
    }
    
    // Process shows in smaller batches to avoid hitting limits
    const BATCH_SIZE = 5; // Process 5 shows at a time
    const showBatches = [];
    for (let i = 0; i < shows.length; i += BATCH_SIZE) {
      showBatches.push(shows.slice(i, i + BATCH_SIZE));
    }
    
    // Track assignments per person across all shows for fairness
    const personAssignments = new Map<string, number>();
    const personShowAssignments = new Map<string, Set<string>>();
    
    let totalAssigned = 0;
    let totalUnassigned = 0;
    
    // Sort shows by date to assign in chronological order
    const sortedShows = shows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Pre-fetch all people to avoid repeated queries
    const allPeople = await ctx.db.query("people").collect();
    const peopleMap = new Map();
    allPeople.forEach(person => {
      peopleMap.set(person._id, person);
    });
    
    for (const show of sortedShows) {
      // Get shifts for this show
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      // Filter out shifts that are already assigned (either to person or SECU)
      const unassignedShifts = shifts.filter((shift: any) => !shift.personId && !shift.isSecuAssigned);
      
      if (unassignedShifts.length === 0) {
        continue; // Skip if all shifts are already assigned
      }
      
      // Track who is already assigned to this show to avoid double-booking
      const assignedToThisShow = new Set<string>();
      shifts.filter((shift: any) => shift.personId).forEach((shift: any) => {
        assignedToThisShow.add(shift.personId);
      });
      
      // Process shifts in smaller batches
      const SHIFT_BATCH_SIZE = 10;
      for (let i = 0; i < unassignedShifts.length; i += SHIFT_BATCH_SIZE) {
        const shiftBatch = unassignedShifts.slice(i, i + SHIFT_BATCH_SIZE);
        
        for (const shift of shiftBatch) {
          // Get available people for this shift - limit to reduce reads
          const availabilities = await ctx.db
            .query("availability")
            .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
            .filter((q) => q.eq(q.field("available"), true))
            .take(50); // Limit to first 50 available people
          
          const availablePeople = [];
          for (const avail of availabilities) {
            const person = peopleMap.get(avail.personId);
            if (person && person.roles.includes(shift.role)) {
              // Only include if not already assigned to this show
              if (!assignedToThisShow.has(person._id)) {
                availablePeople.push(person);
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
    }
    
    // Generate fairness report
    const fairnessReport = [];
    for (const [personId, count] of personAssignments.entries()) {
      const person = peopleMap.get(personId);
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
    
    if (shows.length === 0) {
      return {
        shows: [],
        stats: {
          totalShifts: 0,
          assignedShifts: 0,
          unassignedShifts: 0,
          assignmentRate: 0
        }
      };
    }
    
    // Pre-fetch all people to avoid repeated queries
    const allPeople = await ctx.db.query("people").collect();
    const peopleMap = new Map();
    allPeople.forEach(person => {
      peopleMap.set(person._id, person);
    });
    
    // Process shows in batches to avoid hitting limits
    const summary = [];
    let totalShifts = 0;
    let assignedShifts = 0;
    let unassignedShifts = 0;
    
    // Process shows in smaller batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < shows.length; i += BATCH_SIZE) {
      const showBatch = shows.slice(i, i + BATCH_SIZE);
      
      for (const show of showBatch) {
        const shifts = await ctx.db
          .query("shifts")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();
        
        const shiftDetails = [];
        
        for (const shift of shifts) {
          totalShifts++;
          const assignedPerson = shift.personId ? peopleMap.get(shift.personId) : null;
          
          // Consider shift assigned if either person is assigned OR SECU is assigned
          if (assignedPerson || shift.isSecuAssigned) {
            assignedShifts++;
          } else {
            unassignedShifts++;
          }
          
          // Get available people for this shift - limit to reduce reads
          const availabilities = await ctx.db
            .query("availability")
            .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
            .filter((q) => q.eq(q.field("available"), true))
            .take(50); // Increased limit for better admin override support
          
          const shiftAvailablePeople = [];
          const allAvailablePeople = []; // For admin override
          
          for (const avail of availabilities) {
            const person = peopleMap.get(avail.personId);
            if (person && person.isActive !== false) {
              // Add to all available people for admin override (regardless of role)
              allAvailablePeople.push(person);
              
              // Only add to regular available if they have the right role
              if (person.roles.includes(shift.role)) {
                shiftAvailablePeople.push(person);
              }
            }
          }
          
          // Admin override: add people available for other shifts in same show
          const existingIds = new Set(allAvailablePeople.map(p => p._id));
          for (const otherShift of shifts) {
            if (otherShift._id === shift._id) continue;
            const otherAvails = await ctx.db
              .query("availability")
              .withIndex("by_shift", (q) => q.eq("shiftId", otherShift._id))
              .filter((q) => q.eq(q.field("available"), true))
              .take(5);
            
            for (const avail of otherAvails) {
              const person = peopleMap.get(avail.personId);
              if (person && person.isActive !== false && !existingIds.has(person._id)) {
                allAvailablePeople.push(person);
                existingIds.add(person._id);
              }
            }
          }
          
          // Get all people assigned to shifts in this show
          const assignedInThisShow = new Set();
          shifts.forEach(s => {
            if (s.personId && s._id !== shift._id) { // Don't exclude the person from their own shift
              assignedInThisShow.add(s.personId);
            }
          });
          
          // Filter out people assigned to OTHER shifts in this show (but keep the person assigned to THIS shift visible)
          const unassignedAvailable = shiftAvailablePeople.filter(p => !assignedInThisShow.has(p._id));
          // Filter out people assigned to OTHER shifts in this show for admin override
          const unassignedAllAvailable = allAvailablePeople.filter(p => !assignedInThisShow.has(p._id));
          
          shiftDetails.push({
            ...shift,
            assignedPerson,
            availablePeople: unassignedAvailable,
            allAvailablePeople: unassignedAllAvailable, // For admin override - include all available people except assigned
            hasAvailablePeople: shiftAvailablePeople.length > 0,
            hasAnyAvailablePeople: unassignedAllAvailable.length > 0, // For admin override - based on filtered list
          });
        }
        
        summary.push({
          ...show,
          shifts: shiftDetails,
        });
      }
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
    
    if (shows.length === 0) {
      return {
        fairnessReport: [],
        metrics: {
          minShifts: 0,
          maxShifts: 0,
          avgShifts: 0,
          fairnessScore: 100,
          totalPeople: 0
        }
      };
    }
    
    // Pre-fetch all people to avoid repeated queries
    const allPeople = await ctx.db.query("people").collect();
    const peopleMap = new Map();
    allPeople.forEach(person => {
      peopleMap.set(person._id, person);
    });
    
    // Track assignments per person
    const personStats = new Map();
    
    // Process shows in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < shows.length; i += BATCH_SIZE) {
      const showBatch = shows.slice(i, i + BATCH_SIZE);
      
      for (const show of showBatch) {
        const shifts = await ctx.db
          .query("shifts")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();
        
        for (const shift of shifts) {
          // Only count shifts assigned to actual people (not SECU assignments)
          if (shift.personId) {
            const person = peopleMap.get(shift.personId);
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

// New mutation for admin override assignment
export const adminOverrideAssign = mutation({
  args: {
    shiftId: v.id("shifts"),
    personId: v.optional(v.id("people")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    let warnings: string[] = [];
    
    if (args.personId) {
      // Verify the person exists and is active
      const person = await ctx.db.get(args.personId);
      if (!person || person.isActive === false) {
        throw new Error("Persoon niet gevonden of niet actief");
      }
      
      // Verify the shift exists
      const shift = await ctx.db.get(args.shiftId);
      if (!shift) {
        throw new Error("Dienst niet gevonden");
      }
      
      // Get the show for this shift
      const show = await ctx.db.get(shift.showId);
      if (!show) {
        throw new Error("Voorstelling niet gevonden");
      }
      
      // For admin override, check if person is available for ANY shift in the same show
      // instead of just the specific shift
      const showShifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", shift.showId))
        .collect();
      
      let isAvailableForShow = false;
      for (const showShift of showShifts) {
        const availability = await ctx.db
          .query("availability")
          .withIndex("by_person_and_shift", (q) => 
            q.eq("personId", args.personId!).eq("shiftId", showShift._id)
          )
          .first();
        
        if (availability && availability.available) {
          isAvailableForShow = true;
          break;
        }
      }
      
      if (!isAvailableForShow) {
        throw new Error("Persoon is niet beschikbaar voor deze voorstelling");
      }
      
      // Check if person has the correct role
      if (!person.roles.includes(shift.role)) {
        warnings.push(`${person.name} heeft niet de juiste functie (${shift.role}). Admin override toegepast.`);
      }
      
      // Check if person is already assigned to another shift for the same show
      const existingAssignment = showShifts.find(s => 
        s._id !== args.shiftId && s.personId === args.personId
      );
      
      if (existingAssignment) {
        warnings.push(`${person.name} was al toegewezen aan een andere dienst voor ${show.name}. Vorige toewijzing verwijderd.`);
        // First unassign from the existing shift
        await ctx.db.patch(existingAssignment._id, {
          personId: undefined,
        });
      }
      
      // Check for same-date conflicts
      const sameDate = show.date;
      const sameDateShows = await ctx.db
        .query("shows")
        .withIndex("by_date", (q) => q.eq("date", sameDate))
        .collect();
      
      for (const sameDateShow of sameDateShows) {
        if (sameDateShow._id === show._id) continue;
        
        const sameDateShifts = await ctx.db
          .query("shifts")
          .withIndex("by_show", (q) => q.eq("showId", sameDateShow._id))
          .collect();
        
        const conflictingShift = sameDateShifts.find(s => s.personId === args.personId);
        if (conflictingShift) {
          warnings.push(`Let op: ${person.name} is ook toegewezen aan ${sameDateShow.name} op dezelfde dag.`);
        }
      }
    }
    
    // Assign or unassign the person
    await ctx.db.patch(args.shiftId, {
      personId: args.personId || undefined,
      // Clear SECU assignment if assigning a person
      isSecuAssigned: args.personId ? undefined : undefined,
    });
    
    return { 
      success: true, 
      warnings: warnings.length > 0 ? warnings : undefined 
    };
  },
});
