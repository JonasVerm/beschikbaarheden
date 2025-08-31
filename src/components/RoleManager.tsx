import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

export function RoleManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<Id<"roles"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
  });

  const roles = useQuery(api.roles.list);
  const createRole = useMutation(api.roles.create);
  const updateRole = useMutation(api.roles.update);
  const removeRole = useMutation(api.roles.remove);
  const toggleActive = useMutation(api.roles.toggleActive);
  const initializeDefaultRoles = useMutation(api.roles.initializeDefaultRoles);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.displayName.trim()) return;

    try {
      if (editingId) {
        await updateRole({
          roleId: editingId,
          name: formData.name.trim(),
          displayName: formData.displayName.trim(),
          description: formData.description.trim() || undefined,
        });
        toast.success("Functie succesvol bijgewerkt!");
      } else {
        await createRole({
          name: formData.name.trim(),
          displayName: formData.displayName.trim(),
          description: formData.description.trim() || undefined,
        });
        toast.success("Functie succesvol aangemaakt!");
      }
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Er is een fout opgetreden");
    }
  };

  const resetForm = () => {
    setFormData({ name: "", displayName: "", description: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const startEdit = (role: any) => {
    setFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || "",
    });
    setEditingId(role._id);
    setShowForm(true);
  };

  const handleDelete = async (roleId: Id<"roles">) => {
    if (confirm("Weet je zeker dat je deze functie wilt verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
      try {
        await removeRole({ roleId });
        toast.success("Functie verwijderd!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Fout bij verwijderen functie");
      }
    }
  };

  const handleToggleActive = async (roleId: Id<"roles">) => {
    try {
      await toggleActive({ roleId });
      toast.success("Functie status bijgewerkt!");
    } catch (error) {
      toast.error("Fout bij bijwerken functie status");
    }
  };

  const handleInitializeDefaults = async () => {
    try {
      await initializeDefaultRoles();
      toast.success("Standaard functies aangemaakt!");
    } catch (error) {
      toast.error("Fout bij aanmaken standaard functies");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Functies Beheren</h2>
          <p className="text-gray-600">Beheer alle functies en hun instellingen</p>
        </div>
        <div className="flex gap-3">
          {roles && roles.length === 0 && (
            <button
              onClick={handleInitializeDefaults}
              className="btn-secondary"
            >
              Standaard Functies Aanmaken
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            Nieuwe Functie
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="modern-card p-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {editingId ? "Functie Bewerken" : "Nieuwe Functie Aanmaken"}
              </h3>
              <p className="text-gray-600">
                {editingId ? "Wijzig de details van de functie" : "Vul alle details in voor de nieuwe functie"}
              </p>
            </div>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Functie Code *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="modern-input"
                  placeholder="Bijv. BAR, FA, MW"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Korte code voor de functie (wordt gebruikt in systeem)
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
                  placeholder="Bijv. Bar Medewerker"
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
                placeholder="Optionele beschrijving van de functie"
                rows={3}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button type="submit" className="btn-primary">
                {editingId ? "Functie Bijwerken" : "Functie Aanmaken"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-gray"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roles List */}
      <div className="modern-card">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">
            Alle Functies
          </h3>
          <p className="text-gray-600 mt-1">
            {roles?.length || 0} functie(s) gevonden
          </p>
        </div>
        
        <div className="p-6">
          {roles && roles.length > 0 ? (
            <div className="grid gap-4">
              {roles.map((role) => (
                <div key={role._id} className="modern-card-hover p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-xl font-bold text-gray-900">{role.displayName}</h4>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-brand-light text-brand-dark">
                          {role.name}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          role.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {role.isActive ? 'Actief' : 'Inactief'}
                        </span>
                      </div>
                      {role.description && (
                        <p className="text-gray-600">{role.description}</p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleToggleActive(role._id)}
                        className={role.isActive ? "btn-gray" : "btn-success"}
                      >
                        {role.isActive ? 'Deactiveren' : 'Activeren'}
                      </button>
                      <button
                        onClick={() => startEdit(role)}
                        className="btn-accent"
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => handleDelete(role._id)}
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen functies gevonden</h3>
              <p className="text-gray-600 mb-6">Begin met het aanmaken van standaard functies</p>
              <button
                onClick={handleInitializeDefaults}
                className="btn-primary"
              >
                Standaard Functies Aanmaken
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
