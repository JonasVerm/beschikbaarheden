import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Helper function to check admin access
async function checkAdminAccess(ctx: any, userId: string) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  // Check if user has admin role
  const userRole = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  
  if (!userRole) {
    throw new Error("Not authorized - admin access required");
  }
  
  return { user, userRole };
}

export const getMonthlyAssignmentSummary = query({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const startDate = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, '0')}-31`;
    
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    
    const result = [];
    let totalShifts = 0;
    let assignedShifts = 0;
    
    for (const show of shows) {
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();
      
      const showShifts = [];
      
      for (const shift of shifts) {
        totalShifts++;
        
        // Get assigned person if any
        let assignedPerson = null;
        if (shift.personId) {
          assignedPerson = await ctx.db.get(shift.personId);
          assignedShifts++;
        } else if (shift.isSecuAssigned) {
          assignedShifts++;
        }
        
        // Get available people for this shift
        const availabilities = await ctx.db
          .query("availability")
          .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
          .filter((q) => q.eq(q.field("available"), true))
          .collect();
        
        const availablePeople = [];
        const allAvailablePeople = [];
        
        for (const avail of availabilities) {
          const person = await ctx.db.get(avail.personId);
          if (person && person.isActive) {
            // Add to allAvailablePeople regardless of role or exclusion
            allAvailablePeople.push(person);
            
            // Only add to availablePeople if they have the correct role and are not excluded from auto assignment
            if (person.roles.includes(shift.role) && !person.excludeFromAutoAssignment) {
              availablePeople.push(person);
            }
          }
        }
        
        showShifts.push({
          ...shift,
          assignedPerson,
          availablePeople,
          allAvailablePeople,
          hasAvailablePeople: availablePeople.length > 0,
          hasAnyAvailablePeople: allAvailablePeople.length > 0,
        });
      }
      
      result.push({
        ...show,
        shifts: showShifts,
      });
    }
    
    const unassignedShifts = totalShifts - assignedShifts;
    const assignmentRate = totalShifts > 0 ? Math.round((assignedShifts / totalShifts) * 100) : 0;
    
    return {
      shows: result,
      stats: {
        totalShifts,
        assignedShifts,
        unassignedShifts,
        assignmentRate,
      },
    };
  },
});

export const autoAssignStaffForMonth = mutation({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await checkAdminAccess(ctx, userId);

    // Get all shows for the month
    const startDate = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, '0')}-31`;
    
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();

    let totalAssignments = 0;
    let totalShifts = 0;
    const assignmentsByPerson: Record<string, number> = {};

    // Process each show
    for (const show of shows) {
      const shifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .collect();

      // Get unassigned shifts
      const unassignedShifts = shifts.filter(shift => !shift.personId && !shift.isSecuAssigned);
      totalShifts += shifts.length;

      // For each unassigned shift, find available people
      for (const shift of unassignedShifts) {
        const availabilities = await ctx.db
          .query("availability")
          .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
          .filter((q) => q.eq(q.field("available"), true))
          .collect();

        const eligiblePeople = [];
        
        for (const avail of availabilities) {
          const person = await ctx.db.get(avail.personId);
          if (person && 
              person.isActive && 
              person.roles.includes(shift.role) &&
              !person.excludeFromAutoAssignment) { // Exclude people who opted out of auto assignment
            
            // Check if person is already assigned to another shift in this show
            const existingAssignment = shifts.find(s => s.personId === person._id);
            if (!existingAssignment) {
              eligiblePeople.push({
                person,
                currentAssignments: assignmentsByPerson[person._id] || 0
              });
            }
          }
        }

        // Sort by current assignment count (fairness) then by name for consistency
        eligiblePeople.sort((a, b) => {
          if (a.currentAssignments !== b.currentAssignments) {
            return a.currentAssignments - b.currentAssignments;
          }
          return a.person.name.localeCompare(b.person.name);
        });

        // Assign the first eligible person
        if (eligiblePeople.length > 0) {
          const selectedPerson = eligiblePeople[0].person;
          
          await ctx.db.patch(shift._id, {
            personId: selectedPerson._id,
          });

          assignmentsByPerson[selectedPerson._id] = (assignmentsByPerson[selectedPerson._id] || 0) + 1;
          totalAssignments++;
        }
      }
    }

    // Calculate fairness metrics
    const assignmentCounts = Object.values(assignmentsByPerson);
    const minShifts = assignmentCounts.length > 0 ? Math.min(...assignmentCounts) : 0;
    const maxShifts = assignmentCounts.length > 0 ? Math.max(...assignmentCounts) : 0;
    const avgShifts = assignmentCounts.length > 0 ? assignmentCounts.reduce((a, b) => a + b, 0) / assignmentCounts.length : 0;
    
    // Fairness score: higher is better (100% = perfectly fair)
    const fairnessScore = maxShifts > 0 ? Math.round((minShifts / maxShifts) * 100) : 100;

    // Generate fairness report
    const fairnessReport = [];
    for (const [personId, count] of Object.entries(assignmentsByPerson)) {
      const person = await ctx.db.get(personId as any);
      if (person && 'name' in person) {
        fairnessReport.push({
          name: person.name,
          assignments: count,
          deviation: Math.round((count - avgShifts) * 10) / 10
        });
      }
    }

    return {
      message: `Automatische toewijzing voltooid! ${totalAssignments} van ${totalShifts} diensten toegewezen. Medewerkers die zijn uitgesloten van automatische toewijzing blijven beschikbaar voor handmatige toewijzing.`,
      totalAssignments,
      totalShifts,
      fairnessScore,
      minShifts,
      maxShifts,
      avgShifts: Math.round(avgShifts * 10) / 10,
      fairnessReport: fairnessReport.sort((a, b) => b.assignments - a.assignments)
    };
  },
});

export const adminOverrideAssign = mutation({
  args: {
    shiftId: v.id("shifts"),
    personId: v.optional(v.id("people")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await checkAdminAccess(ctx, userId);

    const shift = await ctx.db.get(args.shiftId);
    if (!shift) {
      throw new Error("Shift not found");
    }

    const warnings = [];

    if (args.personId) {
      const person = await ctx.db.get(args.personId);
      if (!person) {
        throw new Error("Person not found");
      }

      // Check if person has the correct role
      if (!person.roles.includes(shift.role)) {
        warnings.push(`⚠️ ${person.name} heeft niet de juiste functie (${shift.role}). Dit is een admin override.`);
      }

      // Check if person is excluded from auto assignment
      if (person.excludeFromAutoAssignment) {
        warnings.push(`ℹ️ ${person.name} is uitgesloten van automatische toewijzing, maar kan handmatig worden toegewezen.`);
      }

      // Check if person is available for this shift
      const availability = await ctx.db
        .query("availability")
        .withIndex("by_person_and_shift", (q) => 
          q.eq("personId", args.personId!).eq("shiftId", args.shiftId)
        )
        .unique();

      if (!availability || !availability.available) {
        warnings.push(`⚠️ ${person.name} heeft zich niet beschikbaar gesteld voor deze dienst. Dit is een admin override.`);
      }

      // Check if person is already assigned to another shift in the same show
      const showShifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", shift.showId))
        .filter((q) => q.eq(q.field("personId"), args.personId))
        .collect();

      const existingAssignment = showShifts.find(s => s._id !== shift._id);
      if (existingAssignment) {
        // Remove from existing assignment
        await ctx.db.patch(existingAssignment._id, {
          personId: undefined,
        });
        warnings.push(`${person.name} is verplaatst van ${existingAssignment.role} naar ${shift.role} binnen dezelfde voorstelling.`);
      }
    }

    // Assign or unassign the person
    await ctx.db.patch(args.shiftId, {
      personId: args.personId,
      // Clear SECU assignment if assigning a person
      isSecuAssigned: args.personId ? undefined : shift.isSecuAssigned,
    });

    return { warnings };
  },
});
