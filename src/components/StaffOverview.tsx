import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { downloadICSFile } from "../utils/icsGenerator";

export function StaffOverview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  
  const staffOverview = useQuery(api.staffOverview.getStaffOverviewForMonth, {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });
  
  const workloadSummary = useQuery(api.staffOverview.getStaffWorkloadSummary, {
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });

  const groups = useQuery(api.groups.list);
  const exportCalendarAction = useAction(api.calendarExport.exportCalendarForPerson);

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    setSelectedPersonId(null);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    setSelectedPersonId(null);
  };

  const monthName = currentDate.toLocaleString('nl-BE', { month: 'long', year: 'numeric' });

  // Group staff by their groups
  const groupedStaff = () => {
    if (!staffOverview || !groups) return [];

    const groupMap = new Map<string, { group: any; staff: any[] }>();
    groups.forEach(group => {
      groupMap.set(group._id, {
        group,
        staff: []
      });
    });

    // Add ungrouped category
    groupMap.set('ungrouped', {
      group: {
        _id: 'ungrouped',
        name: 'ungrouped',
        displayName: 'Geen Groep',
        color: '#6B7280'
      },
      staff: []
    });

    // Distribute staff into groups
    staffOverview.forEach(staff => {
      const groupId = staff.person.groupId || 'ungrouped';
      if (groupMap.has(groupId)) {
        groupMap.get(groupId)!.staff.push(staff);
      } else {
        // If group doesn't exist, add to ungrouped
        groupMap.get('ungrouped')!.staff.push(staff);
      }
    });

    // Filter out empty groups and sort staff within each group
    return Array.from(groupMap.values())
      .filter(groupData => groupData.staff.length > 0)
      .map(groupData => ({
        ...groupData,
        staff: groupData.staff.sort((a: any, b: any) => {
          if (a.stats.assignedShifts !== b.stats.assignedShifts) {
            return b.stats.assignedShifts - a.stats.assignedShifts;
          }
          return a.person.name.localeCompare(b.person.name);
        })
      }));
  };

  const exportCalendar = async (personId: string, personName: string) => {
    try {
      const data = await exportCalendarAction({
        personId: personId as any,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      });
      
      if (data) {
        downloadICSFile(data);
        toast.success(`Kalender geëxporteerd voor ${personName}!`);
      } else {
        toast.error('Geen gegevens gevonden voor kalender export');
      }
    } catch (error) {
      toast.error('Fout bij kalender export');
    }
  };

  const exportToExcel = () => {
    if (!staffOverview || staffOverview.length === 0) {
      toast.error('Geen gegevens om te exporteren');
      return;
    }

    // Prepare data for Excel
    const excelData: any[] = [];
    
    // Add summary header
    excelData.push(['PERSONEELSOVERZICHT - ' + monthName.toUpperCase()]);
    excelData.push([]);
    
    // Add summary stats
    if (workloadSummary) {
      excelData.push(['SAMENVATTING']);
      excelData.push(['Totaal Medewerkers', workloadSummary.totalStaff]);
      excelData.push(['Totaal Diensten', workloadSummary.totalShifts]);
      excelData.push(['Toegewezen Diensten', workloadSummary.totalAssigned]);

      excelData.push(['Algemene Responspercentage', workloadSummary.overallResponseRate + '%']);
      excelData.push([]);
    }
    
    // Add detailed data header
    excelData.push([
      'Medewerker', 'Groep', 'Functies', 'Totaal Diensten', 'Toegewezen', 
      'Beschikbaar', 'Niet Beschikbaar', 'Geen Reactie', 'Responspercentage', 'Toewijzingspercentage'
    ]);

    // Add staff data grouped by groups
    const groupedData = groupedStaff();
    groupedData.forEach((groupData: any) => {
      groupData.staff.forEach((staff: any) => {
        excelData.push([
          staff.person.name,
          groupData.group.displayName,
          staff.person.roles.join(', '),
          staff.stats.totalShifts,
          staff.stats.assignedShifts,
          staff.stats.availableShifts,
          staff.stats.unavailableShifts,
          staff.stats.noResponseShifts,
          staff.stats.responseRate + '%',
          staff.stats.assignmentRate + '%'
        ]);
      });
    });

    // Add detailed breakdown
    excelData.push([]);
    excelData.push(['GEDETAILLEERDE UITSPLITSING PER MEDEWERKER']);
    excelData.push([]);

    groupedData.forEach(groupData => {
      excelData.push([groupData.group.displayName.toUpperCase()]);
      excelData.push([]);
      
      groupData.staff.forEach(staff => {
        excelData.push([staff.person.name.toUpperCase()]);
        excelData.push(['Voorstelling', 'Datum', 'Functie', 'Starttijd', 'Status']);
        
        staff.shows.forEach((show: any) => {
          show.shifts.forEach((shift: any) => {
            const [year, month, day] = show.date.split('-').map(Number);
            const localDate = new Date(Date.UTC(year, month - 1, day));
            
            let status = '';
            switch (shift.availabilityStatus) {
              case 'assigned': status = 'Toegewezen'; break;
              case 'available': status = 'Beschikbaar'; break;
              case 'unavailable': status = 'Niet Beschikbaar'; break;
              case 'no_response': status = 'Geen Reactie'; break;
            }
            
            excelData.push([
              show.name,
              localDate.toLocaleDateString('nl-BE'),
              shift.role,
              shift.startTime || '',
              status
            ]);
          });
        });
        excelData.push([]);
      });
      excelData.push([]);
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Set column widths
    const colWidths = [
      { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 18 }
    ];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Personeelsoverzicht');

    // Generate filename
    const filename = `Personeelsoverzicht_${monthName.replace(' ', '_')}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
    toast.success("Excel bestand gedownload!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-green-100 text-green-800 border-green-200';
      case 'available': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'unavailable': return 'bg-red-100 text-red-800 border-red-200';
      case 'no_response': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'assigned': return 'Toegewezen';
      case 'available': return 'Beschikbaar';
      case 'unavailable': return 'Niet Beschikbaar';
      case 'no_response': return 'Geen Reactie';
      default: return 'Onbekend';
    }
  };

  if (!staffOverview || !workloadSummary || !groups) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-spinner h-8 w-8"></div>
      </div>
    );
  }

  const selectedStaff = selectedPersonId 
    ? staffOverview.find(s => s.person._id === selectedPersonId)
    : null;

  const groupedData = groupedStaff();

  return (
    <div className="space-y-8">
      {/* Header with Summary Stats */}
      <div className="modern-card p-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Personeelsoverzicht</h2>
            <p className="text-gray-600">Bekijk beschikbaarheid en toewijzingen per medewerker voor {monthName}</p>
          </div>
          
          {/* Month Navigation */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="btn-secondary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-bold text-xl px-4 text-brand-primary">{monthName}</span>
              <button
                onClick={nextMonth}
                className="btn-secondary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Actieve Medewerkers</p>
                <p className="text-3xl font-bold text-gray-900">{workloadSummary.totalStaff}</p>
              </div>
              <div className="w-12 h-12 bg-gray-400 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>



          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Responspercentage</p>
                <p className="text-3xl font-bold text-gray-900">{workloadSummary.overallResponseRate}%</p>
              </div>
              <div className="w-12 h-12 bg-gray-400 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Niet Beschikbaar</p>
                <p className="text-3xl font-bold text-gray-900">{workloadSummary.totalUnavailable}</p>
              </div>
              <div className="w-12 h-12 bg-gray-400 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Geen Reactie</p>
                <p className="text-3xl font-bold text-gray-900">{workloadSummary.totalNoResponse}</p>
              </div>
              <div className="w-12 h-12 bg-gray-400 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mt-8">
          <button
            onClick={exportToExcel}
            disabled={!staffOverview || staffOverview.length === 0}
            className="btn-success flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Excel Export</span>
          </button>
        </div>
      </div>

      {/* Staff List or Detail View */}
      {selectedPersonId && selectedStaff ? (
        <div className="modern-card p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedStaff.person.name}</h3>
              <div className="flex items-center space-x-4 text-gray-600">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H8a2 2 0 00-2-2V6m8 0H8m0 0v-.5A2.5 2.5 0 0110.5 3h3A2.5 2.5 0 0116 5.5V6m-8 0h8" />
                  </svg>
                  <span>Functies: {selectedStaff.person.roles.join(", ")}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedPersonId(null)}
              className="btn-secondary"
            >
              ← Terug naar Overzicht
            </button>
          </div>

          {/* Personal Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{selectedStaff.stats.totalShifts}</div>
              <div className="text-xs text-gray-600">Totaal Diensten</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{selectedStaff.stats.assignedShifts}</div>
              <div className="text-xs text-gray-600">Toegewezen</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{selectedStaff.stats.availableShifts}</div>
              <div className="text-xs text-gray-600">Beschikbaar</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{selectedStaff.stats.unavailableShifts}</div>
              <div className="text-xs text-gray-600">Niet Beschikbaar</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{selectedStaff.stats.noResponseShifts}</div>
              <div className="text-xs text-gray-600">Geen Reactie</div>
            </div>
          </div>

          {/* Shows Detail */}
          <div className="space-y-6">
            {selectedStaff.shows.map((show) => (
              <div key={show._id} className="border border-gray-200 rounded-xl p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{show.name}</h4>
                    <div className="flex items-center space-x-4 text-gray-600 mt-2">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {(() => {
                            const [year, month, day] = show.date.split('-').map(Number);
                            const date = new Date(Date.UTC(year, month - 1, day));
                            return date.toLocaleDateString('nl-BE');
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{show.startTime}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {show.shifts.map((shift) => (
                    <div key={shift._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        {shift.startTime && (
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg text-white font-bold text-xs bg-brand-primary">
                            <div className="text-xs opacity-75">START</div>
                            <div className="text-sm leading-none">{shift.startTime}</div>
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900">{shift.role}</div>
                          {shift.positions && shift.positions > 1 && (
                            <div className="text-sm text-gray-500">{shift.positions} posities</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(shift.availabilityStatus)}`}>
                          {getStatusText(shift.availabilityStatus)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Staff List Grouped by Groups */
        <div className="space-y-8">
          {groupedData.map((groupData) => (
            <div key={groupData.group._id} className="modern-card p-8">
              {/* Group Header */}
              <div className="flex items-center space-x-4 mb-6 pb-4 border-b border-gray-200">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: groupData.group.color }}
                >
                  {groupData.group.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{groupData.group.displayName}</h3>
                  <p className="text-gray-600">{groupData.staff.length} medewerker{groupData.staff.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Staff in this group */}
              <div className="grid gap-6">
                {groupData.staff.map((staff) => (
                  <div key={staff.person._id} className="bg-gray-50 p-6 rounded-xl hover:shadow-lg transition-all duration-200 cursor-pointer border-2 border-transparent hover:border-gray-200"
                       onClick={() => setSelectedPersonId(staff.person._id)}>
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-3">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg bg-brand-primary">
                            {staff.person.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-gray-900">{staff.person.name}</h4>
                            <p className="text-gray-600">Functies: {staff.person.roles.join(", ")}</p>
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-blue-900">{staff.stats.totalShifts}</div>
                          <div className="text-xs text-blue-600">Totaal</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-900">{staff.stats.assignedShifts}</div>
                          <div className="text-xs text-green-600">Toegewezen</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-blue-900">{staff.stats.availableShifts}</div>
                          <div className="text-xs text-blue-600">Beschikbaar</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-red-900">{staff.stats.unavailableShifts}</div>
                          <div className="text-xs text-red-600">Niet Beschikbaar</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-gray-900">{staff.stats.noResponseShifts}</div>
                          <div className="text-xs text-gray-600">Geen Reactie</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Empty State */}
          {groupedData.length === 0 && (
            <div className="modern-card p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">Geen medewerkers deze maand</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Er zijn geen medewerkers met relevante diensten voor {monthName}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
