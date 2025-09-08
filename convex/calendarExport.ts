import { query, action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";
import { api, internal } from "./_generated/api";

export const getAssignedShiftsForCalendar = query({
  args: { 
    personId: v.id("people"),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const person = await ctx.db.get(args.personId);
    if (!person) return null;
    
    const startDate = `${args.year}-${String(args.month).padStart(2, '0')}-01`;
    const endDate = `${args.year}-${String(args.month).padStart(2, '0')}-31`;
    
    // Get all shows in the month
    const shows = await ctx.db
      .query("shows")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    
    const assignedShifts = [];
    
    for (const show of shows) {
      // Get assigned shifts for this show and person
      const showShifts = await ctx.db
        .query("shifts")
        .withIndex("by_show", (q) => q.eq("showId", show._id))
        .filter((q) => q.eq(q.field("personId"), args.personId))
        .collect();
      
      for (const shift of showShifts) {
        // Calculate end time: always show start time + 3 hours
        const [showHours, showMinutes] = show.startTime.split(':').map(Number);
        const endHours = showHours + 3;
        const calculatedEndTime = `${String(endHours).padStart(2, '0')}:${String(showMinutes).padStart(2, '0')}`;
        
        assignedShifts.push({
          showName: show.name,
          showDate: show.date,
          showStartTime: show.startTime,
          role: shift.role,
          startTime: shift.startTime || show.startTime, // Use shift start time, fallback to show start time
          endTime: calculatedEndTime, // Always show start time + 3 hours
          location: "Capitole Gent",
          description: `${shift.role} voor ${show.name}`,
        });
      }
    }
    
    return {
      person: {
        name: person.name,
      },
      shifts: assignedShifts,
      month: args.month,
      year: args.year,
    };
  },
});

export const exportCalendarForPerson = action({
  args: { 
    personId: v.id("people"),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args): Promise<any> => {
    // Call the public query to get the data
    const data: any = await ctx.runQuery(api.calendarExport.getAssignedShiftsForCalendar, args);
    return data;
  },
});
