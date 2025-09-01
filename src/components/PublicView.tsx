import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

type GroupedShift = {
  _id: Id<"shifts">;
  role: string;
  availability: boolean | null; // null = no response, true = available, false = not available
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
  
  const peopleByGroup = useQuery(api.groups.getPeopleByGroup);
  const roles = useQuery(api.roles.listActive);
  const shifts = useQuery(
    api.shifts.getAvailableForPerson,
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
          shifts: []
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

      showMap.get(showId)!.shifts.push({
        _id: shift._id,
        role: shift.role,
        availability: availability,
        startTime: shift.startTime,
        totalPositions: shift.totalPositions,
        allShiftIds: shift.allShiftIds,
      });
    });
    
    // Group shows by date
    showMap.forEach(show => {
      const dateKey = show.date;
      if (!showsByDate.has(dateKey)) {
        showsByDate.set(dateKey, []);
      }
      showsByDate.get(dateKey)!.push(show);
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

  // Show password verification screen
  if (pendingPersonId) {
    const pendingPerson = peopleByGroup?.flatMap(g => g.people).find(p => p._id === pendingPersonId);
    
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="https://scontent-bru2-1.xx.fbcdn.net/v/t39.30808-6/279177762_10166050644655257_1345365900563871413_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=iUV3ho7z1BIQ7kNvwFFs92S&_nc_oc=Adk1LLXRkrptrlboOl52uj6B1ARWGMN8K7e5krdciztoOFUF845Sl_QSmKuENJdv2lo&_nc_zt=23&_nc_ht=scontent-bru2-1.xx&_nc_gid=bEg0lBSMmykHPEf7vqzysg&oh=00_AfUJ1H403onQn_u7sPuT3Eo546EMcGdK2UkOezxj-mu4Iw&oe=68BA284B"
                alt="Capitole Gent Logo"
                className="h-16 w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#161616' }}>Bevestig je identiteit</h2>
            <p className="text-gray-600 mb-6">
              Je hebt <span className="font-semibold">{pendingPerson?.name}</span> geselecteerd.
              <br />
              Voer je voornaam in om te bevestigen.
            </p>
          </div>
          
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordVerification(); }} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Voornaam
              </label>
              <input
                type="text"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200"
                placeholder="Voer je voornaam in..."
                autoFocus
                required
              />
            </div>
            
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg"
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
                className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all duration-200"
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
      <div className="max-w-6xl mx-auto">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img 
                src="https://scontent-bru2-1.xx.fbcdn.net/v/t39.30808-6/279177762_10166050644655257_1345365900563871413_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=iUV3ho7z1BIQ7kNvwFFs92S&_nc_oc=Adk1LLXRkrptrlboOl52uj6B1ARWGMN8K7e5krdciztoOFUF845Sl_QSmKuENJdv2lo&_nc_zt=23&_nc_ht=scontent-bru2-1.xx&_nc_gid=bEg0lBSMmykHPEf7vqzysg&oh=00_AfUJ1H403onQn_u7sPuT3Eo546EMcGdK2UkOezxj-mu4Iw&oe=68BA284B"
                alt="Capitole Gent Logo"
                className="h-20 w-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <h2 className="text-3xl font-bold" style={{ color: '#161616' }}>Selecteer je naam</h2>
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {groupData.people.map((person) => (
                      <button
                        key={person._id}
                        onClick={() => handlePersonSelection(person._id)}
                        className="p-4 text-center border-2 rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group"
                        style={{ borderColor: '#FAE682', backgroundColor: '#fefefe' }}
                      >
                        <div className="font-semibold text-base group-hover:text-lg transition-all duration-200" style={{ color: '#161616' }}>
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2" style={{ color: '#161616' }}>{selectedShow.name}</h2>
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
            </div>
            <button
              onClick={() => setSelectedShow(null)}
              className="px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#FAE682', color: '#161616' }}
            >
              ← Terug naar Kalender
            </button>
          </div>

          <div className="space-y-3">
            {selectedShow.shifts.map((shift) => (
              <div key={shift._id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-4">
                  {shift.startTime && (
                    <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg text-white font-bold text-sm" style={{ backgroundColor: '#161616' }}>
                      <div className="text-xs opacity-75">START</div>
                      <div className="text-lg leading-none">{shift.startTime}</div>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-lg" style={{ color: '#161616' }}>
                      {shift.role}
                    </div>
                    {shift.totalPositions && shift.totalPositions > 1 && (
                      <div className="text-sm text-gray-500 mt-1">
                        {shift.totalPositions} posities beschikbaar
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {(() => {
                    const displayAvailability = optimisticAvailability.has(shift._id) 
                      ? optimisticAvailability.get(shift._id) 
                      : shift.availability;
                    
                    return (
                      <div className="flex items-center space-x-2">
                        {/* Available Button */}
                        <button
                          onClick={() => handleAvailabilityChange(shift._id, displayAvailability === true ? null : true)}
                          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-lg ${
                            displayAvailability === true
                              ? "text-white shadow-green-200"
                              : "border-2 border-gray-200 hover:border-green-300 bg-white hover:bg-green-50"
                          }`}
                          style={displayAvailability === true ? { backgroundColor: '#22c55e' } : {}}
                          title={displayAvailability === true ? "Beschikbaar - klik om te wijzigen" : "Klik om beschikbaar te zijn"}
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </button>

                        {/* Not Available Button */}
                        <button
                          onClick={() => handleAvailabilityChange(shift._id, displayAvailability === false ? null : false)}
                          className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 shadow-lg ${
                            displayAvailability === false
                              ? "text-white shadow-red-200"
                              : "border-2 border-gray-200 hover:border-red-300 bg-white hover:bg-red-50"
                          }`}
                          style={displayAvailability === false ? { backgroundColor: '#ef4444' } : {}}
                          title={displayAvailability === false ? "Niet beschikbaar - klik om te wijzigen" : "Klik om niet beschikbaar te zijn"}
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    );
                  })()}
                  <div className="text-sm min-w-[120px]">
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
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2" style={{ color: '#161616' }}>{selectedPerson?.name}</h2>
            <div className="flex items-center space-x-2 text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">Functies: {selectedPerson?.roles.join(", ")}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedPersonId(null);
              setOptimisticAvailability(new Map()); // Clear optimistic state when changing person
            }}
            className="px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md"
            style={{ backgroundColor: '#FAE682', color: '#161616' }}
          >
            Persoon Wijzigen
          </button>
        </div>
        
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={prevMonth}
            className="px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl"
            style={{ backgroundColor: '#161616' }}
          >
            ← Vorige
          </button>
          <h3 className="text-2xl font-bold" style={{ color: '#161616' }}>{monthName}</h3>
          <button
            onClick={nextMonth}
            className="px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl"
            style={{ backgroundColor: '#161616' }}
          >
            Volgende →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center font-semibold text-gray-600" style={{ backgroundColor: '#FAE682' }}>
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {calendarDays.map((calDay, index) => (
            <div
              key={index}
              className={`min-h-[120px] p-2 border-2 transition-all duration-200 ${
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
                    className="w-full text-left p-2 text-xs text-white rounded-lg hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg"
                    style={{ backgroundColor: '#161616' }}
                  >
                    <div className="font-medium truncate">{show.name}</div>
                    <div className="flex items-center justify-between mt-1">
                      <span style={{ color: '#FAE682' }}>{show.startTime}</span>
                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
