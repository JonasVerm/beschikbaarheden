import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const getStaffOverviewForMonth = query({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const startDate = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, '0')}-31`;
    
    // Get all shows for the month
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    
    // Get all people
    const people = await ctx.db.query("people").collect();
    
    const staffOverview = [];
    
    for (const person of people) {
      let totalShifts = 0;
      let assignedShifts = 0;
      let availableShifts = 0;
      let unavailableShifts = 0;
      let noResponseShifts = 0;
      const showDetails = [];
      
      for (const show of shows) {
        // Get shifts for this show that match the person's roles
        const shifts = await ctx.db
          .query("shifts")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();
        
        const relevantShifts = shifts.filter(shift => person.roles.includes(shift.role));
        
        if (relevantShifts.length === 0) continue;
        
        const shiftDetails = [];
        
        for (const shift of relevantShifts) {
          totalShifts++;
          
          // Check if assigned to this shift
          const isAssigned = shift.personId === person._id;
          if (isAssigned) {
            assignedShifts++;
          }
          
          // Check availability response
          const availability = await ctx.db
            .query("availability")
            .withIndex("by_person_and_shift", (q) => 
              q.eq("personId", person._id).eq("shiftId", shift._id)
            )
            .unique();
          
          let availabilityStatus: 'available' | 'unavailable' | 'no_response' | 'assigned';
          
          if (isAssigned) {
            availabilityStatus = 'assigned';
          } else if (availability === null) {
            availabilityStatus = 'no_response';
            noResponseShifts++;
          } else if (availability.available) {
            availabilityStatus = 'available';
            availableShifts++;
          } else {
            availabilityStatus = 'unavailable';
            unavailableShifts++;
          }
          
          shiftDetails.push({
            ...shift,
            availabilityStatus,
            isAssigned,
          });
        }
        
        if (shiftDetails.length > 0) {
          showDetails.push({
            ...show,
            shifts: shiftDetails,
          });
        }
      }
      
      // Only include people who have relevant shifts
      if (totalShifts > 0) {
        staffOverview.push({
          person,
          stats: {
            totalShifts,
            assignedShifts,
            availableShifts,
            unavailableShifts,
            noResponseShifts,
            responseRate: totalShifts > 0 ? Math.round(((availableShifts + unavailableShifts + assignedShifts) / totalShifts) * 100) : 0,
            assignmentRate: totalShifts > 0 ? Math.round((assignedShifts / totalShifts) * 100) : 0,
          },
          shows: showDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
        });
      }
    }
    
    // Sort by total assignments (descending) then by name
    return staffOverview.sort((a, b) => {
      if (a.stats.assignedShifts !== b.stats.assignedShifts) {
        return b.stats.assignedShifts - a.stats.assignedShifts;
      }
      return a.person.name.localeCompare(b.person.name);
    });
  },
});

export const getStaffWorkloadSummary = query({
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
    
    const people = await ctx.db.query("people").collect();
    
    let totalStaff = 0;
    let totalShifts = 0;
    let totalAssigned = 0;
    let totalAvailable = 0;
    let totalUnavailable = 0;
    let totalNoResponse = 0;
    
    const workloadDistribution = [];
    
    for (const person of people) {
      let personTotalShifts = 0;
      let personAssignedShifts = 0;
      let personAvailableShifts = 0;
      let personUnavailableShifts = 0;
      let personNoResponseShifts = 0;
      
      for (const show of shows) {
        const shifts = await ctx.db
          .query("shifts")
          .withIndex("by_show", (q) => q.eq("showId", show._id))
          .collect();
        
        const relevantShifts = shifts.filter(shift => person.roles.includes(shift.role));
        
        for (const shift of relevantShifts) {
          personTotalShifts++;
          
          const isAssigned = shift.personId === person._id;
          if (isAssigned) {
            personAssignedShifts++;
          } else {
            const availability = await ctx.db
              .query("availability")
              .withIndex("by_person_and_shift", (q) => 
                q.eq("personId", person._id).eq("shiftId", shift._id)
              )
              .unique();
            
            if (availability === null) {
              personNoResponseShifts++;
            } else if (availability.available) {
              personAvailableShifts++;
            } else {
              personUnavailableShifts++;
            }
          }
        }
      }
      
      if (personTotalShifts > 0) {
        totalStaff++;
        totalShifts += personTotalShifts;
        totalAssigned += personAssignedShifts;
        totalAvailable += personAvailableShifts;
        totalUnavailable += personUnavailableShifts;
        totalNoResponse += personNoResponseShifts;
        
        const responseRate = personTotalShifts > 0 ? 
          Math.round(((personAvailableShifts + personUnavailableShifts + personAssignedShifts) / personTotalShifts) * 100) : 0;
        
        workloadDistribution.push({
          name: person.name,
          assignments: personAssignedShifts,
          availability: personAvailableShifts,
          unavailability: personUnavailableShifts,
          responseRate,
        });
      }
    }
    
    return {
      totalStaff,
      totalShifts,
      totalAssigned,
      totalAvailable,
      totalUnavailable,
      totalNoResponse,
      averageAssignments: totalStaff > 0 ? Math.round(totalAssigned / totalStaff * 10) / 10 : 0,
      overallResponseRate: totalShifts > 0 ? Math.round(((totalAssigned + totalAvailable + totalUnavailable) / totalShifts) * 100) : 0,
      workloadDistribution,
    };
  },
});
