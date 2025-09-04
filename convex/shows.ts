import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./adminHelpers";

export const create = mutation({
  args: {
    name: v.string(),
    date: v.string(),
    startTime: v.string(),
    openDate: v.string(),
    closeDate: v.string(),
    roles: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Validate that all roles exist and are active
    const activeRoles = await ctx.db.query("roles").filter((q) => q.eq(q.field("isActive"), true)).collect();
    const activeRoleNames = activeRoles.map(role => role.name);
    
    for (const roleName of Object.keys(args.roles)) {
      if (!activeRoleNames.includes(roleName)) {
        throw new Error(`Functie '${roleName}' bestaat niet of is niet actief`);
      }
    }
    
    const showId = await ctx.db.insert("shows", {
      name: args.name,
      date: args.date,
      startTime: args.startTime,
      openDate: args.openDate,
      closeDate: args.closeDate,
      roles: args.roles,
      isActive: true,
    });

    // Create shifts for each role with the specified number of people
    for (const [roleName, peopleNeeded] of Object.entries(args.roles)) {
      if (peopleNeeded > 0) {
        // Get role configuration for start time calculation
        const roleConfig = await ctx.db
          .query("roleConfigurations")
          .withIndex("by_role", (q) => q.eq("role", roleName))
          .unique();
        
        // Default hours if no config exists
        const defaultHours = 2.0;
        const hoursBeforeShow = roleConfig?.hoursBeforeShow || defaultHours;
        
        // Calculate shift start time
        const [hours, minutes] = args.startTime.split(':').map(Number);
        const showDate = new Date();
        showDate.setHours(hours, minutes, 0, 0);
        
        const shiftStartDate = new Date(showDate.getTime() - (hoursBeforeShow * 60 * 60 * 1000));
        const startTime = `${String(shiftStartDate.getHours()).padStart(2, '0')}:${String(shiftStartDate.getMinutes()).padStart(2, '0')}`;
        
        // Create shifts based on number of people needed
        if (peopleNeeded === 1) {
          // Single shift for this role
          await ctx.db.insert("shifts", {
            showId,
            role: roleName,
            peopleNeeded: 1,
            startTime,
          });
        } else {
          // Multiple shifts for this role (one per position)
          for (let position = 1; position <= peopleNeeded; position++) {
            await ctx.db.insert("shifts", {
              showId,
              role: roleName,
              peopleNeeded,
              position,
              startTime,
            });
          }
        }
      }
    }
    
    return showId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const shows = await ctx.db.query("shows").withIndex("by_date").order("desc").collect();
    console.log('Shows in database:', shows.length, shows);
    return shows;
  },
});

export const update = mutation({
  args: {
    showId: v.id("shows"),
    name: v.string(),
    date: v.string(),
    startTime: v.string(),
    openDate: v.string(),
    closeDate: v.string(),
    roles: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // Validate that all roles exist and are active
    const activeRoles = await ctx.db.query("roles").filter((q) => q.eq(q.field("isActive"), true)).collect();
    const activeRoleNames = activeRoles.map(role => role.name);
    
    for (const roleName of Object.keys(args.roles)) {
      if (!activeRoleNames.includes(roleName)) {
        throw new Error(`Functie '${roleName}' bestaat niet of is niet actief`);
      }
    }
    
    // Update the show
    await ctx.db.patch(args.showId, {
      name: args.name,
      date: args.date,
      startTime: args.startTime,
      openDate: args.openDate,
      closeDate: args.closeDate,
      roles: args.roles,
    });

    // Delete all existing shifts for this show
    const existingShifts = await ctx.db
      .query("shifts")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();
    
    // Delete all availability records for these shifts first
    for (const shift of existingShifts) {
      const availabilities = await ctx.db
        .query("availability")
        .filter((q) => q.eq(q.field("shiftId"), shift._id))
        .collect();
      
      for (const availability of availabilities) {
        await ctx.db.delete(availability._id);
      }
      
      // Delete the shift
      await ctx.db.delete(shift._id);
    }

    // Create new shifts based on updated roles
    for (const [roleName, peopleNeeded] of Object.entries(args.roles)) {
      if (peopleNeeded > 0) {
        // Get role configuration for start time calculation
        const roleConfig = await ctx.db
          .query("roleConfigurations")
          .withIndex("by_role", (q) => q.eq("role", roleName))
          .unique();
        
        // Default hours if no config exists
        const defaultHours = 2.0;
        const hoursBeforeShow = roleConfig?.hoursBeforeShow || defaultHours;
        
        // Calculate shift start time
        const [hours, minutes] = args.startTime.split(':').map(Number);
        const showDate = new Date();
        showDate.setHours(hours, minutes, 0, 0);
        
        const shiftStartDate = new Date(showDate.getTime() - (hoursBeforeShow * 60 * 60 * 1000));
        const startTime = `${String(shiftStartDate.getHours()).padStart(2, '0')}:${String(shiftStartDate.getMinutes()).padStart(2, '0')}`;
        
        // Create shifts based on number of people needed
        if (peopleNeeded === 1) {
          // Single shift for this role
          await ctx.db.insert("shifts", {
            showId: args.showId,
            role: roleName,
            peopleNeeded: 1,
            startTime,
          });
        } else {
          // Multiple shifts for this role (one per position)
          for (let position = 1; position <= peopleNeeded; position++) {
            await ctx.db.insert("shifts", {
              showId: args.showId,
              role: roleName,
              peopleNeeded,
              position,
              startTime,
            });
          }
        }
      }
    }

    return args.showId;
  },
});

export const getWithShifts = query({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    const show = await ctx.db.get(args.showId);
    if (!show) return null;
    
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();
    
    const shiftsWithPeople = [];
    for (const shift of shifts) {
      let person = null;
      if (shift.personId) {
        person = await ctx.db.get(shift.personId);
      }
      shiftsWithPeople.push({
        ...shift,
        person,
      });
    }
    
    return {
      ...show,
      shifts: shiftsWithPeople,
    };
  },
});

export const remove = mutation({
  args: { showId: v.id("shows") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    // First, delete all shifts for this show
    const shifts = await ctx.db
      .query("shifts")
      .withIndex("by_show", (q) => q.eq("showId", args.showId))
      .collect();
    
    // Delete all availability records for these shifts
    for (const shift of shifts) {
      const availabilities = await ctx.db
        .query("availability")
        .filter((q) => q.eq(q.field("shiftId"), shift._id))
        .collect();
      
      for (const availability of availabilities) {
        await ctx.db.delete(availability._id);
      }
      
      // Delete the shift
      await ctx.db.delete(shift._id);
    }
    
    // Finally, delete the show
    await ctx.db.delete(args.showId);
  },
});

export const importFromExcel = mutation({
  args: {
    shows: v.array(v.object({
      name: v.string(),
      date: v.string(),
      startTime: v.string(),
      openDate: v.string(),
      closeDate: v.string(),
      roles: v.record(v.string(), v.number())
    }))
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    
    const results = [];
    
    // Get active roles for validation
    const activeRoles = await ctx.db.query("roles").filter((q) => q.eq(q.field("isActive"), true)).collect();
    const activeRoleNames = activeRoles.map(role => role.name);
    
    for (const showData of args.shows) {
      try {
        console.log('Processing show data:', showData);
        
        // Validate roles
        for (const roleName of Object.keys(showData.roles)) {
          if (!activeRoleNames.includes(roleName)) {
            throw new Error(`Functie '${roleName}' bestaat niet of is niet actief`);
          }
        }
        
        // Create the show
        const showId = await ctx.db.insert("shows", {
          name: showData.name,
          date: showData.date,
          startTime: showData.startTime,
          openDate: showData.openDate,
          closeDate: showData.closeDate,
          roles: showData.roles,
          isActive: true,
        });
        
        console.log('Created show with ID:', showId);
        
        // Create shifts for each role with the specified number of people
        for (const [roleName, peopleNeeded] of Object.entries(showData.roles)) {
          if (peopleNeeded > 0) {
            // Get role configuration for start time calculation
            const roleConfig = await ctx.db
              .query("roleConfigurations")
              .withIndex("by_role", (q) => q.eq("role", roleName))
              .unique();
            
            const defaultHours = 2.0;
            const hoursBeforeShow = roleConfig?.hoursBeforeShow || defaultHours;
            
            // Calculate shift start time
            const [hours, minutes] = showData.startTime.split(':').map(Number);
            const showDate = new Date();
            showDate.setHours(hours, minutes, 0, 0);
            
            const shiftStartDate = new Date(showDate.getTime() - (hoursBeforeShow * 60 * 60 * 1000));
            const startTime = `${String(shiftStartDate.getHours()).padStart(2, '0')}:${String(shiftStartDate.getMinutes()).padStart(2, '0')}`;
            
            // Create shifts based on number of people needed
            if (peopleNeeded === 1) {
              // Single shift for this role
              await ctx.db.insert("shifts", {
                showId,
                role: roleName,
                peopleNeeded: 1,
                startTime,
              });
            } else {
              // Multiple shifts for this role (one per position)
              for (let position = 1; position <= peopleNeeded; position++) {
                await ctx.db.insert("shifts", {
                  showId,
                  role: roleName,
                  peopleNeeded,
                  position,
                  startTime,
                });
              }
            }
          }
        }
        
        results.push({ success: true, showName: showData.name });
      } catch (error) {
        results.push({ 
          success: false, 
          showName: showData.name, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    return results;
  },
});
