import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { ShowDetails } from "./ShowDetails";
import { Id } from "../../convex/_generated/dataModel";
import * as XLSX from 'xlsx';

type CalendarDay = {
  date: Date;
  dateStr: string;
  day: number;
  isCurrentMonth: boolean;
  shows: any[];
};

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
          rolesObj[role.name] = Number(row[role.name] || row[role.displayName] || 0);
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
          <p className="text-gray-600">Beheer voorstellingen en hun beschikbaarheid</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={downloadTemplate}
            className="btn-gray flex items-center space-x-2"
          >
            <span>Download Template</span>
          </button>
          <label className="btn-secondary flex items-center space-x-2 cursor-pointer">
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
            <span>Nieuwe Show</span>
          </button>
        </div>
      </div>

      {/* Create Form */}
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
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-all"
            style={{ backgroundColor: '#161616' }}
          >
            ← Vorige
          </button>
          <h3 className="text-2xl font-bold" style={{ color: '#161616' }}>
            {currentDate.toLocaleString('nl-BE', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="px-6 py-3 text-white rounded-xl font-medium hover:opacity-90 transition-all"
            style={{ backgroundColor: '#161616' }}
          >
            Volgende →
          </button>
        </div>
        
        <div className="p-6">
          {shows && shows.length > 0 ? (
            <div className="grid gap-4">
              {shows.map((show) => (
                <div key={show._id} className="modern-card-hover p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-gray-900 mb-2">{show.name}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-brand-primary">Datum:</span>
                          <span className="font-medium">{show.date} om {show.startTime}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-brand-primary">Beschikbaar:</span>
                          <span>{show.openDate} - {show.closeDate}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-brand-primary">Functies:</span>
                          <span>
                            {show.roles ? 
                              Object.entries(show.roles)
                                .filter(([_, count]) => count > 0)
                                .map(([roleName, count]) => {
                                  const role = roles?.find(r => r.name === roleName);
                                  return `${role?.displayName || roleName}: ${count}`;
                                })
                                .join(', ') || 'Geen functies'
                              : 'Niet ingesteld'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelectedShowId(show._id)}
                        className="btn-secondary"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handleEdit(show)}
                        className="btn-accent"
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => handleDelete(show._id)}
                        className="btn-danger"
                      >
                        Verwijderen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 bg-brand-primary rounded-lg"></div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen shows gevonden</h3>
              <p className="text-gray-600 mb-6">Begin met het aanmaken van je eerste show</p>
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
                className="btn-primary"
                disabled={!roles || roles.length === 0}
              >
                {!roles || roles.length === 0 ? "Maak eerst functies aan" : "Eerste Show Aanmaken"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
