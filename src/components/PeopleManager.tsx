import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

export function PeopleManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<Id<"people"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    roles: [] as string[],
    groupId: undefined as Id<"groups"> | undefined,
  });

  const people = useQuery(api.people.list);
  const roles = useQuery(api.roles.listActive);
  const groups = useQuery(api.groups.listActive);
  const createPerson = useMutation(api.people.create);
  const updatePerson = useMutation(api.people.update);
  const removePerson = useMutation(api.people.remove);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.roles.length === 0) {
      toast.error("Selecteer minimaal één functie");
      return;
    }
    
    try {
      if (editingPersonId) {
        await updatePerson({
          personId: editingPersonId,
          name: formData.name,
          roles: formData.roles,
          groupId: formData.groupId,
        });
        toast.success("Persoon succesvol bijgewerkt!");
        setEditingPersonId(null);
      } else {
        await createPerson({
          name: formData.name,
          roles: formData.roles,
          groupId: formData.groupId,
        });
        toast.success("Persoon succesvol aangemaakt!");
      }
      
      setFormData({
        name: "",
        roles: [],
        groupId: undefined,
      });
      setShowForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (editingPersonId ? "Fout bij bijwerken persoon" : "Fout bij aanmaken persoon"));
      console.error(error);
    }
  };

  const handleEdit = (person: any) => {
    setFormData({
      name: person.name,
      roles: person.roles,
      groupId: person.groupId,
    });
    setEditingPersonId(person._id);
    setShowForm(true);
  };

  const handleDelete = async (personId: Id<"people">) => {
    if (confirm("Weet je zeker dat je deze persoon wilt verwijderen?")) {
      try {
        await removePerson({ personId });
        toast.success("Persoon verwijderd!");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Fout bij verwijderen persoon");
        console.error(error);
      }
    }
  };

  const toggleRole = (roleName: string) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleName)
        ? prev.roles.filter(r => r !== roleName)
        : [...prev.roles, roleName]
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Personeel Beheren</h2>
          <p className="text-gray-600">Beheer medewerkers en hun functies</p>
        </div>
        <button
          onClick={() => {
            setEditingPersonId(null);
            setFormData({
              name: "",
              roles: [],
              groupId: undefined,
            });
            setShowForm(true);
          }}
          className="btn-primary"
          disabled={!roles || roles.length === 0}
        >
          {!roles || roles.length === 0 ? "Maak eerst functies aan" : "Nieuwe Persoon"}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="modern-card p-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {editingPersonId ? "Persoon Bewerken" : "Nieuwe Persoon Aanmaken"}
              </h3>
              <p className="text-gray-600">
                {editingPersonId ? "Wijzig de details van de persoon" : "Vul alle details in voor de nieuwe persoon"}
              </p>
            </div>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingPersonId(null);
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
                  Naam *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="modern-input"
                  placeholder="Voer naam in"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Groep
                </label>
                <select
                  value={formData.groupId || ""}
                  onChange={(e) => setFormData({
                    ...formData, 
                    groupId: e.target.value ? e.target.value as Id<"groups"> : undefined
                  })}
                  className="modern-input"
                >
                  <option value="">Geen groep</option>
                  {groups?.map((group) => (
                    <option key={group._id} value={group._id}>
                      {group.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-4">
                Functies * (selecteer minimaal één)
              </label>
              {roles && roles.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {roles.map((role) => (
                    <button
                      key={role._id}
                      type="button"
                      onClick={() => toggleRole(role.name)}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        formData.roles.includes(role.name)
                          ? 'border-brand-primary bg-brand-light text-brand-dark'
                          : 'border-gray-200 hover:border-brand-primary hover:bg-brand-light/50'
                      }`}
                    >
                      <div className="font-semibold">{role.displayName || role.name}</div>
                      {role.displayName && (
                        <div className="text-xs text-gray-500 mt-1">{role.name}</div>
                      )}
                    </button>
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
                disabled={!roles || roles.length === 0 || formData.roles.length === 0}
              >
                {editingPersonId ? "Persoon Bijwerken" : "Persoon Aanmaken"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingPersonId(null);
                }}
                className="btn-gray"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {/* People List */}
      <div className="modern-card">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">
            Alle Medewerkers
          </h3>
          <p className="text-gray-600 mt-1">
            {people?.length || 0} medewerker(s) gevonden
          </p>
        </div>
        
        <div className="p-6">
          {people && people.length > 0 ? (
            <div className="grid gap-4">
              {people.map((person) => (
                <div key={person._id} className="modern-card-hover p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-xl font-bold text-gray-900">{person.name}</h4>
                        {person.group && (
                          <span 
                            className="px-3 py-1 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: person.group.color }}
                          >
                            {person.group.displayName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {person.roles.map((roleName) => {
                          const role = roles?.find(r => r.name === roleName);
                          return (
                            <span
                              key={roleName}
                              className="px-3 py-1 bg-brand-light text-brand-dark rounded-full text-sm font-medium"
                            >
                              {role?.displayName || roleName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEdit(person)}
                        className="btn-accent"
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => handleDelete(person._id)}
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen medewerkers gevonden</h3>
              <p className="text-gray-600 mb-6">Begin met het aanmaken van je eerste medewerker</p>
              <button
                onClick={() => {
                  setEditingPersonId(null);
                  setFormData({
                    name: "",
                    roles: [],
                    groupId: undefined,
                  });
                  setShowForm(true);
                }}
                className="btn-primary"
                disabled={!roles || roles.length === 0}
              >
                {!roles || roles.length === 0 ? "Maak eerst functies aan" : "Eerste Medewerker Aanmaken"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
