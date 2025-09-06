import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import ExcelJS from 'exceljs';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameDay, 
  getDay,
  addDays,
  subDays
} from 'date-fns';
import { nl } from 'date-fns/locale';

export function MonthlyAssignments() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAssigning, setIsAssigning] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [selectedShow, setSelectedShow] = useState<any>(null);
  const [assigningShifts, setAssigningShifts] = useState<Set<string>>(new Set());
  const [showAdminOverride, setShowAdminOverride] = useState<Set<string>>(new Set());
  
  const assignmentData = useQuery(api.assignments.getMonthlyAssignmentSummary, {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });
  
  const fairnessData = useQuery(api.assignments.getFairnessReport, {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });

  // Get roles for Excel export
  const allRoles = useQuery(api.roles.listActive);
  
  const autoAssignStaff = useMutation(api.assignments.autoAssignStaffForMonth);
  const assignPerson = useMutation(api.shifts.assignPerson);
  const adminOverrideAssign = useMutation(api.assignments.adminOverrideAssign);
  const toggleSecuAssignment = useMutation(api.shifts.toggleSecuAssignment);

  const handleAutoAssign = async () => {
    setIsAssigning(true);
    try {
      const result = await autoAssignStaff({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      });
      toast.success(result.message);
      
      // Show fairness report if available
      if (result.fairnessReport && result.fairnessReport.length > 0) {
        console.log("Fairness Report:", result.fairnessReport);
        console.log(`Fairness Score: ${result.fairnessScore}% (Min: ${result.minShifts}, Max: ${result.maxShifts} shifts)`);
      }
    } catch (error) {
      toast.error("Fout bij automatisch toewijzen");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleManualAssign = async (shiftId: Id<"shifts">, personId: Id<"people"> | null) => {
    // Add shift to loading state
    setAssigningShifts(prev => new Set(prev).add(shiftId));
    
    try {
      const result = await assignPerson({ shiftId, personId: personId || undefined });
      
      // Show success message with move information if applicable
      if (personId && result?.movedFromShift) {
        const fromDate = new Date(result.movedFromShift.showDate).toLocaleDateString('nl-BE');
        // Check if it's the same show (same date and name)
        const currentShow = selectedShow || assignmentData?.shows?.find(show => 
          show.shifts.some(s => s._id === shiftId)
        );
        
        if (currentShow && result.movedFromShift.showName === currentShow.name) {
          toast.warning(
            `⚠️ Persoon verplaatst binnen dezelfde voorstelling van ${result.movedFromShift.role} naar nieuwe functie`,
            { duration: 6000 }
          );
        } else {
          toast.success(
            `Persoon toegewezen. Verplaatst van ${result.movedFromShift.role} op ${result.movedFromShift.showName} (${fromDate})`,
            { duration: 6000 }
          );
        }
      } else {
        toast.success(personId ? "Persoon toegewezen" : "Toewijzing verwijderd");
      }
      
      // Update selected show if it's open
      if (selectedShow) {
        // Find the person being assigned/unassigned
        const targetShift = selectedShow.shifts.find((s: any) => s._id === shiftId);
        const assignedPerson = personId ? (
          targetShift?.availablePeople.find((p: any) => p._id === personId) ||
          targetShift?.allAvailablePeople?.find((p: any) => p._id === personId)
        ) : targetShift?.assignedPerson;

        // Update all shifts in the selected show
        const updatedShifts = selectedShow.shifts.map((shift: any) => {
          if (shift._id === shiftId) {
            // This is the target shift
            if (personId) {
              return {
                ...shift,
                assignedPerson,
                availablePeople: shift.availablePeople.filter((p: any) => p._id !== personId),
                allAvailablePeople: shift.allAvailablePeople?.filter((p: any) => p._id !== personId)
              };
            } else {
              // Remove assignment
              return {
                ...shift,
                assignedPerson: null,
                availablePeople: shift.assignedPerson 
                  ? [...shift.availablePeople, shift.assignedPerson]
                  : shift.availablePeople,
                allAvailablePeople: shift.assignedPerson 
                  ? [...(shift.allAvailablePeople || []), shift.assignedPerson]
                  : shift.allAvailablePeople
              };
            }
          } else if (personId && shift.assignedPerson && shift.assignedPerson._id === personId) {
            // This shift had the person assigned but they were moved to the target shift
            // Remove the assignment and add the person back to available lists
            return {
              ...shift,
              assignedPerson: null,
              availablePeople: shift.assignedPerson.roles.includes(shift.role) 
                ? [...shift.availablePeople, shift.assignedPerson]
                : shift.availablePeople,
              allAvailablePeople: [...(shift.allAvailablePeople || []), shift.assignedPerson]
            };
          } else {
            // Other shifts - handle adding/removing person from available lists
            if (personId) {
              // Remove the person from available lists if they're there (they got assigned)
              return {
                ...shift,
                availablePeople: shift.availablePeople.filter((p: any) => p._id !== personId),
                allAvailablePeople: shift.allAvailablePeople?.filter((p: any) => p._id !== personId)
              };
            } else if (assignedPerson) {
              // Add the unassigned person back to available lists if they qualify
              const shouldAddToAvailable = assignedPerson.roles.includes(shift.role) && 
                !shift.availablePeople.some((p: any) => p._id === assignedPerson._id);
              const shouldAddToAllAvailable = !shift.allAvailablePeople?.some((p: any) => p._id === assignedPerson._id);
              
              return {
                ...shift,
                availablePeople: shouldAddToAvailable 
                  ? [...shift.availablePeople, assignedPerson]
                  : shift.availablePeople,
                allAvailablePeople: shouldAddToAllAvailable 
                  ? [...(shift.allAvailablePeople || []), assignedPerson]
                  : shift.allAvailablePeople
              };
            }
            return shift;
          }
        });
        
        setSelectedShow({
          ...selectedShow,
          shifts: updatedShifts
        });
      }
    } catch (error) {
      toast.error("Fout bij toewijzen");
    } finally {
      // Remove shift from loading state
      setAssigningShifts(prev => {
        const newSet = new Set(prev);
        newSet.delete(shiftId);
        return newSet;
      });
    }
  };

  const handleAdminOverrideAssign = async (shiftId: Id<"shifts">, personId: Id<"people"> | null) => {
    // Add shift to loading state
    setAssigningShifts(prev => new Set(prev).add(shiftId));
    
    try {
      const result = await adminOverrideAssign({ shiftId, personId: personId || undefined });
      
      // Show success message
      toast.success(personId ? "Persoon toegewezen (admin override)" : "Toewijzing verwijderd");
      
      // Show warnings if any
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach(warning => {
          toast.warning(warning, { duration: 6000 });
        });
      }
      
      // Update selected show if it's open
      if (selectedShow) {
        const targetShift = selectedShow.shifts.find((s: any) => s._id === shiftId);
        const assignedPerson = personId ? 
          targetShift?.allAvailablePeople?.find((p: any) => p._id === personId) :
          targetShift?.assignedPerson;
        
        // Update all shifts in the selected show
        const updatedShifts = selectedShow.shifts.map((shift: any) => {
          if (shift._id === shiftId) {
            // This is the shift being assigned to/unassigned from
            if (personId) {
              return {
                ...shift,
                assignedPerson,
                availablePeople: shift.availablePeople.filter((p: any) => p._id !== personId),
                allAvailablePeople: shift.allAvailablePeople?.filter((p: any) => p._id !== personId)
              };
            } else {
              // Removing assignment
              return {
                ...shift,
                assignedPerson: null,
                availablePeople: shift.assignedPerson 
                  ? [...shift.availablePeople, shift.assignedPerson]
                  : shift.availablePeople,
                allAvailablePeople: shift.assignedPerson 
                  ? [...(shift.allAvailablePeople || []), shift.assignedPerson]
                  : shift.allAvailablePeople
              };
            }
          } else if (personId && shift.assignedPerson && shift.assignedPerson._id === personId) {
            // This shift had the person assigned but they were moved to another shift
            // Remove the assignment and add the person back to available lists
            return {
              ...shift,
              assignedPerson: null,
              availablePeople: shift.assignedPerson.roles.includes(shift.role) 
                ? [...shift.availablePeople, shift.assignedPerson]
                : shift.availablePeople,
              allAvailablePeople: [...(shift.allAvailablePeople || []), shift.assignedPerson]
            };
          } else {
            // Other shifts - handle adding/removing person from available lists
            if (personId) {
              // Remove the person from available lists if they're there (they got assigned)
              return {
                ...shift,
                availablePeople: shift.availablePeople.filter((p: any) => p._id !== personId),
                allAvailablePeople: shift.allAvailablePeople?.filter((p: any) => p._id !== personId)
              };
            } else if (assignedPerson) {
              // Add the unassigned person back to available lists if they qualify
              const shouldAddToAvailable = assignedPerson.roles.includes(shift.role) && 
                !shift.availablePeople.some((p: any) => p._id === assignedPerson._id);
              const shouldAddToAllAvailable = !shift.allAvailablePeople?.some((p: any) => p._id === assignedPerson._id);
              
              return {
                ...shift,
                availablePeople: shouldAddToAvailable 
                  ? [...shift.availablePeople, assignedPerson]
                  : shift.availablePeople,
                allAvailablePeople: shouldAddToAllAvailable 
                  ? [...(shift.allAvailablePeople || []), assignedPerson]
                  : shift.allAvailablePeople
              };
            }
            return shift;
          }
        });
        
        setSelectedShow({
          ...selectedShow,
          shifts: updatedShifts
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fout bij admin override toewijzing");
    } finally {
      // Remove shift from loading state
      setAssigningShifts(prev => {
        const newSet = new Set(prev);
        newSet.delete(shiftId);
        return newSet;
      });
    }
  };

  const handleSecuToggle = async (shiftId: Id<"shifts">) => {
    setAssigningShifts(prev => new Set(prev).add(shiftId));
    try {
      const result = await toggleSecuAssignment({ shiftId });
      toast.success(result.isSecuAssigned ? "SECU toegewezen" : "SECU toewijzing verwijderd");
      
      // Update selected show if it's open
      if (selectedShow) {
        const updatedShifts = selectedShow.shifts.map((shift: any) => {
          if (shift._id === shiftId) {
            const wasAssignedPerson = shift.assignedPerson;
            return {
              ...shift,
              isSecuAssigned: result.isSecuAssigned,
              // If SECU is assigned, clear any person assignment
              assignedPerson: result.isSecuAssigned ? null : shift.assignedPerson
            };
          } else if (!result.isSecuAssigned && shift.assignedPerson) {
            // If SECU was unassigned, we need to add the previously assigned person back to other shifts
            const targetShift = selectedShow.shifts.find((s: any) => s._id === shiftId);
            const wasAssignedPerson = targetShift?.assignedPerson;
            
            if (wasAssignedPerson) {
              const shouldAddToAvailable = wasAssignedPerson.roles.includes(shift.role) && 
                !shift.availablePeople.some((p: any) => p._id === wasAssignedPerson._id);
              const shouldAddToAllAvailable = !shift.allAvailablePeople?.some((p: any) => p._id === wasAssignedPerson._id);
              
              return {
                ...shift,
                availablePeople: shouldAddToAvailable 
                  ? [...shift.availablePeople, wasAssignedPerson]
                  : shift.availablePeople,
                allAvailablePeople: shouldAddToAllAvailable 
                  ? [...(shift.allAvailablePeople || []), wasAssignedPerson]
                  : shift.allAvailablePeople
              };
            }
          }
          return shift;
        });
        
        setSelectedShow({
          ...selectedShow,
          shifts: updatedShifts
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fout bij SECU toewijzing");
    } finally {
      setAssigningShifts(prev => {
        const newSet = new Set(prev);
        newSet.delete(shiftId);
        return newSet;
      });
    }
  };

  const toggleAdminOverride = (shiftId: string) => {
    setShowAdminOverride(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shiftId)) {
        newSet.delete(shiftId);
      } else {
        newSet.add(shiftId);
      }
      return newSet;
    });
  };

  // Helper function to lighten a hex color
  const lightenColor = (color: string, factor: number) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const newR = Math.min(255, Math.floor(r + (255 - r) * factor));
    const newG = Math.min(255, Math.floor(g + (255 - g) * factor));
    const newB = Math.min(255, Math.floor(b + (255 - b) * factor));
    
    return newR.toString(16).padStart(2, '0') + 
           newG.toString(16).padStart(2, '0') + 
           newB.toString(16).padStart(2, '0');
  };

  const exportToExcel = async () => {
    if (!assignmentData?.shows || assignmentData.shows.length === 0) {
      toast.error('Geen gegevens om te exporteren');
      return;
    }

    if (!allRoles || allRoles.length === 0) {
      toast.error('Geen functies gevonden voor export');
      return;
    }

    // Get role order from localStorage (set by RoleManager)
    const storedOrder = localStorage.getItem('roleOrder');
    let sortedRoles: string[];
    
    if (storedOrder) {
      try {
        const roleOrder = JSON.parse(storedOrder);
        // Map role IDs to role display names, maintaining the order
        sortedRoles = roleOrder
          .map((id: string) => {
            const role = allRoles.find(role => role._id === id);
            return role ? (role.displayName || role.name) : null;
          })
          .filter(Boolean);
        
        // Add any roles that weren't in the stored order
        const remainingRoles = allRoles
          .filter(role => !sortedRoles.includes(role.displayName || role.name))
          .map(role => role.displayName || role.name);
        sortedRoles = [...sortedRoles, ...remainingRoles];
      } catch (error) {
        // Fallback to default order
        sortedRoles = allRoles.map(role => role.displayName || role.name);
      }
    } else {
      // Fallback to default order
      sortedRoles = allRoles.map(role => role.displayName || role.name);
    }

    // Create mapping from role name to display name
    const roleNameToDisplayName: Record<string, string> = {};
    allRoles.forEach(role => {
      roleNameToDisplayName[role.name] = role.displayName || role.name;
    });

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Capitole Gent';
    workbook.title = 'Personeelstoewijzingen';
    workbook.subject = `Toewijzingen voor ${monthName}`;
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Toewijzingen');

    // Define colors for different role types
    const roleColors: Record<string, string> = {
      'Front Of House': 'C6EFCE', // light green
      'Medewerkersingang': 'FFF2CC', // light blue  
      'Front-assistant': 'F2DCDB', // light yellow
      'Bar-assistant': 'FCE4D6', // light orange
      'Bar': 'BDD7EE', // light red
      'Levering': 'F2F2F2' // light gray
    };

    // Add header row
    const headerRow = ['Voorstelling', 'Datum', 'Show start'];
    sortedRoles.forEach(role => {
      headerRow.push('Start');
      headerRow.push(role);
    });
    
    const headerRowObj = worksheet.addRow(headerRow);
    headerRowObj.height = 30;

    // Style header row
    headerRowObj.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 14, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Set background color
      let bgColor = 'F2F2F2'; // Default gray for first 3 columns
      if (colNumber > 3) {
        const roleIndex = Math.floor((colNumber - 4) / 2);
        const role = sortedRoles[roleIndex];
        bgColor = roleColors[role] || 'F2F2F2';
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + bgColor }
      };
    });

    // Add data rows
    assignmentData.shows.forEach((show, showIndex) => {
      const [year, month, day] = show.date.split('-').map(Number);
      const localDate = new Date(Date.UTC(year, month - 1, day));
      
      // Create a map of role assignments and start times for this show
      const roleAssignments: Record<string, string[]> = {};
      const roleStartTimes: Record<string, string[]> = {};
      
      // Initialize all roles with empty arrays
      sortedRoles.forEach(role => {
        roleAssignments[role] = [];
        roleStartTimes[role] = [];
      });
      
      // Fill in the assignments
      show.shifts.forEach(shift => {
        if (shift.assignedPerson || shift.isSecuAssigned) {
          let assignedName = '';
          
          if (shift.assignedPerson) {
            assignedName = shift.assignedPerson.name;
          } else if (shift.isSecuAssigned) {
            assignedName = 'SECU';
          }
          
          // Use display name for the assignment mapping
          const roleDisplayName = roleNameToDisplayName[shift.role] || shift.role;
          if (!roleAssignments[roleDisplayName]) {
            roleAssignments[roleDisplayName] = [];
            roleStartTimes[roleDisplayName] = [];
          }
          roleAssignments[roleDisplayName].push(assignedName);
          roleStartTimes[roleDisplayName].push(shift.startTime || '');
        }
      });
      
      // Sort names alphabetically by last name within each role
      sortedRoles.forEach(role => {
        if (roleAssignments[role].length > 0) {
          const combined = roleAssignments[role].map((name, index) => ({
            name,
            startTime: roleStartTimes[role][index]
          }));
          
          // Sort by last name (assuming format "First Last" or just "Name")
          combined.sort((a, b) => {
            const lastNameA = a.name.split(' ').pop() || a.name;
            const lastNameB = b.name.split(' ').pop() || b.name;
            return lastNameA.localeCompare(lastNameB, 'nl');
          });
          
          roleAssignments[role] = combined.map(item => item.name);
          roleStartTimes[role] = combined.map(item => item.startTime);
        }
      });
      
      // Create the row data
      const rowData = [
        show.name,
        localDate.toLocaleDateString('nl-BE'),
        show.startTime
      ];
      
      // Add start times and assignments for each role in the defined order
      sortedRoles.forEach(role => {
        const assignments = roleAssignments[role];
        const startTimes = roleStartTimes[role];
        // Only show start time if there are assignments and if it's unique for this role
        const uniqueStartTimes = [...new Set(startTimes)];
        rowData.push(uniqueStartTimes.length === 1 ? uniqueStartTimes[0] : '');
        rowData.push(assignments.length > 0 ? assignments.join(', ') : '');
      });
      
      const dataRow = worksheet.addRow(rowData);
      
      // Determine if this is an even or odd row for alternating colors
      const isEvenRow = showIndex % 2 === 0;
      
      // Style data row
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 12 };
        cell.alignment = { 
          horizontal: colNumber <= 3 ? 'left' : 'left', 
          vertical: 'middle', 
          wrapText: true 
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        // Set background color
        let bgColor = 'FFFFFF'; // Default white
        
        if (colNumber <= 3) {
          // First 3 columns: alternating darker gray
          bgColor = isEvenRow ? 'E9ECEF' : 'F8F9FA';
        } else {
          // Role columns: use role colors with alternating intensity
          const roleIndex = Math.floor((colNumber - 4) / 2);
          const role = sortedRoles[roleIndex];
          const baseColor = roleColors[role] || 'FFFFFF';
          
          if (isEvenRow) {
            // Even rows: use the base role color
            bgColor = baseColor;
          } else {
            // Odd rows: use a slightly lighter version of the role color
            bgColor = lightenColor(baseColor, 0.3);
          }
        }
        
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF' + bgColor }
        };
      });
    });

    // Define role-specific column widths
    const roleWidths: Record<string, number> = {
      'Front Of House': 25,
      'Medewerkersingang': 25,
      'Front-assistant': 50,
      'Bar-assistant': 50,
      'Bar': 125,
      'Leveringen': 25
    };

    // Set column widths
    const columns = [
      { width: 60 }, // Show name
      { width: 15 }, // Date
      { width: 15 }, // Start time
    ];

    // Add role-specific widths
    sortedRoles.forEach(role => {
      const roleWidth = roleWidths[role] || 100; // Default to 100 if role not found
      columns.push(
        { width: 10 }, // Role start time column
        { width: roleWidth }  // Role names column with specific width
      );
    });

    worksheet.columns = columns;

    // Freeze the first 3 columns (Show name, Date, Start time) and header row
    worksheet.views = [
      {
        state: 'frozen',
        xSplit: 3, // First 3 columns are frozen
        ySplit: 1, // Header row is frozen
        topLeftCell: 'D2', // First scrollable cell (column 4, row 2)
        activeCell: 'A1'
      }
    ];

    // Generate filename with month and year
    const filename = `Toewijzingen_${monthName.replace(' ', '_')}.xlsx`;

    // Write file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
    
    toast.success("Excel bestand gedownload met volledige styling! Kolommen zijn geordend volgens de volgorde in Functies beheren.");
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const monthName = currentDate.toLocaleString('nl-BE', { month: 'long', year: 'numeric' });

  // Calendar helper functions
  const getShowStatus = (show: any) => {
    const totalShifts = show.shifts.length;
    const assignedShifts = show.shifts.filter((s: any) => s.assignedPerson || s.isSecuAssigned).length;
    const shiftsWithoutAvailable = show.shifts.filter((s: any) => !s.assignedPerson && !s.isSecuAssigned && !s.hasAvailablePeople).length;

    if (assignedShifts === totalShifts) return 'complete'; // Green
    if (shiftsWithoutAvailable > 0) return 'critical'; // Red
    return 'partial'; // Orange
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-500';
      case 'partial': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  const getCalendarDays = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const startDate = subDays(start, getDay(start) === 0 ? 6 : getDay(start) - 1);
    const endDate = addDays(end, 7 - (getDay(end) === 0 ? 7 : getDay(end)));
    return eachDayOfInterval({ start: startDate, end: endDate });
  };

  const getShowsForDate = (date: Date) => {
    if (!assignmentData?.shows) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignmentData.shows.filter(show => show.date === dateStr);
  };

  if (!assignmentData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const { shows, stats } = assignmentData;

  return (
    <div className="space-y-8">
      {/* Header with Stats */}
      <div className="modern-card p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Personeelstoewijzingen</h2>
            <p className="text-gray-600">Beheer en bekijk personeelstoewijzingen voor {monthName}</p>
          </div>
          
          {/* View Toggle and Month Navigation */}
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'calendar' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
              >
                📅 Kalender
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                }`}
              >
                📋 Lijst
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-3 rounded-xl hover:opacity-80 transition-all duration-200 shadow-md hover:shadow-lg"
                style={{ backgroundColor: '#FAE682', color: '#161616' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-bold text-xl px-4" style={{ color: '#161616' }}>{monthName}</span>
              <button
                onClick={nextMonth}
                className="p-3 rounded-xl hover:opacity-80 transition-all duration-200 shadow-md hover:shadow-lg"
                style={{ backgroundColor: '#FAE682', color: '#161616' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Totaal Diensten</p>
                <p className="text-3xl font-bold text-blue-900">{stats.totalShifts}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Toegewezen</p>
                <p className="text-3xl font-bold text-green-900">{stats.assignedShifts}</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Niet Toegewezen</p>
                <p className="text-3xl font-bold text-red-900">{stats.unassignedShifts}</p>
              </div>
              <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Toewijzingspercentage</p>
                <p className="text-3xl font-bold text-purple-900">{stats.assignmentRate}%</p>
              </div>
              <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          {fairnessData && (
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl border border-indigo-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-600 text-sm font-medium">Eerlijkheidsscore</p>
                  <p className="text-3xl font-bold text-indigo-900">{fairnessData.metrics.fairnessScore}%</p>
                </div>
                <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mt-8">
          <button
            onClick={exportToExcel}
            disabled={!shows || shows.length === 0}
            className="btn-success flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Excel Export</span>
          </button>
          <button
            onClick={handleAutoAssign}
            disabled={isAssigning || !shows || shows.length === 0}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>{isAssigning ? "Toewijzen..." : "Automatisch Toewijzen"}</span>
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="modern-card p-8">
          <div className="grid grid-cols-7 gap-4 mb-4">
            {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(day => (
              <div key={day} className="text-center font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-4">
            {getCalendarDays().map((day, index) => {
              const dayShows = getShowsForDate(day);
              const isCurrentMonth = format(day, 'M') === format(currentDate, 'M');
              
              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 border rounded-lg transition-all duration-200 ${
                    isCurrentMonth 
                      ? 'bg-white border-gray-200 hover:border-gray-300' 
                      : 'bg-gray-50 border-gray-100 text-gray-400'
                  }`}
                >
                  <div className="text-sm font-medium mb-2">
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayShows.map(show => (
                      <div
                        key={show._id}
                        onClick={() => setSelectedShow(show)}
                        className={`text-xs p-1 rounded cursor-pointer hover:shadow-md transition-all duration-200 ${
                          getShowStatus(show) === 'complete' ? 'bg-green-100 text-green-800 hover:bg-green-200' :
                          getShowStatus(show) === 'partial' ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' :
                          'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        <div className="font-medium truncate">{show.name}</div>
                        <div className="opacity-75">{show.startTime}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {shows?.map((show) => (
            <div key={show._id} className="modern-card p-8 animate-fade-in-up">
            {/* Show Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-6 border-b border-gray-100">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{show.name}</h3>
                <div className="flex items-center space-x-4 text-gray-600">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium">
                      {(() => {
                        const [year, month, day] = show.date.split('-').map(Number);
                        const date = new Date(Date.UTC(year, month - 1, day));
                        const weekdays = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
                        const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
                        const weekday = weekdays[date.getUTCDay()];
                        const monthName = months[date.getUTCMonth()];
                        return `${weekday} ${day} ${monthName} ${year}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">{show.startTime}</span>
                  </div>
                </div>
              </div>
              
              {/* Show Stats */}
              <div className="flex items-center space-x-4 mt-4 md:mt-0">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{show.shifts.filter(s => s.assignedPerson || s.isSecuAssigned).length}</div>
                  <div className="text-xs text-gray-500">Toegewezen</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{show.shifts.filter(s => !s.assignedPerson && !s.isSecuAssigned).length}</div>
                  <div className="text-xs text-gray-500">Open</div>
                </div>
              </div>
            </div>

            {/* Shifts Grid */}
            <div className="grid gap-4">
              {show.shifts.map((shift) => (
                <div 
                  key={shift._id} 
                  className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                    shift.assignedPerson || shift.isSecuAssigned
                      ? 'border-green-200 bg-green-50' 
                      : shift.hasAvailablePeople
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-red-200 bg-red-50 ring-2 ring-red-100'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    {/* Shift Info */}
                    <div className="flex items-center space-x-4">
                      {shift.startTime && (
                        <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl text-white font-bold text-sm shadow-lg" style={{ backgroundColor: '#161616' }}>
                          <div className="text-xs opacity-75">START</div>
                          <div className="text-sm leading-none">{shift.startTime}</div>
                        </div>
                      )}
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">
                          {shift.role}
                          {shift.position && shift.peopleNeeded && shift.peopleNeeded > 1 && (
                            <span className="ml-2 text-sm font-normal text-gray-500">#{shift.position}</span>
                          )}
                        </h4>
                        {/* Status Badge */}
                        {shift.assignedPerson ? (
                          <div className="flex items-center space-x-2 mt-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-green-700 font-medium">Toegewezen aan {shift.assignedPerson.name}</span>
                          </div>
                        ) : shift.isSecuAssigned ? (
                          <div className="flex items-center space-x-2 mt-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-green-700 font-medium">Toegewezen aan SECU</span>
                          </div>
                        ) : shift.hasAvailablePeople ? (
                          <div className="flex items-center space-x-2 mt-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                            <span className="text-yellow-700 font-medium">Wacht op toewijzing</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 mt-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-red-700 font-bold">⚠️ GEEN BESCHIKBARE MENSEN</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Assignment Actions */}
                    <div className="flex items-center space-x-3">
                      {/* SECU Checkbox for FA roles */}
                      {shift.role === "FA" && (
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shift.isSecuAssigned || false}
                            onChange={() => handleSecuToggle(shift._id)}
                            disabled={assigningShifts.has(shift._id)}
                            className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2 disabled:opacity-50"
                          />
                          <span className="text-sm font-medium text-gray-700">SECU</span>
                        </label>
                      )}

                      {(shift.assignedPerson || shift.isSecuAssigned) && (
                        <button
                          onClick={() => shift.assignedPerson ? handleManualAssign(shift._id, null) : handleSecuToggle(shift._id)}
                          disabled={assigningShifts.has(shift._id)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {assigningShifts.has(shift._id) ? "Bezig..." : "Niet Toewijzen"}
                        </button>
                      )}
                      
                      {/* Admin Override Toggle */}
                      {!shift.assignedPerson && !shift.isSecuAssigned && (shift.allAvailablePeople && shift.allAvailablePeople.length > 0) && (
                        <button
                          onClick={() => toggleAdminOverride(shift._id)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg ${
                            showAdminOverride.has(shift._id)
                              ? 'bg-orange-500 text-white hover:bg-orange-600'
                              : 'bg-gray-500 text-white hover:bg-gray-600'
                          }`}
                        >
                          🔓 Admin Override
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Available People */}
                  {!shift.assignedPerson && !shift.isSecuAssigned && shift.availablePeople.length > 0 && !showAdminOverride.has(shift._id) && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>Beschikbare Mensen ({shift.availablePeople.length})</span>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {shift.availablePeople.map((person: any) => (
                          <div key={person._id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200">
                            <span className="font-medium text-gray-900">{person.name}</span>
                            <button
                              onClick={() => handleManualAssign(shift._id, person._id)}
                              disabled={assigningShifts.has(shift._id)}
                              className="px-3 py-1 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: '#161616' }}
                            >
                              {assigningShifts.has(shift._id) ? "Bezig..." : "Toewijzen"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Debug info - Always show when admin override is active */}
                  {showAdminOverride.has(shift._id) && (
                    <div className="mt-4 p-3 bg-yellow-100 rounded text-xs border border-yellow-300">
                      <strong>🔍 DEBUG:</strong> allAvailable: {shift.allAvailablePeople?.length || 0}, 
                      available: {shift.availablePeople?.length || 0}, 
                      hasAny: {shift.hasAnyAvailablePeople ? 'true' : 'false'}
                      {shift.allAvailablePeople && shift.allAvailablePeople.length > 0 && (
                        <div>People: {shift.allAvailablePeople.map((p: any) => `${p.name} (${p.roles.join(', ')})`).join(', ')}</div>
                      )}
                    </div>
                  )}

                  {/* Admin Override Available People */}
                  {!shift.assignedPerson && !shift.isSecuAssigned && showAdminOverride.has(shift._id) && shift.allAvailablePeople && shift.allAvailablePeople.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-orange-200">
                      <h5 className="text-sm font-bold text-orange-700 mb-3 flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>🔓 Admin Override - Alle Beschikbare Mensen ({shift.allAvailablePeople.length})</span>
                      </h5>
                      <div className="bg-orange-50 p-4 rounded-lg mb-4 border border-orange-200">
                        <p className="text-orange-800 text-sm">
                          <strong>Let op:</strong> Admin override modus actief. Je kunt elke beschikbare persoon toewijzen, 
                          ongeacht hun functie. Personen zonder de juiste functie zijn gemarkeerd met ⚠️.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {shift.allAvailablePeople.map((person: any) => {
                          const hasCorrectRole = person.roles.includes(shift.role);
                          return (
                            <div key={person._id} className={`flex justify-between items-center p-3 rounded-lg border transition-all duration-200 ${
                              hasCorrectRole 
                                ? 'bg-white border-gray-200 hover:border-gray-300' 
                                : 'bg-orange-50 border-orange-200 hover:border-orange-300'
                            }`}>
                              <div className="flex items-center space-x-2">
                                {!hasCorrectRole && <span className="text-orange-500">⚠️</span>}
                                <span className="font-medium text-gray-900">{person.name}</span>
                                {!hasCorrectRole && (
                                  <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                                    {person.roles.join(', ')}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleAdminOverrideAssign(shift._id, person._id)}
                                disabled={assigningShifts.has(shift._id)}
                                className={`px-3 py-1 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                                  hasCorrectRole ? 'bg-gray-800' : 'bg-orange-500'
                                }`}
                              >
                                {assigningShifts.has(shift._id) ? "Bezig..." : "Override Toewijzen"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Admin Override No People Available */}
                  {!shift.assignedPerson && !shift.isSecuAssigned && showAdminOverride.has(shift._id) && (!shift.allAvailablePeople || shift.allAvailablePeople.length === 0) && (
                    <div className="mt-6 pt-6 border-t border-orange-200">
                      <div className="flex items-center justify-center p-6 bg-orange-100 rounded-xl border-2 border-orange-200">
                        <div className="text-center">
                          <h6 className="text-lg font-bold text-orange-800 mb-2">🔓 Admin Override Actief</h6>
                          <p className="text-orange-600 text-sm">
                            Er zijn geen medewerkers beschikbaar voor deze dienst.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No Available People Warning */}
                  {!shift.assignedPerson && !shift.isSecuAssigned && shift.availablePeople.length === 0 && !shift.hasAnyAvailablePeople && !showAdminOverride.has(shift._id) && (
                    <div className="mt-6 pt-6 border-t border-red-200">
                      <div className="flex items-center justify-center p-6 bg-red-100 rounded-xl border-2 border-red-200">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </div>
                          <h6 className="text-lg font-bold text-red-800 mb-2">Geen Beschikbare Mensen</h6>
                          <p className="text-red-600 text-sm">
                            Er zijn geen medewerkers beschikbaar voor deze dienst. 
                            Controleer of mensen hun beschikbaarheid hebben aangegeven.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {shows?.length === 0 && (
          <div className="modern-card p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">Geen voorstellingen deze maand</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Er zijn geen voorstellingen gepland voor {monthName}
            </p>
          </div>
        )}
        </div>
      )}

      {/* Enhanced Show Details Modal */}
      {selectedShow && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-200">
                <div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-2">{selectedShow.name}</h3>
                  <div className="flex items-center space-x-4 text-gray-600">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium">
                        {(() => {
                          const [year, month, day] = selectedShow.date.split('-').map(Number);
                          const date = new Date(Date.UTC(year, month - 1, day));
                          const weekdays = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
                          const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
                          const weekday = weekdays[date.getUTCDay()];
                          const monthName = months[date.getUTCMonth()];
                          return `${weekday} ${day} ${monthName} ${year}`;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">{selectedShow.startTime}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {/* Show Stats */}
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{selectedShow.shifts.filter((s: any) => s.assignedPerson || s.isSecuAssigned).length}</div>
                      <div className="text-xs text-gray-500">Toegewezen</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{selectedShow.shifts.filter((s: any) => !s.assignedPerson && !s.isSecuAssigned).length}</div>
                      <div className="text-xs text-gray-500">Open</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedShow(null)}
                    className="text-gray-400 hover:text-gray-600 text-3xl font-light p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              {/* Shifts List */}
              <div className="space-y-6">
                {selectedShow.shifts.map((shift: any) => (
                  <div 
                    key={shift._id} 
                    className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                      shift.assignedPerson || shift.isSecuAssigned
                        ? 'border-green-200 bg-green-50' 
                        : shift.hasAvailablePeople
                          ? 'border-yellow-200 bg-yellow-50'
                          : 'border-red-200 bg-red-50 ring-2 ring-red-100'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                      {/* Shift Info */}
                      <div className="flex items-center space-x-4">
                        {shift.startTime && (
                          <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl text-white font-bold text-sm shadow-lg" style={{ backgroundColor: '#161616' }}>
                            <div className="text-xs opacity-75">START</div>
                            <div className="text-sm leading-none">{shift.startTime}</div>
                          </div>
                        )}
                        <div>
                          <h4 className="text-xl font-bold text-gray-900">
                            {shift.role}
                            {shift.position && shift.peopleNeeded && shift.peopleNeeded > 1 && (
                              <span className="ml-2 text-sm font-normal text-gray-500">#{shift.position}</span>
                            )}
                          </h4>
                          {/* Status Badge */}
                          {shift.assignedPerson ? (
                            <div className="flex items-center space-x-2 mt-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="text-green-700 font-medium">Toegewezen aan {shift.assignedPerson.name}</span>
                            </div>
                          ) : shift.isSecuAssigned ? (
                            <div className="flex items-center space-x-2 mt-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="text-green-700 font-medium">Toegewezen aan SECU</span>
                            </div>
                          ) : shift.hasAvailablePeople ? (
                            <div className="flex items-center space-x-2 mt-2">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                              <span className="text-yellow-700 font-medium">Wacht op toewijzing</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2 mt-2">
                              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                              <span className="text-red-700 font-bold">⚠️ GEEN BESCHIKBARE MENSEN</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Assignment Actions */}
                      <div className="flex items-center space-x-3">
                        {/* SECU Checkbox for FA roles */}
                        {shift.role === "FA" && (
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={shift.isSecuAssigned || false}
                              onChange={() => handleSecuToggle(shift._id)}
                              disabled={assigningShifts.has(shift._id)}
                              className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2 disabled:opacity-50"
                            />
                            <span className="text-sm font-medium text-gray-700">SECU</span>
                          </label>
                        )}

                        {(shift.assignedPerson || shift.isSecuAssigned) && (
                          <button
                            onClick={() => shift.assignedPerson ? handleManualAssign(shift._id, null) : handleSecuToggle(shift._id)}
                            disabled={assigningShifts.has(shift._id)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {assigningShifts.has(shift._id) ? "Bezig..." : "Niet Toewijzen"}
                          </button>
                        )}
                        
                        {/* Admin Override Toggle */}
                        {!shift.assignedPerson && !shift.isSecuAssigned && (shift.allAvailablePeople && shift.allAvailablePeople.length > 0) && (
                          <button
                            onClick={() => toggleAdminOverride(shift._id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg ${
                              showAdminOverride.has(shift._id)
                                ? 'bg-orange-500 text-white hover:bg-orange-600'
                                : 'bg-gray-500 text-white hover:bg-gray-600'
                            }`}
                          >
                            🔓 Admin Override
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Available People */}
                    {!shift.assignedPerson && !shift.isSecuAssigned && shift.availablePeople.length > 0 && !showAdminOverride.has(shift._id) && (
                      <div className="pt-4 border-t border-gray-200">
                        <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>
                            {shift.assignedPerson 
                              ? `Andere Beschikbare Mensen (${shift.availablePeople.length})`
                              : `Beschikbare Mensen (${shift.availablePeople.length})`
                            }
                          </span>
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {shift.availablePeople.map((person: any) => (
                            <div key={person._id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200">
                              <span className="font-medium text-gray-900">{person.name}</span>
                              <button
                                onClick={() => handleManualAssign(shift._id, person._id)}
                                disabled={assigningShifts.has(shift._id)}
                                className="px-3 py-1 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: '#161616' }}
                              >
                                {assigningShifts.has(shift._id) ? "Bezig..." : "Toewijzen"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Admin Override Available People */}
                    {!shift.assignedPerson && !shift.isSecuAssigned && showAdminOverride.has(shift._id) && shift.allAvailablePeople && shift.allAvailablePeople.length > 0 && (
                      <div className="pt-4 border-t border-orange-200">
                        <h5 className="text-sm font-bold text-orange-700 mb-3 flex items-center space-x-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span>🔓 Admin Override - Alle Beschikbare Mensen ({shift.allAvailablePeople.length})</span>
                        </h5>
                        <div className="bg-orange-50 p-4 rounded-lg mb-4 border border-orange-200">
                          <p className="text-orange-800 text-sm">
                            <strong>Let op:</strong> Admin override modus actief. Je kunt elke beschikbare persoon toewijzen, 
                            ongeacht hun functie. Personen zonder de juiste functie zijn gemarkeerd met ⚠️.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {shift.allAvailablePeople.map((person: any) => {
                            const hasCorrectRole = person.roles.includes(shift.role);
                            return (
                              <div key={person._id} className={`flex justify-between items-center p-3 rounded-lg border transition-all duration-200 ${
                                hasCorrectRole 
                                  ? 'bg-white border-gray-200 hover:border-gray-300' 
                                  : 'bg-orange-50 border-orange-200 hover:border-orange-300'
                              }`}>
                                <div className="flex items-center space-x-2">
                                  {!hasCorrectRole && <span className="text-orange-500">⚠️</span>}
                                  <span className="font-medium text-gray-900">{person.name}</span>
                                  {!hasCorrectRole && (
                                    <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">
                                      {person.roles.join(', ')}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleAdminOverrideAssign(shift._id, person._id)}
                                  disabled={assigningShifts.has(shift._id)}
                                  className={`px-3 py-1 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                                    hasCorrectRole ? 'bg-gray-800' : 'bg-orange-500'
                                  }`}
                                >
                                  {assigningShifts.has(shift._id) ? "Bezig..." : "Override Toewijzen"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* No Available People Warning */}
                    {!shift.assignedPerson && !shift.isSecuAssigned && shift.availablePeople.length === 0 && !shift.hasAnyAvailablePeople && !showAdminOverride.has(shift._id) && (
                      <div className="pt-4 border-t border-red-200">
                        <div className="flex items-center justify-center p-4 bg-red-100 rounded-xl border-2 border-red-200">
                          <div className="text-center">
                            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            </div>
                            <h6 className="text-sm font-bold text-red-800 mb-1">Geen Beschikbare Mensen</h6>
                            <p className="text-red-600 text-xs">
                              Er zijn geen medewerkers beschikbaar voor deze dienst.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
