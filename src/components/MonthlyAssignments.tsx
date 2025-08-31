import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import * as XLSX from 'xlsx';

export function MonthlyAssignments() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isAssigning, setIsAssigning] = useState(false);
  
  const assignmentSummary = useQuery(api.assignments.getMonthlyAssignmentSummary, {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });
  
  const autoAssignStaff = useMutation(api.assignments.autoAssignStaffForMonth);
  const assignPerson = useMutation(api.shifts.assignPerson);

  const handleAutoAssign = async () => {
    setIsAssigning(true);
    try {
      await autoAssignStaff({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleManualAssign = async (shiftId: Id<"shifts">, personId: Id<"people"> | null) => {
    await assignPerson({ shiftId, personId: personId || undefined });
  };

  const exportToExcel = () => {
    if (!assignmentSummary || assignmentSummary.length === 0) {
      alert('Geen gegevens om te exporteren');
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
    assignmentSummary.forEach(show => {
      show.shifts.forEach(shift => {
        const availablePeopleNames = shift.availablePeople.map(p => p.name).join(', ');
        const status = shift.assignedPerson ? 'Toegewezen' : 'Niet Toegewezen';
        const position = shift.position && shift.peopleNeeded && shift.peopleNeeded > 1 ? `#${shift.position}` : '';
        
        excelData.push([
          show.name, new Date(show.date).toLocaleDateString('nl-BE'), show.startTime,
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
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const monthName = currentDate.toLocaleString('nl-BE', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#161616' }}>Maandelijkse Personeelstoewijzingen</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="px-3 py-1 rounded hover:opacity-80"
              style={{ backgroundColor: '#FAE682', color: '#161616' }}
            >
              ←
            </button>
            <span className="font-medium" style={{ color: '#161616' }}>{monthName}</span>
            <button
              onClick={nextMonth}
              className="px-3 py-1 rounded hover:opacity-80"
              style={{ backgroundColor: '#FAE682', color: '#161616' }}
            >
              →
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToExcel}
              disabled={!assignmentSummary || assignmentSummary.length === 0}
              className="px-4 py-2 rounded hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
              style={{ backgroundColor: '#22c55e', color: 'white' }}
              title="Exporteer naar Excel"
            >
              📊 Excel Export
            </button>
            <button
              onClick={handleAutoAssign}
              disabled={isAssigning}
              className="px-4 py-2 text-white rounded hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: '#161616' }}
            >
              {isAssigning ? "Toewijzen..." : "Automatisch Personeel Toewijzen"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {assignmentSummary?.map((show) => (
          <div key={show._id} className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold" style={{ color: '#161616' }}>{show.name}</h3>
              <p className="text-gray-600">
                {new Date(show.date).toLocaleDateString('nl-BE', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })} om {show.startTime}
              </p>
            </div>

            <div className="grid gap-4">
              {show.shifts.map((shift) => (
                <div key={shift._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium" style={{ color: '#161616' }}>
                        {shift.role}
                        {shift.position && shift.peopleNeeded && shift.peopleNeeded > 1 && ` #${shift.position}`}
                      </h4>
                      {shift.startTime && (
                        <p className="text-sm text-gray-500">
                          Start: {shift.startTime}
                        </p>
                      )}
                    </div>
                    {shift.assignedPerson && (
                      <button
                        onClick={() => handleManualAssign(shift._id, null)}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                      >
                        Niet Toewijzen
                      </button>
                    )}
                  </div>

                  {shift.assignedPerson ? (
                    <div className="mb-3">
                      <div className="p-3 rounded" style={{ backgroundColor: '#FAE682' }}>
                        <p className="font-medium" style={{ color: '#161616' }}>
                          Toegewezen: {shift.assignedPerson.name}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <div className="bg-yellow-50 p-3 rounded">
                        <p className="font-medium text-yellow-800">Niet Toegewezen</p>
                      </div>
                    </div>
                  )}

                  {shift.availablePeople.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium mb-2 text-gray-700">
                        Beschikbare Mensen:
                      </h5>
                      <div className="space-y-1">
                        {shift.availablePeople.map((person) => (
                          <div key={person._id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-sm" style={{ color: '#161616' }}>{person.name}</span>
                            <button
                              onClick={() => handleManualAssign(shift._id, person._id)}
                              className="px-2 py-1 text-white rounded text-xs hover:opacity-80"
                              style={{ backgroundColor: '#161616' }}
                            >
                              Toewijzen
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {shift.availablePeople.length === 0 && !shift.assignedPerson && (
                    <div className="text-sm text-gray-500 italic">
                      Geen beschikbare mensen voor deze dienst
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {assignmentSummary?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Geen voorstellingen gepland voor deze maand
          </div>
        )}
      </div>
    </div>
  );
}
