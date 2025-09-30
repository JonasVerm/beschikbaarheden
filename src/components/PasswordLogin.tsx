import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface PasswordLoginProps {
  onLoginSuccess: (personId: Id<"people">, mustChangePassword: boolean) => void;
  onBack: () => void;
}

export function PasswordLogin({ onLoginSuccess, onBack }: PasswordLoginProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<Id<"people"> | null>(null);
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const peopleByGroup = useQuery(api.groups.getPeopleByGroup);
  const brandingSettings = useQuery(api.organizationSettings.getBrandingSettings);
  const logoUrl = useQuery(
    api.storage.getUrl,
    brandingSettings?.logoId ? { storageId: brandingSettings.logoId as any } : "skip"
  );

  const verifyPasswordMutation = useMutation(api.peoplePasswords.verifyPersonPassword);

  const handlePersonSelect = (personId: Id<"people">) => {
    setSelectedPersonId(personId);
    setPassword("");
    setError("");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId || !password) return;

    setIsVerifying(true);
    setError("");

    try {
      const result = await verifyPasswordMutation({
        personId: selectedPersonId,
        password: password
      });
      
      if (result.valid) {
        onLoginSuccess(selectedPersonId, result.mustChangePassword);
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const selectedPerson = peopleByGroup?.flatMap(g => g.people).find(p => p._id === selectedPersonId);

  if (selectedPersonId && selectedPerson) {
    return (
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="text-center mb-6 md:mb-8">
            <div className="flex justify-center mb-4">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="h-12 md:h-16 w-auto object-contain rounded-lg shadow-md bg-white"
                />
              ) : (
                <div 
                  className="h-12 md:h-16 w-12 md:w-16 rounded-lg shadow-md flex items-center justify-center text-white font-bold text-xl md:text-2xl" 
                  style={{ backgroundColor: brandingSettings?.primaryColor || '#161616' }}
                >
                  {brandingSettings?.siteName?.charAt(0).toUpperCase() || 'C'}
                </div>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-bold mb-2 text-brand-primary">Welkom {selectedPerson.name}</h2>
            <p className="text-gray-600 mb-4 md:mb-6 text-sm md:text-base">
              Voer je persoonlijke wachtwoord in om door te gaan.
            </p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4 md:space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Wachtwoord
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-4 md:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200 text-lg md:text-base"
                placeholder="Voer je wachtwoord in..."
                autoFocus
                required
              />
              {error && (
                <p className="text-red-600 text-sm mt-2">{error}</p>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={!password || isVerifying}
                className="flex-1 py-4 md:py-3 px-6 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg text-lg md:text-base bg-brand-secondary text-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? "Controleren..." : "Inloggen"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPersonId(null);
                  setPassword("");
                  setError("");
                }}
                className="flex-1 py-4 md:py-3 px-6 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all duration-200 text-lg md:text-base"
              >
                Terug
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                className="h-16 md:h-20 w-auto object-contain rounded-lg shadow-md bg-white"
              />
            ) : (
              <div 
                className="h-16 md:h-20 w-16 md:w-20 rounded-lg shadow-md flex items-center justify-center text-white font-bold text-2xl md:text-3xl" 
                style={{ backgroundColor: brandingSettings?.primaryColor || '#161616' }}
              >
                {brandingSettings?.siteName?.charAt(0).toUpperCase() || 'C'}
              </div>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-brand-primary">Selecteer je naam</h2>
          <button
            onClick={onBack}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
          >
            ← Terug naar hoofdpagina
          </button>
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
                  <h3 className="text-lg font-semibold text-brand-primary">
                    {groupData.group.displayName}
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {groupData.people
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((person) => (
                      <button
                        key={person._id}
                        onClick={() => handlePersonSelect(person._id)}
                        className="p-8 md:p-6 text-center border-2 rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-[1.02] group min-h-[80px] md:min-h-[70px] flex items-center justify-center"
                        style={{ 
                          backgroundColor: '#fefefe',
                          borderColor: groupData.group.color
                        }}
                      >
                        <div className="font-semibold text-base md:text-sm group-hover:text-lg md:group-hover:text-base transition-all duration-200 leading-tight text-brand-primary">
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
