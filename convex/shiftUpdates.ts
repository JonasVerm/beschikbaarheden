import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation to update existing shifts when role config changes
export const updateExistingShifts = internalMutation({
  args: {
    role: v.string(),
    hoursBeforeShow: v.number(),
  },
  handler: async (ctx, args) => {
    const shifts = await ctx.db
      .query("shifts")
      .filter((q) => q.eq(q.field("role"), args.role))
      .collect();
    
    let updatedCount = 0;
    
    for (const shift of shifts) {
      const show = await ctx.db.get(shift.showId);
      if (!show) continue;
      
      const [hours, minutes] = show.startTime.split(':').map(Number);
      const showDate = new Date();
      showDate.setHours(hours, minutes, 0, 0);
      
      const shiftStartDate = new Date(showDate.getTime() - (args.hoursBeforeShow * 60 * 60 * 1000));
      const newStartTime = `${String(shiftStartDate.getHours()).padStart(2, '0')}:${String(shiftStartDate.getMinutes()).padStart(2, '0')}`;
      
      await ctx.db.patch(shift._id, {
        startTime: newStartTime,
      });
      
      updatedCount++;
    }
    
    return { updatedCount };
  },
});
