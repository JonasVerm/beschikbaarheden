import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

export function MonthlyAssignments() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAssigning, setIsAssigning] = useState(false);
  
  const assignmentData = useQuery(api.assignments.getMonthlyAssignmentSummary, {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });
  
  const autoAssignStaff = useMutation(api.assignments.autoAssignStaffForMonth);
  const assignPerson = useMutation(api.shifts.assignPerson);

  const handleAutoAssign = async () => {
    setIsAssigning(true);
    try {
      const result = await autoAssignStaff({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      });
      toast.success(result.message);
    } catch (error) {
      toast.error("Fout bij automatisch toewijzen");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleManualAssign = async (shiftId: Id<"shifts">, personId: Id<"people"> | null) => {
    try {
      await assignPerson({ shiftId, personId: personId || undefined });
      toast.success("Toewijzing bijgewerkt");
    } catch (error) {
      toast.error("Fout bij toewijzen");
    }
  };

  const exportToExcel = () => {
    if (!assignmentData?.shows || assignmentData.shows.length === 0) {
      toast.error('Geen gegevens om te exporteren');
      return;
    }

    // Prepare data for Excel
    const excelData: any[] = [];
    
    // Add header row
    excelData.push([
      'Voorstelling', 'Datum', 'Starttijd Voorstelling', 'Functie', 'Positie', 
      'Starttijd Dienst', 'Toegewezen Persoon', 'Status', 'Beschikbare Mensen'
    ]);

    // Add data rows
    assignmentData.shows.forEach(show => {
      show.shifts.forEach(shift => {
        const availablePeopleNames = shift.availablePeople.map(p => p.name).join(', ');
        const status = shift.assignedPerson ? 'Toegewezen' : 'Niet Toegewezen';
        const position = shift.position && shift.peopleNeeded && shift.peopleNeeded > 1 ? `#${shift.position}` : '';
        
        const [year, month, day] = show.date.split('-').map(Number);
        const localDate = new Date(Date.UTC(year, month - 1, day));
        
        excelData.push([
          show.name, localDate.toLocaleDateString('nl-BE'), show.startTime,
          shift.role, position, shift.startTime || '', shift.assignedPerson?.name || '',
          status, availablePeopleNames
        ]);
      });
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 8 },
      { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 }
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Personeelstoewijzingen');

    // Generate filename with month and year
    const filename = `Personeelstoewijzingen_${monthName.replace(' ', '_')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
    toast.success("Excel bestand gedownload!");
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const monthName = currentDate.toLocaleString('nl-BE', { month: 'long', year: 'numeric' });

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
          
          {/* Month Navigation */}
          <div className="flex items-center gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
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

      {/* Shows List */}
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
                  <div className="text-2xl font-bold text-green-600">{show.shifts.filter(s => s.assignedPerson).length}</div>
                  <div className="text-xs text-gray-500">Toegewezen</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{show.shifts.filter(s => !s.assignedPerson).length}</div>
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
                    shift.assignedPerson 
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
                      {shift.assignedPerson && (
                        <button
                          onClick={() => handleManualAssign(shift._id, null)}
                          className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          Niet Toewijzen
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Available People */}
                  {!shift.assignedPerson && shift.availablePeople.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h5 className="text-sm font-bold text-gray-700 mb-3 flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span>Beschikbare Mensen ({shift.availablePeople.length})</span>
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {shift.availablePeople.map((person) => (
                          <div key={person._id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200">
                            <span className="font-medium text-gray-900">{person.name}</span>
                            <button
                              onClick={() => handleManualAssign(shift._id, person._id)}
                              className="px-3 py-1 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-md"
                              style={{ backgroundColor: '#161616' }}
                            >
                              Toewijzen
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Available People Warning */}
                  {!shift.assignedPerson && shift.availablePeople.length === 0 && (
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
    </div>
  );
}
