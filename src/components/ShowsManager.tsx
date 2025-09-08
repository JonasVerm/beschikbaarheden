import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { ShowDetails } from "./ShowDetails";
import { Id } from "../../convex/_generated/dataModel";
import * as XLSX from 'xlsx';

export function ShowsManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingShowId, setEditingShowId] = useState<Id<"shows"> | null>(null);
  const [selectedShowId, setSelectedShowId] = useState<Id<"shows"> | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    startTime: "",
    openDate: "",
    closeDate: "",
    roles: {} as Record<string, number>
  });

  const shows = useQuery(api.shows.list);
  const roles = useQuery(api.roles.listActive);
  const createShow = useMutation(api.shows.create);
  const updateShow = useMutation(api.shows.update);
  const removeShow = useMutation(api.shows.remove);
  const importFromExcel = useMutation(api.shows.importFromExcel);

  // Calendar navigation
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const monthName = currentDate.toLocaleString('nl-BE', { month: 'long', year: 'numeric' });

  // Group shows by date for calendar display
  const showsByDate = new Map<string, any[]>();
  if (shows) {
    shows.forEach(show => {
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
    // Adjust to start from Monday
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToSubtract);
    
    const days = [];
    const current = new Date(startDate);
    
    // Generate 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      // Use local date string to match the database format
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const isCurrentMonth = current.getMonth() === currentDate.getMonth();
      const dayShows = showsByDate.get(dateStr) || [];
      
      days.push({
        date: new Date(current),
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
  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  // Initialize roles in form data when roles are loaded
  useState(() => {
    if (roles && Object.keys(formData.roles).length === 0) {
      const initialRoles: Record<string, number> = {};
      roles.forEach(role => {
        initialRoles[role.name] = 0;
      });
      setFormData(prev => ({ ...prev, roles: initialRoles }));
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingShowId) {
        await updateShow({
          showId: editingShowId,
          name: formData.name,
          date: formData.date,
          startTime: formData.startTime,
          openDate: formData.openDate,
          closeDate: formData.closeDate,
          roles: formData.roles,
        });
        toast.success("Show succesvol bijgewerkt!");
        setEditingShowId(null);
      } else {
        await createShow({
          name: formData.name,
          date: formData.date,
          startTime: formData.startTime,
          openDate: formData.openDate,
          closeDate: formData.closeDate,
          roles: formData.roles,
        });
        toast.success("Show succesvol aangemaakt!");
      }
      
      // Reset form with current roles
      const initialRoles: Record<string, number> = {};
      roles?.forEach(role => {
        initialRoles[role.name] = 0;
      });
      
      setFormData({
        name: "",
        date: "",
        startTime: "",
        openDate: "",
        closeDate: "",
        roles: initialRoles
      });
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (editingShowId ? "Fout bij bijwerken show" : "Fout bij aanmaken show"));
      console.error(error);
    }
  };

  const handleEdit = (show: any) => {
    // Initialize roles with current active roles, preserving existing values
    const initialRoles: Record<string, number> = {};
    roles?.forEach(role => {
      initialRoles[role.name] = show.roles?.[role.name] || 0;
    });
    
    setFormData({
      name: show.name,
      date: show.date,
      startTime: show.startTime,
      openDate: show.openDate || "",
      closeDate: show.closeDate || "",
      roles: initialRoles
    });
    setEditingShowId(show._id);
    setShowForm(true);
  };

  const handleDelete = async (showId: Id<"shows">) => {
    if (confirm("Weet je zeker dat je deze show wilt verwijderen?")) {
      try {
        await removeShow({ showId });
        toast.success("Show verwijderd!");
      } catch (error) {
        toast.error("Fout bij verwijderen show");
        console.error(error);
      }
    }
  };

  // Helper function to convert dd/mm/yyyy to yyyy-mm-dd
  const convertDateFormat = (dateStr: string): string => {
    if (!dateStr) return '';
    
    // Handle Excel date numbers (serial dates)
    if (typeof dateStr === 'number') {
      const excelDate = new Date((dateStr - 25569) * 86400 * 1000);
      const year = excelDate.getFullYear();
      const month = String(excelDate.getMonth() + 1).padStart(2, '0');
      const day = String(excelDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const str = String(dateStr).trim();
    
    // If already in yyyy-mm-dd format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    
    // Handle dd/mm/yyyy format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const [day, month, year] = str.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Handle dd-mm-yyyy format
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
      const [day, month, year] = str.split('-');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // Handle yyyy/mm/dd format
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str)) {
      const [year, month, day] = str.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    console.warn('Unrecognized date format:', str);
    return str;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('Raw Excel data:', jsonData);

      const shows = jsonData.map((row: any) => {
        console.log('Processing row:', row);
        
        // Build roles object dynamically from available roles
        const rolesObj: Record<string, number> = {};
        roles?.forEach(role => {
          const displayName = role.displayName || role.name;
          rolesObj[role.name] = Number(row[role.name] || row[displayName] || 0);
        });
        
        return {
          name: String(row.name || row.Name || ''),
          date: convertDateFormat(row.date || row.Date || ''),
          startTime: String(row.startTime || row.StartTime || row.start_time || ''),
          openDate: convertDateFormat(row.openDate || row.OpenDate || row.open_date || ''),
          closeDate: convertDateFormat(row.closeDate || row.CloseDate || row.close_date || ''),
          roles: rolesObj
        };
      });

      console.log('Processed shows:', shows);

      const results = await importFromExcel({ shows });
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      if (failed === 0) {
        toast.success(`${successful} shows succesvol geïmporteerd!`);
      } else {
        toast.warning(`${successful} shows geïmporteerd, ${failed} gefaald`);
        console.log('Failed imports:', results.filter(r => !r.success));
      }
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      toast.error("Fout bij importeren Excel bestand");
      console.error('Import error:', error);
    }
  };

  const downloadTemplate = () => {
    if (!roles || roles.length === 0) {
      toast.error("Maak eerst functies aan voordat je een template kunt downloaden");
      return;
    }
    
    const template: any = {
      name: "Voorbeeld Show",
      date: "25/12/2024",
      startTime: "20:00",
      openDate: "01/12/2024",
      closeDate: "20/12/2024",
    };
    
    // Add all active roles to template
    roles.forEach(role => {
      template[role.name] = role.name === "Bar" ? 2 : 1; // Example values
    });

    const ws = XLSX.utils.json_to_sheet([template]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Shows");
    XLSX.writeFile(wb, "shows_template.xlsx");
    toast.success("Template gedownload!");
  };

  const formatDate = (dateStr: string) => {
    // Parse date string as local date to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(Number);
    console.log(`Formatting date: ${dateStr} -> year=${year}, month=${month}, day=${day}`);
    
    // Use UTC to avoid timezone issues
    const date = new Date(Date.UTC(year, month - 1, day)); // month is 0-indexed
    
    // Format manually to ensure correct display
    const weekdays = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
    const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    
    const weekday = weekdays[date.getUTCDay()];
    const monthName = months[date.getUTCMonth()];
    
    const formatted = `${weekday} ${day} ${monthName}`;
    console.log(`Final formatted date: ${formatted}`);
    
    return formatted;
  };

  const getTotalPeopleNeeded = (show: any) => {
    if (!show.roles) return 0;
    return Object.values(show.roles).reduce((sum: number, count: any) => sum + (Number(count) || 0), 0);
  };

  if (selectedShowId) {
    return (
      <ShowDetails 
        showId={selectedShowId} 
        onBack={() => setSelectedShowId(null)} 
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Shows Beheren</h2>
          <p className="text-gray-600">Beheer voorstellingen en bekijk ze in kalenderweergave</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={downloadTemplate}
            className="btn-gray flex items-center space-x-2"
          >
						            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Download Template</span>
          </button>
					
          <label className="btn-secondary flex items-center space-x-2 cursor-pointer">
						            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Import Excel</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <button
            onClick={() => {
              setEditingShowId(null);
              // Initialize roles
              const initialRoles: Record<string, number> = {};
              roles?.forEach(role => {
                initialRoles[role.name] = 0;
              });
              setFormData({
                name: "",
                date: "",
                startTime: "",
                openDate: "",
                closeDate: "",
                roles: initialRoles
              });
              setShowForm(true);
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <span>➕ Nieuwe Show</span>
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="modern-card p-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {editingShowId ? "Show Bewerken" : "Nieuwe Show Aanmaken"}
              </h3>
              <p className="text-gray-600">
                {editingShowId ? "Wijzig de details van de voorstelling" : "Vul alle details in voor de nieuwe voorstelling"}
              </p>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingShowId(null);
              }}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Show Naam *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="modern-input"
                  placeholder="Bijv. Romeo & Julia"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Datum *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="modern-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Tijd *
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  className="modern-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Beschikbaarheid Open *
                </label>
                <input
                  type="date"
                  value={formData.openDate}
                  onChange={(e) => setFormData({...formData, openDate: e.target.value})}
                  className="modern-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Beschikbaarheid Sluit *
                </label>
                <input
                  type="date"
                  value={formData.closeDate}
                  onChange={(e) => setFormData({...formData, closeDate: e.target.value})}
                  className="modern-input"
                  required
                />
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Aantal Personen per Functie</h4>
              {roles && roles.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {roles.map((role) => (
                    <div key={role._id} className="text-center p-4 bg-gray-50 rounded-xl">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {role.displayName}
                      </label>
                      <div className="text-xs text-gray-500 mb-2">{role.name}</div>
                      <input
                        type="number"
                        min="0"
                        value={formData.roles[role.name] || 0}
                        onChange={(e) => setFormData({
                          ...formData,
                          roles: {
                            ...formData.roles,
                            [role.name]: parseInt(e.target.value) || 0
                          }
                        })}
                        className="modern-input text-center"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <p className="text-gray-500 mb-4">Geen actieve functies gevonden</p>
                  <p className="text-sm text-gray-400">Maak eerst functies aan in het Functies Beheren tabblad</p>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="submit" 
                className="btn-primary"
                disabled={!roles || roles.length === 0}
              >
                {editingShowId ? "Show Bijwerken" : "Show Aanmaken"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingShowId(null);
                }}
                className="btn-gray"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar View */}
      <div className="modern-card p-8">
        {/* Calendar Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={prevMonth}
            className="px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            ← Vorige
          </button>
          <h3 className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>{monthName}</h3>
          <button
            onClick={nextMonth}
            className="px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-all duration-200 shadow-lg hover:shadow-xl"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            Volgende →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center font-semibold text-gray-600" style={{ backgroundColor: 'var(--secondary-color)' }}>
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
                backgroundColor: 'var(--secondary-color)', 
                borderColor: 'var(--secondary-color)',
                boxShadow: '0 4px 12px var(--secondary-color-fade)'
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
                {calDay.shows.map((show: any) => (
                  <div key={show._id} className="relative group">
                    <div
                      className="w-full text-left p-2 text-xs text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer"
                      style={{ backgroundColor: 'var(--primary-color)' }}
                      onClick={() => setSelectedShowId(show._id)}
                    >
                      <div className="font-medium truncate">{show.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span style={{ color: 'var(--secondary-color)' }}>{show.startTime}</span>
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      </div>
                    </div>
                    
                    {/* Action buttons - show on hover */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(show);
                        }}
                        className="p-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                        title="Bewerken"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(show._id);
                        }}
                        className="p-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                        title="Verwijderen"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {shows && shows.length === 0 && (
        <div className="modern-card p-12 text-center">
          <div className="w-20 h-20 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🎭</span>
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-3">Geen shows gepland</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            Begin met het aanmaken van je eerste show om de planning te starten
          </p>
          <button
            onClick={() => {
              setEditingShowId(null);
              const initialRoles: Record<string, number> = {};
              roles?.forEach(role => {
                initialRoles[role.name] = 0;
              });
              setFormData({
                name: "",
                date: "",
                startTime: "",
                openDate: "",
                closeDate: "",
                roles: initialRoles
              });
              setShowForm(true);
            }}
            className="btn-primary"
            disabled={!roles || roles.length === 0}
          >
            {!roles || roles.length === 0 ? "Maak eerst functies aan" : "🎭 Eerste Show Aanmaken"}
          </button>
        </div>
      )}
    </div>
  );
}
