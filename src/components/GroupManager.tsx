import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

export function GroupManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<Id<"groups"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    color: "#6B7280"
  });

  const groups = useQuery(api.groups.list);
  const createGroup = useMutation(api.groups.create);
  const updateGroup = useMutation(api.groups.update);
  const toggleActive = useMutation(api.groups.toggleActive);
  const removeGroup = useMutation(api.groups.remove);
  const initializeDefaultGroups = useMutation(api.groups.initializeDefaultGroups);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingGroupId) {
        await updateGroup({
          groupId: editingGroupId,
          name: formData.name,
          displayName: formData.displayName,
          description: formData.description,
          color: formData.color,
        });
        toast.success("Groep succesvol bijgewerkt!");
        setEditingGroupId(null);
      } else {
        await createGroup({
          name: formData.name,
          displayName: formData.displayName,
          description: formData.description,
          color: formData.color,
        });
        toast.success("Groep succesvol aangemaakt!");
      }
      
      setFormData({
        name: "",
        displayName: "",
        description: "",
        color: "#6B7280"
      });
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (editingGroupId ? "Fout bij bijwerken groep" : "Fout bij aanmaken groep"));
      console.error(error);
    }
  };

  const handleEdit = (group: any) => {
    setFormData({
      name: group.name,
      displayName: group.displayName,
      description: group.description || "",
      color: group.color || "#6B7280"
    });
    setEditingGroupId(group._id);
    setShowForm(true);
  };

  const handleToggleActive = async (groupId: Id<"groups">) => {
    try {
      await toggleActive({ groupId });
      toast.success("Groep status bijgewerkt!");
    } catch (error) {
      toast.error("Fout bij bijwerken groep status");
      console.error(error);
    }
  };

  const handleDelete = async (groupId: Id<"groups">) => {
    if (confirm("Weet je zeker dat je deze groep wilt verwijderen?")) {
      try {
        await removeGroup({ groupId });
        toast.success("Groep verwijderd!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Fout bij verwijderen groep");
        console.error(error);
      }
    }
  };

  const handleInitializeDefaults = async () => {
    try {
      await initializeDefaultGroups();
      toast.success("Standaard groepen aangemaakt!");
    } catch (error) {
      toast.error("Fout bij aanmaken standaard groepen");
      console.error(error);
    }
  };

  const predefinedColors = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#8B5CF6", // Purple
    "#F59E0B", // Yellow
    "#EF4444", // Red
    "#06B6D4", // Cyan
    "#84CC16", // Lime
    "#F97316", // Orange
    "#EC4899", // Pink
    "#6B7280", // Gray
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Groepen Beheren</h2>
          <p className="text-gray-600">Organiseer medewerkers in groepen voor betere overzicht</p>
        </div>
        <div className="flex gap-3">
          {(!groups || groups.length === 0) && (
            <button
              onClick={handleInitializeDefaults}
              className="btn-secondary"
            >
              Standaard Groepen Aanmaken
            </button>
          )}
          <button
            onClick={() => {
              setEditingGroupId(null);
              setFormData({
                name: "",
                displayName: "",
                description: "",
                color: "#6B7280"
              });
              setShowForm(true);
            }}
            className="btn-primary"
          >
            Nieuwe Groep
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="modern-card p-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {editingGroupId ? "Groep Bewerken" : "Nieuwe Groep Aanmaken"}
              </h3>
              <p className="text-gray-600">
                {editingGroupId ? "Wijzig de details van de groep" : "Vul alle details in voor de nieuwe groep"}
              </p>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingGroupId(null);
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
                  Groep Naam (Intern) *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="modern-input"
                  placeholder="bijv. front-team"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Gebruikt voor interne referenties (geen spaties, lowercase)
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Weergave Naam *
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                  className="modern-input"
                  placeholder="bijv. Front Team"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Naam zoals getoond aan gebruikers
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Beschrijving
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="modern-input"
                placeholder="Optionele beschrijving van de groep"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Kleur
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex flex-wrap gap-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({...formData, color})}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({...formData, color: e.target.value})}
                  className="w-12 h-8 rounded border border-gray-300"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Kleur voor visuele herkenning in de interface
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="submit" 
                className="btn-primary"
              >
                {editingGroupId ? "Groep Bijwerken" : "Groep Aanmaken"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingGroupId(null);
                }}
                className="btn-gray"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Groups List */}
      <div className="modern-card">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">
            Alle Groepen
          </h3>
          <p className="text-gray-600 mt-1">
            {groups?.length || 0} groep(en) gevonden
          </p>
        </div>
        
        <div className="p-6">
          {groups && groups.length > 0 ? (
            <div className="grid gap-4">
              {groups.map((group) => (
                <div key={group._id} className="modern-card-hover p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: group.color }}
                      >
                        {group.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center space-x-3">
                          <h4 className="text-xl font-bold text-gray-900">{group.displayName}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            group.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {group.isActive ? 'Actief' : 'Inactief'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Naam:</span> {group.name}
                        </p>
                        {group.description && (
                          <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleToggleActive(group._id)}
                        className={group.isActive ? "btn-secondary" : "btn-accent"}
                      >
                        {group.isActive ? "Deactiveren" : "Activeren"}
                      </button>
                      <button
                        onClick={() => handleEdit(group)}
                        className="btn-accent"
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => handleDelete(group._id)}
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen groepen gevonden</h3>
              <p className="text-gray-600 mb-6">Begin met het aanmaken van je eerste groep</p>
              <button
                onClick={() => {
                  setEditingGroupId(null);
                  setFormData({
                    name: "",
                    displayName: "",
                    description: "",
                    color: "#6B7280"
                  });
                  setShowForm(true);
                }}
                className="btn-primary"
              >
                Eerste Groep Aanmaken
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
