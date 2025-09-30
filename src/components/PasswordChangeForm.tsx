import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface PasswordChangeFormProps {
  personId: Id<"people">;
  isFirstTime?: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function PasswordChangeForm({ personId, isFirstTime = false, onSuccess, onCancel }: PasswordChangeFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState("");

  const personInfo = useQuery(api.peoplePasswords.getPersonInfo, { personId });
  const changePassword = useMutation(api.peoplePasswords.changePersonPassword);
  const brandingSettings = useQuery(api.organizationSettings.getBrandingSettings);
  const logoUrl = useQuery(
    api.storage.getUrl,
    brandingSettings?.logoId ? { storageId: brandingSettings.logoId as any } : "skip"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Nieuwe wachtwoorden komen niet overeen");
      return;
    }

    if (newPassword.length < 4) {
      setError("Wachtwoord moet minimaal 4 karakters lang zijn");
      return;
    }

    setIsChanging(true);

    try {
      await changePassword({
        personId,
        currentPassword,
        newPassword,
      });

      toast.success("Wachtwoord succesvol gewijzigd!");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Er is een fout opgetreden");
    } finally {
      setIsChanging(false);
    }
  };

  if (!personInfo) {
    return (
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="text-center">
            <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
            <p className="text-gray-600">Laden...</p>
          </div>
        </div>
      </div>
    );
  }

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
          <h2 className="text-xl md:text-2xl font-bold mb-2 text-brand-primary">
            {isFirstTime ? "Wachtwoord Instellen" : "Wachtwoord Wijzigen"}
          </h2>
          <p className="text-gray-600 mb-4 md:mb-6 text-sm md:text-base">
            {isFirstTime 
              ? `Welkom ${personInfo.name}! Stel je persoonlijke wachtwoord in.`
              : `Wijzig je wachtwoord, ${personInfo.name}.`
            }
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {isFirstTime ? "Huidige (tijdelijke) wachtwoord" : "Huidig wachtwoord"}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setError("");
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200"
              placeholder="Voer je huidige wachtwoord in..."
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nieuw wachtwoord
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError("");
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200"
              placeholder="Voer je nieuwe wachtwoord in..."
              required
              minLength={4}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bevestig nieuw wachtwoord
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError("");
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all duration-200"
              placeholder="Bevestig je nieuwe wachtwoord..."
              required
              minLength={4}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={!currentPassword || !newPassword || !confirmPassword || isChanging}
              className="flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg bg-brand-secondary text-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChanging ? "Wijzigen..." : "Wachtwoord Wijzigen"}
            </button>
            {onCancel && !isFirstTime && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all duration-200"
              >
                Annuleren
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
