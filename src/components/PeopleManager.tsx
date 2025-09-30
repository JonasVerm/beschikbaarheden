import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

export function PeopleManager() {
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [newPerson, setNewPerson] = useState({
    name: "",
    roles: [] as string[],
    groupId: "" as Id<"groups"> | "",
  });

  const people = useQuery(api.people.list);
  const groups = useQuery(api.groups.list);
  const roles = useQuery(api.roles.listActive);
  
  const addPerson = useMutation(api.people.add);
  const updatePerson = useMutation(api.people.update);
  const removePerson = useMutation(api.people.remove);
  const toggleAutoAssignmentExclusion = useMutation(api.people.toggleAutoAssignmentExclusion);
  const resetPassword = useMutation(api.people.resetPassword);

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPerson.name || newPerson.roles.length === 0 || !newPerson.groupId) {
      toast.error("Vul alle velden in");
      return;
    }

    try {
      await addPerson({
        name: newPerson.name,
        roles: newPerson.roles,
        groupId: newPerson.groupId as Id<"groups">,
      });
      
      setNewPerson({ name: "", roles: [], groupId: "" });
      setIsAddingPerson(false);
      toast.success("Persoon toegevoegd");
    } catch (error) {
      toast.error("Fout bij toevoegen persoon");
    }
  };

  const handleUpdatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;

    try {
      await updatePerson({
        id: editingPerson._id,
        name: editingPerson.name,
        roles: editingPerson.roles,
        groupId: editingPerson.groupId,
      });
      
      setEditingPerson(null);
      toast.success("Persoon bijgewerkt");
    } catch (error) {
      toast.error("Fout bij bijwerken persoon");
    }
  };

  const handleRemovePerson = async (id: Id<"people">, name: string) => {
    if (confirm(`Weet je zeker dat je ${name} wilt verwijderen?`)) {
      try {
        await removePerson({ id });
        toast.success("Persoon verwijderd");
      } catch (error) {
        toast.error("Fout bij verwijderen persoon");
      }
    }
  };

  const handleToggleAutoAssignmentExclusion = async (id: Id<"people">) => {
    try {
      const result = await toggleAutoAssignmentExclusion({ id });
      toast.success(
        result.excluded 
          ? `${result.name} is uitgesloten van automatische toewijzing`
          : `${result.name} is weer opgenomen in automatische toewijzing`
      );
    } catch (error) {
      toast.error("Fout bij wijzigen auto-toewijzing status");
    }
  };

  const handleResetPassword = async (id: Id<"people">, name: string) => {
    if (confirm(`Weet je zeker dat je het wachtwoord van ${name} wilt resetten?`)) {
      try {
        const result = await resetPassword({ id });
        toast.success(
          `Wachtwoord gereset voor ${result.name}. Nieuw tijdelijk wachtwoord: ${result.tempPassword}`,
          { duration: 10000 }
        );
      } catch (error) {
        toast.error("Fout bij resetten wachtwoord");
      }
    }
  };

  const toggleRole = (roleList: string[], role: string, setter: (roles: string[]) => void) => {
    if (roleList.includes(role)) {
      setter(roleList.filter(r => r !== role));
    } else {
      setter([...roleList, role]);
    }
  };

  const getGroupName = (groupId: Id<"groups">) => {
    const group = groups?.find(g => g._id === groupId);
    return group?.displayName || group?.name || "Onbekende groep";
  };

  const getGroupColor = (groupId: Id<"groups">) => {
    const group = groups?.find(g => g._id === groupId);
    return group?.color || "#6B7280";
  };

  if (!people || !groups || !roles) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Group people by their groups
  const groupedPeople = groups.map(group => ({
    group,
    people: people.filter(person => person.groupId === group._id)
  })).filter(groupData => groupData.people.length > 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="modern-card p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Personeelsbeheer</h2>
            <p className="text-gray-600">Beheer medewerkers, hun functies en groepen</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsAddingPerson(true)}
              className="btn-primary flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Nieuwe Persoon</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Totaal Medewerkers</p>
                <p className="text-3xl font-bold text-gray-900">{people.length}</p>
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
                <p className="text-gray-600 text-sm font-medium">Actieve Groepen</p>
                <p className="text-3xl font-bold text-gray-900">{groups.filter(g => g.isActive).length}</p>
              </div>
              <div className="w-12 h-12 bg-gray-400 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Uitgesloten van Auto-toewijzing</p>
                <p className="text-3xl font-bold text-gray-900">{people.filter(p => p.excludeFromAutoAssignment).length}</p>
              </div>
              <div className="w-12 h-12 bg-gray-400 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* People List Grouped by Groups */}
      <div className="space-y-8">
        {groupedPeople.map((groupData) => (
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
                <p className="text-gray-600">{groupData.people.length} medewerker{groupData.people.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* People in this group */}
            <div className="grid gap-4">
              {groupData.people.map((person) => (
                <div key={person._id} className="bg-gray-50 p-6 rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-200">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg bg-brand-primary">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                            <span>{person.name}</span>
                            {person.excludeFromAutoAssignment && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                                Geen Auto-toewijzing
                              </span>
                            )}
                          </h4>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {person.roles.map((role) => (
                              <span key={role} className="px-3 py-1 bg-white text-gray-700 rounded-full text-sm border border-gray-200">
                                {roles.find(r => r.name === role)?.displayName || role}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleToggleAutoAssignmentExclusion(person._id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md hover:shadow-lg ${
                          person.excludeFromAutoAssignment
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                        title={person.excludeFromAutoAssignment 
                          ? "Opnemen in automatische toewijzing" 
                          : "Uitsluiten van automatische toewijzing"
                        }
                      >
                        {person.excludeFromAutoAssignment ? (
                          <>
                            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Opnemen
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Uitsluiten
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => setEditingPerson(person)}
                        className="btn-secondary"
                        title="Persoon bewerken"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => handleResetPassword(person._id, person.name)}
                        className="btn-primary"
                        title="Wachtwoord resetten"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => handleRemovePerson(person._id, person.name)}
                        className="btn-danger"
                        title="Persoon verwijderen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {groupedPeople.length === 0 && (
          <div className="modern-card p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">Geen medewerkers</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Er zijn nog geen medewerkers toegevoegd. Voeg je eerste medewerker toe om te beginnen.
            </p>
            <button
              onClick={() => setIsAddingPerson(true)}
              className="btn-primary"
            >
              Eerste Medewerker Toevoegen
            </button>
          </div>
        )}
      </div>

      {/* Add Person Modal */}
      {isAddingPerson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Nieuwe Persoon Toevoegen</h3>
                <button
                  onClick={() => setIsAddingPerson(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAddPerson} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Naam
                  </label>
                  <input
                    type="text"
                    value={newPerson.name}
                    onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                    className="input-field"
                    placeholder="Voer naam in"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Groep
                  </label>
                  <select
                    value={newPerson.groupId}
                    onChange={(e) => setNewPerson({ ...newPerson, groupId: e.target.value as Id<"groups"> })}
                    className="input-field"
                    required
                  >
                    <option value="">Selecteer een groep</option>
                    {groups.filter(g => g.isActive).map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Functies
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {roles.map((role) => (
                      <label key={role._id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newPerson.roles.includes(role.name)}
                          onChange={() => toggleRole(newPerson.roles, role.name, (roles) => setNewPerson({ ...newPerson, roles }))}
                          className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                        />
                        <span className="text-sm text-gray-700">{role.displayName || role.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsAddingPerson(false)}
                    className="btn-secondary"
                  >
                    Annuleren
                  </button>
                  <button type="submit" className="btn-primary">
                    Persoon Toevoegen
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Person Modal */}
      {editingPerson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Persoon Bewerken</h3>
                <button
                  onClick={() => setEditingPerson(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleUpdatePerson} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Naam
                  </label>
                  <input
                    type="text"
                    value={editingPerson.name}
                    onChange={(e) => setEditingPerson({ ...editingPerson, name: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Groep
                  </label>
                  <select
                    value={editingPerson.groupId}
                    onChange={(e) => setEditingPerson({ ...editingPerson, groupId: e.target.value })}
                    className="input-field"
                    required
                  >
                    {groups.filter(g => g.isActive).map((group) => (
                      <option key={group._id} value={group._id}>
                        {group.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Functies
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {roles.map((role) => (
                      <label key={role._id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingPerson.roles.includes(role.name)}
                          onChange={() => toggleRole(editingPerson.roles, role.name, (roles) => setEditingPerson({ ...editingPerson, roles }))}
                          className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                        />
                        <span className="text-sm text-gray-700">{role.displayName || role.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setEditingPerson(null)}
                    className="btn-secondary"
                  >
                    Annuleren
                  </button>
                  <button type="submit" className="btn-primary">
                    Wijzigingen Opslaan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
