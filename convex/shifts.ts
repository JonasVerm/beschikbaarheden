import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const create = mutation({
  args: {
    showId: v.id("shows"),
    role: v.string(),
    peopleNeeded: v.optional(v.number()),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Get show details to calculate start time
    const show = await ctx.db.get(args.showId);
    if (!show) {
      throw new Error("Show not found");
    }
    
    // Get role configuration
    const roleConfig = await ctx.db
      .query("roleConfigurations")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .unique();
    
    // Default hours if no config exists
    const defaultHours = 2.0;
    
    const hoursBeforeShow = roleConfig?.hoursBeforeShow || defaultHours;
    
    // Calculate shift start time
    const [hours, minutes] = show.startTime.split(':').map(Number);
    const showDate = new Date();
    showDate.setHours(hours, minutes, 0, 0);
    
    const shiftStartDate = new Date(showDate.getTime() - (hoursBeforeShow * 60 * 60 * 1000));
    const startTime = `${String(shiftStartDate.getHours()).padStart(2, '0')}:${String(shiftStartDate.getMinutes()).padStart(2, '0')}`;
    
    return await ctx.db.insert("shifts", {
      showId: args.showId,
      role: args.role,
      peopleNeeded: args.peopleNeeded,
      position: args.position,
      startTime: startTime,
    });
  },
});

export const getAvailableForPerson = query({
  args: { 
    personId: v.id("people"),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId);
    if (!person) return [];
    
    const startDate = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, '0')}-31`;
    
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const now = Date.now();
    
    const openShows = shows.filter(show => {
      // Handle new date-based format
      if (show.openDate && show.closeDate) {
        return today >= show.openDate && today <= show.closeDate;
      }
      // Handle legacy timestamp format
      if (show.openTime && show.closeTime) {
        const openTime = typeof show.openTime === 'string' ? parseInt(show.openTime) : show.openTime;
        const closeTime = typeof show.closeTime === 'string' ? parseInt(show.closeTime) : show.closeTime;
        return now >= openTime && now <= closeTime;
      }
      // If no availability dates set, show is always open
      return true;
    });
    
    const result = [];
    
    for (const show of openShows) {
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
        // Use the first shift as the representative
        const representativeShift = roleShifts[0];
        
        // Check if person has availability for any shift in this role
        let hasAvailability = null; // null = no response, true = available, false = not available
        for (const shift of roleShifts) {
          const availability = await ctx.db
            .query("availability")
            .withIndex("by_person_and_shift", (q) => 
              q.eq("personId", args.personId).eq("shiftId", shift._id)
            )
            .unique();
          
          if (availability) {
            hasAvailability = availability.available;
            break; // Use the first availability record found
          }
        }
        
        result.push({
          ...representativeShift,
          show,
          availability: hasAvailability, // null, true, or false
          // Add metadata about the role group
          totalPositions: roleShifts.length,
          allShiftIds: roleShifts.map(s => s._id),
        });
      }
    }
    
    return result;
  },
});

export const getAllShowsForPerson = query({
  args: { 
    personId: v.id("people"),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
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
      // Determine availability status
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
        // Use the first shift as the representative
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
          availabilityStatus,
          hasUnrespondedShifts: hasUnrespondedShifts && availabilityStatus === 'open',
          totalPositions: roleShifts.length,
          allShiftIds: roleShifts.map(s => s._id),
        });
      }
    }
    
    return result;
  },
});

export const getAvailabilityForShow = query({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();
    
    const result = [];
    
    for (const shift of shifts) {
      const availabilities = await ctx.db
        .query("availability")
        .filter((q) => q.eq(q.field("shiftId"), shift._id))
        .collect();
      
      const availablePeople = [];
      for (const avail of availabilities) {
        if (avail.available) {
          const person = await ctx.db.get(avail.personId);
          if (person) {
            availablePeople.push(person);
          }
        }
      }
      
      result.push({
        ...shift,
        availablePeople,
      });
    }
    
    return result;
  },
});

export const assignPerson = mutation({
  args: {
    shiftId: v.id("shifts"),
    personId: v.optional(v.id("people")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    let movedFromShift = null;
    
    if (args.personId) {
      // Get the shift being assigned to
      const shift = await ctx.db.get(args.shiftId);
      if (!shift) {
        throw new Error("Dienst niet gevonden");
      }
      
      // Check if person is already assigned to another shift in the SAME show
      const showShifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", shift.showId))
        .filter((q) => q.eq(q.field("personId"), args.personId))
        .collect();
      
      const existingAssignment = showShifts.find(s => s._id !== args.shiftId);
      
      if (existingAssignment) {
        // Get show details for the shift they're being moved from
        const fromShow = await ctx.db.get(existingAssignment.showId);
        movedFromShift = {
          shiftId: existingAssignment._id,
          role: existingAssignment.role,
          showName: fromShow?.name || "Onbekende voorstelling",
          showDate: fromShow?.date || "Onbekende datum"
        };
        
        // Remove from the existing shift first
        await ctx.db.patch(existingAssignment._id, {
          personId: undefined,
        });
      }
    }
    
    await ctx.db.patch(args.shiftId, {
      personId: args.personId,
      // Clear SECU assignment if assigning a person
      isSecuAssigned: args.personId ? undefined : undefined,
    });
    
    return { movedFromShift };
  },
});

// New mutation to toggle SECU assignment for FA shifts
export const toggleSecuAssignment = mutation({
  args: {
    shiftId: v.id("shifts"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) {
      throw new Error("Dienst niet gevonden");
    }
    
    // Only allow SECU assignment for FA roles
    if (shift.role !== "FA") {
      throw new Error("SECU toewijzing is alleen beschikbaar voor FA functies");
    }
    
    // Toggle SECU assignment
    const newSecuState = !shift.isSecuAssigned;
    
    await ctx.db.patch(args.shiftId, {
      isSecuAssigned: newSecuState,
      // Clear person assignment if setting SECU
      personId: newSecuState ? undefined : shift.personId,
    });
    
    return { isSecuAssigned: newSecuState };
  },
});
