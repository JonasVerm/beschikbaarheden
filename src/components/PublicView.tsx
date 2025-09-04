import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { MessageForm } from "./MessageForm";

type GroupedShift = {
  _id: Id<"shifts">;
  role: string;
  availability: boolean | null; // null = no response, true = available, false = not available
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

type CalendarDay = {
  date: Date;
  dateStr: string;
  day: number;
  isCurrentMonth: boolean;
  shows: ShowWithShifts[];
};

export function PublicView() {
  const [selectedPersonId, setSelectedPersonId] = useState<Id<"people"> | null>(null);
  const [pendingPersonId, setPendingPersonId] = useState<Id<"people"> | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShow, setSelectedShow] = useState<ShowWithShifts | null>(null);
  const [optimisticAvailability, setOptimisticAvailability] = useState<Map<Id<"shifts">, boolean | null>>(new Map());
  const [forceUpdate, setForceUpdate] = useState(0);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [isMarkingUnavailable, setIsMarkingUnavailable] = useState(false);
  
  const peopleByGroup = useQuery(api.groups.getPeopleByGroup);
  const roles = useQuery(api.roles.listActive);
  const shifts = useQuery(
    api.shifts.getAllShowsForPerson,
    selectedPersonId
      ? {
          personId: selectedPersonId,
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
        }
      : "skip"
  );

  // Debug logging
  console.log("Selected person ID:", selectedPersonId);
  console.log("Shifts data:", shifts);
  console.log("Current date:", currentDate);

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
      
      // Debug logging
      if (optimisticAvailability.has(shift._id)) {
        console.log(`Using optimistic availability for shift ${shift._id}:`, optimisticAvailability.get(shift._id));
      }

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

      // Update show-level unresponded status
      if (shift.hasUnrespondedShifts) {
        show.hasUnrespondedShifts = true;
      }
    });
    
    // Group shows by date and sort by start time
    showMap.forEach(show => {
      const dateKey = show.date;
      if (!showsByDate.has(dateKey)) {
        showsByDate.set(dateKey, []);
      }
      showsByDate.get(dateKey)!.push(show);
    });
    
    // Sort shows within each date by start time
    showsByDate.forEach((shows, dateKey) => {
      shows.sort((a, b) => {
        // Convert time strings to comparable format (HH:MM -> HHMM as number)
        const timeA = parseInt(a.startTime.replace(':', ''));
        const timeB = parseInt(b.startTime.replace(':', ''));
        return timeA - timeB;
      });
    });
  }

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    // Adjust to start from Monday (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday (0), go back 6 days to Monday
    startDate.setDate(startDate.getDate() - daysToSubtract);
    
    const days = [];
    const current = new Date(startDate);
    
    // Generate 6 weeks (42 days) to fill the calendar grid
    for (let i = 0; i < 42; i++) {
      // Use local date string to match the database format
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const isCurrentMonth = current.getMonth() === currentDate.getMonth();
      const dayShows = showsByDate.get(dateStr) || [];
      
      days.push({
        date: new Date(current.getFullYear(), current.getMonth(), current.getDate()),
        dateStr,
        day: current.getDate(),
        isCurrentMonth,
        shows: dayShows
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  
  const setAvailability = useMutation(api.availability.setAvailability);
  const clearAvailability = useMutation(api.availability.clearAvailability);
  const markRestAsUnavailable = useMutation(api.availability.markRestAsUnavailable);

  // Helper function to get first name from full name
  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0].toLowerCase();
  };

  // Handle password verification
  const handlePasswordVerification = () => {
    if (!pendingPersonId) return;
    
    const pendingPerson = peopleByGroup?.flatMap(g => g.people).find(p => p._id === pendingPersonId);
    if (!pendingPerson) return;
    
    const expectedFirstName = getFirstName(pendingPerson.name);
    const enteredPassword = passwordInput.toLowerCase().trim();
    
    if (enteredPassword === expectedFirstName) {
      setSelectedPersonId(pendingPersonId);
      setPendingPersonId(null);
      setPasswordInput("");
      setOptimisticAvailability(new Map());
    } else {
      alert("Onjuiste naam. Probeer opnieuw.");
      setPasswordInput("");
    }
  };

  // Handle person selection (now shows password prompt)
  const handlePersonSelection = (personId: Id<"people">) => {
    setPendingPersonId(personId);
    setPasswordInput("");
  };

  const handleAvailabilityChange = async (shiftId: Id<"shifts">, newStatus: boolean | null) => {
    console.log("handleAvailabilityChange called", { shiftId, newStatus, selectedPersonId });
    
    if (!selectedPersonId) {
      console.log("No selected person ID");
      return;
    }
    
    // Find the shift to get its role and all related shifts
    const currentShift = shifts?.find(s => s._id === shiftId);
    if (!currentShift) {
      console.log("Current shift not found");
      return;
    }
    
    // Check if availability is open
    if (currentShift.availabilityStatus !== 'open') {
      console.log("Availability is not open for this shift");
      return;
    }
    
    console.log("Current shift found:", currentShift);
    console.log("Setting availability to:", newStatus);
    
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
    setForceUpdate(prev => prev + 1);
    
    console.log("Updated optimistic availability:", newOptimisticAvailability);
    
    try {
      if (newStatus === null) {
        await clearAvailability({
          personId: selectedPersonId,
          shiftId,
        });
        console.log(`Availability cleared for shift ${shiftId}`);
      } else {
        await setAvailability({
          personId: selectedPersonId,
          shiftId,
          available: newStatus,
        });
        console.log(`Availability set to ${newStatus} for shift ${shiftId}`);
      }
      
      // Don't clear optimistic state automatically - let the database update refresh naturally

    } catch (error) {
      console.error("Error setting availability:", error);
      
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
    setOptimisticAvailability(new Map()); // Clear optimistic state when changing months
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setOptimisticAvailability(new Map()); // Clear optimistic state when changing months
  };

  const monthName = currentDate.toLocaleString('nl-BE', { month: 'long', year: 'numeric' });
  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  const handleMarkRestAsUnavailable = async () => {
    if (!selectedPersonId) return;
    const confirmed = confirm("Weet je zeker dat je alle diensten waar je nog geen reactie op hebt gegeven wilt markeren als 'niet beschikbaar'?");
    if (!confirmed) return;
    setIsMarkingUnavailable(true);
    try {
      const result = await markRestAsUnavailable({
        personId: selectedPersonId,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      });
      alert(result.markedUnavailable > 0 ? `${result.markedUnavailable} diensten gemarkeerd als niet beschikbaar.` : "Geen diensten gevonden.");
      setOptimisticAvailability(new Map());
      setForceUpdate(prev => prev + 1);
    } catch (error) {
      alert("Fout opgetreden. Probeer opnieuw.");
    } finally {
      setIsMarkingUnavailable(false);
    }
  };

  // Helper function to get show status color and style
  const getShowStyle = (show: ShowWithShifts) => {
    if (show.availabilityStatus === 'closed' || show.availabilityStatus === 'not_yet_open') {
      return {
        backgroundColor: '#9CA3AF', // Gray
        opacity: 0.6,
        cursor: 'default'
      };
    }
    
    if (show.hasUnrespondedShifts) {
      return {
        backgroundColor: '#EF4444', // Red for attention
        animation: 'pulse 2s infinite'
      };
    }
    
    return {
      backgroundColor: '#161616' // Default black
    };
  };

  const getShowStatusText = (show: ShowWithShifts) => {
    if (show.availabilityStatus === 'closed') {
      return 'Gesloten';
    }
    if (show.availabilityStatus === 'not_yet_open') {
      return 'Nog niet open';
    }
    if (show.hasUnrespondedShifts) {
      return 'Reactie vereist!';
    }
    return 'Open';
  };

  // Show password verification screen
  if (pendingPersonId) {
    const pendingPerson = peopleByGroup?.flatMap(g => g.people).find(p => p._id === pendingPersonId);
    
    return (
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="text-center mb-6 md:mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="https://scontent-bru2-1.xx.fbcdn.net/v/t39.30808-6/279177762_10166050644655257_1345365900563871413_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=iUV3ho7z1BIQ7kNvwFFs92S&_nc_oc=Adk1LLXRkrptrlboOl52uj6B1ARWGMN8K7e5krdciztoOFUF845Sl_QSmKuENJdv2lo&_nc_zt=23&_nc_ht=scontent-bru2-1.xx&_nc_gid=bEg0lBSMmykHPEf7vqzysg&oh=00_AfUJ1H403onQn_u7sPuT3Eo546EMcGdK2UkOezxj-mu4Iw&oe=68BA284B"
                alt="Capitole Gent Logo"
                className="h-12 md:h-16 w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <h2 className="text-xl md:text-2xl font-bold mb-2" style={{ color: '#161616' }}>Bevestig je identiteit</h2>
            <p className="text-gray-600 mb-4 md:mb-6 text-sm md:text-base">
              Je hebt <span className="font-semibold">{pendingPerson?.name}</span> geselecteerd.
              <br />
              Voer je voornaam in om te bevestigen.
            </p>
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordVerification(); }} className="space-y-4 md:space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Voornaam
              </label>
              <input
                type="text"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-4 md:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 text-lg md:text-base"
                placeholder="Voer je voornaam in..."
                autoFocus
                required
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                className="flex-1 py-4 md:py-3 px-6 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg text-lg md:text-base"
                style={{ backgroundColor: '#FAE682', color: '#161616' }}
              >
                Bevestigen
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingPersonId(null);
                  setPasswordInput("");
                }}
                className="flex-1 py-4 md:py-3 px-6 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all duration-200 text-lg md:text-base"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!selectedPersonId) {
    return (
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="https://scontent-bru2-1.xx.fbcdn.net/v/t39.30808-6/279177762_10166050644655257_1345365900563871413_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=iUV3ho7z1BIQ7kNvwFFs92S&_nc_oc=Adk1LLXRkrptrlboOl52uj6B1ARWGMN8K7e5krdciztoOFUF845Sl_QSmKuENJdv2lo&_nc_zt=23&_nc_ht=scontent-bru2-1.xx&_nc_gid=bEg0lBSMmykHPEf7vqzysg&oh=00_AfUJ1H403onQn_u7sPuT3Eo546EMcGdK2UkOezxj-mu4Iw&oe=68BA284B"
                alt="Capitole Gent Logo"
                className="h-16 md:h-20 w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: '#161616' }}>Selecteer je naam</h2>
          </div>
          
          {peopleByGroup && peopleByGroup.length > 0 ? (
            <div className="space-y-6">
              {peopleByGroup.map((groupData) => (
                <div key={groupData.group._id || 'ungrouped'}>
                  <div className="flex items-center space-x-3 mb-4">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: groupData.group.color }}
                    >
                      {groupData.group.displayName.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="text-lg font-semibold" style={{ color: '#161616' }}>
                      {groupData.group.displayName}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {groupData.people
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((person) => (
                        <button
                          key={person._id}
                          onClick={() => handlePersonSelection(person._id)}
                          className="p-6 md:p-4 text-center border-2 rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group"
                          style={{ borderColor: '#FAE682', backgroundColor: '#fefefe' }}
                        >
                          <div className="font-semibold text-lg md:text-base group-hover:text-xl md:group-hover:text-lg transition-all duration-200" style={{ color: '#161616' }}>
                            {person.name}
                          </div>
                        </button>
                      ))}
                  </div>
                  {groupData.people.length === 0 && (
                    <p className="text-gray-500 italic text-center py-4">Geen medewerkers in deze groep</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Geen medewerkers gevonden</p>
              <p className="text-gray-400 text-sm mt-2">Neem contact op met een beheerder</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedPerson = peopleByGroup?.flatMap(g => g.people).find(p => p._id === selectedPersonId);

  if (selectedShow) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6 md:mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: '#161616' }}>{selectedShow.name}</h2>
              <div className="flex items-center space-x-2 text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">
                  {(() => {
                    const [year, month, day] = selectedShow.date.split('-').map(Number);
                    // Use UTC to avoid timezone issues
                    const date = new Date(Date.UTC(year, month - 1, day));
                    
                    const weekdays = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
                    const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
                    
                    const weekday = weekdays[date.getUTCDay()];
                    const monthName = months[date.getUTCMonth()];
                    
                    return `${weekday} ${day} ${monthName} ${year}`;
                  })()} om {selectedShow.startTime}
                </span>
              </div>
              {/* Show availability status */}
              <div className="mt-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedShow.availabilityStatus === 'open' 
                    ? selectedShow.hasUnrespondedShifts 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {getShowStatusText(selectedShow)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedShow(null)}
              className="w-full md:w-auto px-4 md:px-6 py-4 md:py-3 rounded-xl font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md text-base md:text-base"
              style={{ backgroundColor: '#FAE682', color: '#161616' }}
            >
              <span className="md:hidden">← Terug</span>
              <span className="hidden md:inline">← Terug naar Kalender</span>
            </button>
          </div>

          <div className="space-y-3">
            {selectedShow.shifts.map((shift) => (
              <div key={shift._id} className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 gap-4 md:gap-0 ${
                shift.availabilityStatus !== 'open' ? 'opacity-60' : ''
              }`}>
                <div className="flex items-center space-x-4 w-full md:w-auto">
                  {shift.startTime && (
                    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg text-white font-bold text-sm" style={{ backgroundColor: '#161616' }}>
                      <div className="text-xs opacity-75">START</div>
                      <div className="text-lg leading-none">{shift.startTime}</div>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-xl md:text-lg" style={{ color: '#161616' }}>
                      {shift.role}
                      {shift.hasUnrespondedShifts && shift.availabilityStatus === 'open' && (
                        <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full animate-pulse">
                          Reactie vereist!
                        </span>
                      )}
                    </div>
                    {shift.totalPositions && shift.totalPositions > 1 && (
                      <div className="text-sm text-gray-500 mt-1">
                        {shift.totalPositions} posities beschikbaar
                      </div>
                    )}
                    {shift.availabilityStatus !== 'open' && (
                      <div className="text-sm text-gray-500 mt-1">
                        {shift.availabilityStatus === 'closed' ? 'Beschikbaarheid gesloten' : 'Beschikbaarheid nog niet open'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-center md:justify-end space-x-2 md:space-x-3 w-full md:w-auto">
                  {shift.availabilityStatus === 'open' ? (
                    <>
                      {(() => {
                        const displayAvailability = optimisticAvailability.has(shift._id) 
                          ? optimisticAvailability.get(shift._id) 
                          : shift.availability;
                        
                        return (
                          <div className="flex items-center space-x-2 md:space-x-3">
                            {/* Available Button */}
                            <button
                              onClick={() => handleAvailabilityChange(shift._id, displayAvailability === true ? null : true)}
                              className={`relative w-14 h-14 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-lg ${
                                displayAvailability === true
                                  ? "text-white shadow-green-200"
                                  : "border-2 border-gray-200 hover:border-green-300 bg-white hover:bg-green-50"
                              }`}
                              style={displayAvailability === true ? { backgroundColor: '#22c55e' } : {}}
                              title={displayAvailability === true ? "Beschikbaar - klik om te wijzigen" : "Klik om beschikbaar te zijn"}
                            >
                              <svg className="w-7 h-7 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>

                            {/* Not Available Button */}
                            <button
                              onClick={() => handleAvailabilityChange(shift._id, displayAvailability === false ? null : false)}
                              className={`relative w-14 h-14 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-lg ${
                                displayAvailability === false
                                  ? "text-white shadow-red-200"
                                  : "border-2 border-gray-200 hover:border-red-300 bg-white hover:bg-red-50"
                              }`}
                              style={displayAvailability === false ? { backgroundColor: '#ef4444' } : {}}
                              title={displayAvailability === false ? "Niet beschikbaar - klik om te wijzigen" : "Klik om niet beschikbaar te zijn"}
                            >
                              <svg className="w-7 h-7 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        );
                      })()}
                      <div className="text-sm md:text-sm min-w-[100px] md:min-w-[120px] text-center md:text-left">
                        {(() => {
                          const displayAvailability = optimisticAvailability.has(shift._id) 
                            ? optimisticAvailability.get(shift._id) 
                            : shift.availability;
                          
                          if (displayAvailability === true) {
                            return <span className="text-green-600 font-medium">Beschikbaar</span>;
                          } else if (displayAvailability === false) {
                            return <span className="text-red-600 font-medium">Niet beschikbaar</span>;
                          } else {
                            return <span className="text-gray-500">Geen reactie</span>;
                          }
                        })()}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500 min-w-[120px]">
                      {shift.availabilityStatus === 'closed' ? 'Gesloten' : 'Nog niet open'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: '#161616' }}>{selectedPerson?.name}</h2>
            <div className="flex items-center space-x-2 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">Functies: {selectedPerson?.roles.join(", ")}</span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <button
              onClick={handleMarkRestAsUnavailable}
              disabled={isMarkingUnavailable}
              className="w-full md:w-auto px-3 md:px-4 py-3 md:py-2 rounded-lg font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md text-sm md:text-sm bg-red-600 text-white flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="md:hidden">{isMarkingUnavailable ? "Bezig..." : "Rest Niet Beschikbaar"}</span>
              <span className="hidden md:inline">{isMarkingUnavailable ? "Bezig..." : "Rest Markeren als Niet Beschikbaar"}</span>
            </button>
            <button
              onClick={() => setShowMessageForm(true)}
              className="w-full md:w-auto px-3 md:px-4 py-3 md:py-2 rounded-lg font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md text-sm md:text-sm bg-blue-600 text-white flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="md:hidden">Bericht</span>
              <span className="hidden md:inline">Bericht versturen</span>
            </button>
            <button
              onClick={() => {
                setSelectedPersonId(null);
                setOptimisticAvailability(new Map()); // Clear optimistic state when changing person
              }}
              className="w-full md:w-auto px-3 md:px-4 py-3 md:py-2 rounded-lg font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md text-sm md:text-sm"
              style={{ backgroundColor: '#FAE682', color: '#161616' }}
            >
              <span className="md:hidden">Wijzigen</span>
              <span className="hidden md:inline">Persoon Wijzigen</span>
            </button>
          </div>
        </div>
        
        <div className="flex justify-between items-center mb-6 md:mb-8 gap-2">
          <button
            onClick={prevMonth}
            className="px-3 md:px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base flex-shrink-0"
            style={{ backgroundColor: '#161616' }}
          >
            <span className="md:hidden">←</span>
            <span className="hidden md:inline">← Vorige</span>
          </button>
          <h3 className="text-lg md:text-2xl font-bold text-center flex-1 px-2" style={{ color: '#161616' }}>{monthName}</h3>
          <button
            onClick={nextMonth}
            className="px-3 md:px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base flex-shrink-0"
            style={{ backgroundColor: '#161616' }}
          >
            <span className="md:hidden">→</span>
            <span className="hidden md:inline">Volgende →</span>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4 text-xs md:text-sm">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div key={day} className="p-1 md:p-2 text-center font-semibold text-gray-600 text-xs md:text-sm" style={{ backgroundColor: '#FAE682' }}>
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {calendarDays.map((calDay, index) => (
            <div
              key={index}
              className={`min-h-[80px] md:min-h-[120px] p-1 md:p-2 border-2 transition-all duration-200 ${
                !calDay.isCurrentMonth 
                  ? 'bg-gray-100 text-gray-400 border-gray-200' 
                  : calDay.shows.length > 0 
                    ? 'bg-white border-yellow-400 shadow-lg hover:shadow-xl' 
                    : 'bg-gray-100 text-gray-400 border-gray-200'
              }`}
              style={calDay.isCurrentMonth && calDay.shows.length > 0 ? { 
                backgroundColor: '#FAE682', 
                borderColor: '#F59E0B',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
              } : {}}
            >
              <div className={`font-semibold mb-1 ${
                calDay.isCurrentMonth && calDay.shows.length > 0 
                  ? 'text-black' 
                  : calDay.isCurrentMonth 
                    ? 'text-gray-400' 
                    : 'text-gray-400'
              }`}>
                {calDay.day}
              </div>
              <div className="space-y-1">
                {calDay.shows.map((show) => (
                  <button
                    key={show._id}
                    onClick={() => setSelectedShow(show)}
                    className="w-full text-left p-1 md:p-2 text-xs text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
                    style={getShowStyle(show)}
                    disabled={show.availabilityStatus === 'closed' || show.availabilityStatus === 'not_yet_open'}
                  >
                    <div className="font-medium truncate text-xs md:text-sm hidden md:block">{show.name}</div>
                    <div className="flex items-center justify-between mt-1 hidden md:flex">
                      <span className="text-xs" style={{ color: '#FAE682' }}>{show.startTime}</span>
                      <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${
                        show.availabilityStatus === 'open' 
                          ? show.hasUnrespondedShifts 
                            ? 'bg-red-400 animate-pulse' 
                            : 'bg-green-400'
                          : 'bg-gray-400'
                      }`}></div>
                    </div>
                    <div className="text-xs opacity-75 mt-1 hidden md:block">
                      {getShowStatusText(show)}
                    </div>
                    {/* Mobile: Just show colored indicator */}
                    <div className="md:hidden w-full h-full flex items-center justify-center">
                      <div className={`w-4 h-4 rounded-full ${
                        show.availabilityStatus === 'open' 
                          ? show.hasUnrespondedShifts 
                            ? 'bg-red-400 animate-pulse' 
                            : 'bg-green-400'
                          : 'bg-gray-400'
                      }`}></div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message Form Modal */}
      {showMessageForm && selectedPerson && (
        <MessageForm
          personId={selectedPersonId}
          personName={selectedPerson.name}
          onClose={() => setShowMessageForm(false)}
        />
      )}
    </div>
  );
}
