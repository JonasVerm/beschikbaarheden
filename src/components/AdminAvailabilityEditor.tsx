import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { downloadICSFile, CalendarData } from "../utils/icsGenerator";

type GroupedShift = {
  _id: Id<"shifts">;
  role: string;
  availability: boolean | null;
  availabilityStatus: 'open' | 'closed' | 'not_yet_open';
  hasUnrespondedShifts: boolean;
  startTime?: string;
  totalPositions?: number;
  allShiftIds?: Id<"shifts">[];
};

type ShowWithShifts = {
  _id: Id<"shows">;
  name: string;
  date: string;
  startTime: string;
  shifts: GroupedShift[];
  availabilityStatus?: 'open' | 'closed' | 'not_yet_open';
  hasUnrespondedShifts?: boolean;
};

export function AdminAvailabilityEditor() {
  const [selectedPersonId, setSelectedPersonId] = useState<Id<"people"> | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [optimisticAvailability, setOptimisticAvailability] = useState<Map<Id<"shifts">, boolean | null>>(new Map());
  const [isDownloadingCalendar, setIsDownloadingCalendar] = useState(false);

  const peopleByGroup = useQuery(api.groups.getPeopleByGroup);
  const currentUser = useQuery(api.auth.loggedInUser);
  const shifts = useQuery(
    api.adminAvailability.adminGetAllShowsForPerson,
    selectedPersonId
      ? {
          personId: selectedPersonId,
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
        }
      : "skip"
  );

  const calendarData = useQuery(
    api.calendarExport.getAssignedShiftsForCalendar,
    selectedPersonId
      ? {
          personId: selectedPersonId,
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
        }
      : "skip"
  );

  const adminSetAvailability = useMutation(api.availability.adminSetAvailability);
  const adminClearAvailability = useMutation(api.availability.adminClearAvailability);

  const handleDownloadCalendar = async () => {
    if (!selectedPersonId || !calendarData) return;
    
    setIsDownloadingCalendar(true);
    try {
      if (calendarData.shifts.length === 0) {
        toast.info("Geen toegewezen diensten gevonden voor deze maand");
        return;
      }
      
      downloadICSFile(calendarData as CalendarData);
      toast.success(`Kalender gedownload voor ${calendarData.person.name}`);
    } catch (error) {
      console.error("Error downloading calendar:", error);
      toast.error("Fout bij downloaden van kalender");
    } finally {
      setIsDownloadingCalendar(false);
    }
  };

  const handleAvailabilityChange = async (shiftId: Id<"shifts">, newStatus: boolean | null) => {
    if (!selectedPersonId) return;
    
    const currentShift = shifts?.find(s => s._id === shiftId);
    if (!currentShift) return;
    
    // Optimistically update the UI for all shifts of the same role
    const newOptimisticAvailability = new Map(optimisticAvailability);
    if (currentShift.allShiftIds) {
      currentShift.allShiftIds.forEach((id: Id<"shifts">) => {
        newOptimisticAvailability.set(id, newStatus);
      });
    } else {
      newOptimisticAvailability.set(shiftId, newStatus);
    }
    setOptimisticAvailability(newOptimisticAvailability);
    
    try {
      if (newStatus === null) {
        await adminClearAvailability({
          personId: selectedPersonId,
          shiftId,
        });
        toast.success("Beschikbaarheid gewist (admin override)");
      } else {
        await adminSetAvailability({
          personId: selectedPersonId,
          shiftId,
          available: newStatus,
        });
        toast.success(`Beschikbaarheid ingesteld op ${newStatus ? 'beschikbaar' : 'niet beschikbaar'} (admin override)`);
      }
    } catch (error) {
      console.error("Error setting availability:", error);
      toast.error("Fout bij instellen beschikbaarheid");
      
      // Revert optimistic update on error
      setOptimisticAvailability(prev => {
        const reverted = new Map(prev);
        if (currentShift.allShiftIds) {
          currentShift.allShiftIds.forEach((id: Id<"shifts">) => reverted.delete(id));
        } else {
          reverted.delete(shiftId);
        }
        return reverted;
      });
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setOptimisticAvailability(new Map());
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setOptimisticAvailability(new Map());
  };

  const monthName = currentDate.toLocaleString('nl-BE', { month: 'long', year: 'numeric' });

  // Group shifts by show and then by date
  const showsByDate = new Map<string, ShowWithShifts[]>();
  if (shifts) {
    const showMap = new Map<Id<"shows">, ShowWithShifts>();
    
    shifts.forEach(shift => {
      const showId = shift.show._id;
      if (!showMap.has(showId)) {
        showMap.set(showId, {
          _id: showId,
          name: shift.show.name,
          date: shift.show.date,
          startTime: shift.show.startTime,
          shifts: [],
          availabilityStatus: shift.availabilityStatus,
          hasUnrespondedShifts: false
        });
      }
      
      // Use optimistic availability if available, otherwise use the database value
      const availability = optimisticAvailability.has(shift._id) 
        ? optimisticAvailability.get(shift._id) 
        : shift.availability;

      const show = showMap.get(showId)!;
      show.shifts.push({
        _id: shift._id,
        role: shift.role,
        availability: availability,
        availabilityStatus: shift.availabilityStatus,
        hasUnrespondedShifts: shift.hasUnrespondedShifts,
        startTime: shift.startTime,
        totalPositions: shift.totalPositions,
        allShiftIds: shift.allShiftIds,
      });
      
      if (shift.hasUnrespondedShifts) {
        show.hasUnrespondedShifts = true;
      }
    });

    // Group shows by date
    showMap.forEach(show => {
      if (!showsByDate.has(show.date)) {
        showsByDate.set(show.date, []);
      }
      showsByDate.get(show.date)!.push(show);
    });
  }

  const getStatusBadge = (status: 'open' | 'closed' | 'not_yet_open') => {
    switch (status) {
      case 'open':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Open</span>;
      case 'closed':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Gesloten</span>;
      case 'not_yet_open':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Nog niet open</span>;
      default:
        return null;
    }
  };

  const selectedPerson = peopleByGroup?.flatMap(g => g.people).find(p => p._id === selectedPersonId);
  const isSuperAdmin = currentUser?.adminRole === 'superadmin';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="modern-card p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Beschikbaarheid Bewerken</h2>
            <p className="text-gray-600">Bewerk beschikbaarheid van medewerkers, ook na sluitingsdatum</p>
          </div>
          
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-3 rounded-xl hover:opacity-80 transition-all duration-200 shadow-md hover:shadow-lg bg-brand-secondary text-brand-primary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-bold text-xl px-4 text-brand-primary">{monthName}</span>
            <button
              onClick={nextMonth}
              className="p-3 rounded-xl hover:opacity-80 transition-all duration-200 shadow-md hover:shadow-lg bg-brand-secondary text-brand-primary"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Person Selection */}
        <div className="mt-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-3">Selecteer Medewerker</label>
              <select
                value={selectedPersonId || ""}
                onChange={(e) => {
                  setSelectedPersonId(e.target.value ? e.target.value as Id<"people"> : null);
                  setOptimisticAvailability(new Map());
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Kies een medewerker --</option>
                {peopleByGroup?.map((groupData) => (
                  <optgroup key={groupData.group._id} label={groupData.group.displayName}>
                    {groupData.people.map((person) => (
                      <option key={person._id} value={person._id}>
                        {person.name} ({person.roles.join(', ')})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            
            {/* Calendar Download Button - Only for Super Admins */}
            {isSuperAdmin && selectedPersonId && selectedPerson && (
              <button
                onClick={handleDownloadCalendar}
                disabled={isDownloadingCalendar}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{isDownloadingCalendar ? 'Downloaden...' : 'Download Kalender'}</span>
              </button>
            )}
          </div>
          
          {isSuperAdmin && selectedPersonId && selectedPerson && (
            <p className="text-sm text-gray-500 mt-2">
              📅 Download toegewezen diensten als ICS-bestand voor import in Google Calendar
            </p>
          )}
        </div>
      </div>

      {/* Shows List */}
      {selectedPersonId && (
        <div className="space-y-6">
          {Array.from(showsByDate.entries())
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, shows]) => (
              <div key={date} className="modern-card p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">
                  {(() => {
                    const [year, month, day] = date.split('-').map(Number);
                    const dateObj = new Date(Date.UTC(year, month - 1, day));
                    const weekdays = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
                    const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
                    const weekday = weekdays[dateObj.getUTCDay()];
                    const monthName = months[dateObj.getUTCMonth()];
                    return `${weekday} ${day} ${monthName} ${year}`;
                  })()}
                </h3>
                
                {shows.map((show) => (
                  <div key={show._id} className="mb-8 last:mb-0">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">{show.name}</h4>
                        <p className="text-gray-600">Start: {show.startTime}</p>
                      </div>
                      {getStatusBadge(show.availabilityStatus || 'open')}
                    </div>
                    
                    <div className="grid gap-4">
                      {show.shifts.map((shift) => {
                        const availability = optimisticAvailability.has(shift._id) 
                          ? optimisticAvailability.get(shift._id) 
                          : shift.availability;
                        
                        return (
                          <div 
                            key={shift._id} 
                            className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                              availability === true
                                ? 'border-green-200 bg-green-50' 
                                : availability === false
                                  ? 'border-red-200 bg-red-50'
                                  : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                {shift.startTime && (
                                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg text-white font-bold text-xs shadow-md" style={{ backgroundColor: '#161616' }}>
                                    <div className="text-xs opacity-75">START</div>
                                    <div className="text-xs leading-none">{shift.startTime}</div>
                                  </div>
                                )}
                                <div>
                                  <h5 className="font-semibold text-gray-900">
                                    {shift.role}
                                    {shift.totalPositions && shift.totalPositions > 1 && (
                                      <span className="ml-2 text-sm font-normal text-gray-500">({shift.totalPositions} posities)</span>
                                    )}
                                  </h5>
                                  <div className="flex items-center space-x-2 mt-1">
                                    {shift.availabilityStatus === 'closed' && (
                                      <span className="text-orange-600 text-sm font-medium">⚠️ Normaal gesloten voor wijzigingen</span>
                                    )}
                                    {shift.availabilityStatus === 'not_yet_open' && (
                                      <span className="text-yellow-600 text-sm font-medium">⏳ Nog niet geopend</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Availability Controls */}
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleAvailabilityChange(shift._id, true)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    availability === true
                                      ? 'bg-green-500 text-white shadow-md'
                                      : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                                  }`}
                                >
                                  ✓ Beschikbaar
                                </button>
                                <button
                                  onClick={() => handleAvailabilityChange(shift._id, false)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    availability === false
                                      ? 'bg-red-500 text-white shadow-md'
                                      : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                                  }`}
                                >
                                  ✗ Niet Beschikbaar
                                </button>
                                <button
                                  onClick={() => handleAvailabilityChange(shift._id, null)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    availability === null
                                      ? 'bg-gray-500 text-white shadow-md'
                                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                  }`}
                                >
                                  ? Geen Reactie
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          
          {/* Empty State */}
          {showsByDate.size === 0 && (
            <div className="modern-card p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">Geen voorstellingen gevonden</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Er zijn geen voorstellingen voor deze medewerker in {monthName}
              </p>
            </div>
          )}
        </div>
      )}

      {/* No Person Selected */}
      {!selectedPersonId && (
        <div className="modern-card p-12 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-3">Selecteer een medewerker</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Kies een medewerker uit de lijst hierboven om hun beschikbaarheid te bekijken en bewerken.
          </p>
        </div>
      )}
    </div>
  );
}
