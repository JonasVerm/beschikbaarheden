import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function OrganizationSettings() {
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const currentPassword = useQuery(api.organizationSettings.getPublicPassword);
  const setPublicPassword = useMutation(api.organizationSettings.setPublicPassword);

  const handleSave = async () => {
    if (!newPassword.trim()) {
      toast.error("Wachtwoord mag niet leeg zijn");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Wachtwoorden komen niet overeen");
      return;
    }

    if (newPassword.length < 4) {
      toast.error("Wachtwoord moet minimaal 4 karakters lang zijn");
      return;
    }

    try {
      await setPublicPassword({ password: newPassword });
      toast.success("Wachtwoord succesvol bijgewerkt!");
      setIsEditing(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Fout bij bijwerken wachtwoord");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Organisatie Instellingen</h2>
          <p className="text-gray-600">Beheer organisatie-brede instellingen en toegang</p>
        </div>
      </div>

      {/* Public Access Password */}
      <div className="modern-card p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Publieke Toegang Wachtwoord</h3>
            <p className="text-gray-600">
              Stel een wachtwoord in dat medewerkers moeten invoeren om toegang te krijgen tot het beschikbaarheidssysteem
            </p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-primary"
            >
              {currentPassword ? "Wijzigen" : "Instellen"}
            </button>
          )}
        </div>

        {!isEditing ? (
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${currentPassword ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <div>
                <p className="font-semibold text-gray-900">
                  {currentPassword ? "Wachtwoord is ingesteld" : "Geen wachtwoord ingesteld"}
                </p>
                <p className="text-sm text-gray-600">
                  {currentPassword 
                    ? "Medewerkers hebben een wachtwoord nodig om toegang te krijgen"
                    : "Iedereen heeft vrije toegang tot het systeem"
                  }
                </p>
              </div>
            </div>
            {currentPassword && (
              <div className="mt-4 p-3 bg-white rounded-lg border">
                <p className="text-sm text-gray-600 mb-1">Huidig wachtwoord:</p>
                <p className="font-mono text-lg font-semibold text-gray-900">
                  {"•".repeat(currentPassword.length)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nieuw Wachtwoord *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="modern-input"
                placeholder="Voer nieuw wachtwoord in"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimaal 4 karakters
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Bevestig Wachtwoord *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="modern-input"
                placeholder="Bevestig nieuw wachtwoord"
                required
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={handleSave}
                className="btn-primary"
                disabled={!newPassword || !confirmPassword}
              >
                Wachtwoord Opslaan
              </button>
              <button
                onClick={handleCancel}
                className="btn-gray"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="modern-card p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Beveiligingsnotitie</h4>
            <p className="text-sm text-blue-800">
              Dit wachtwoord beschermt de toegang tot het publieke beschikbaarheidssysteem. 
              Deel dit wachtwoord alleen met geautoriseerde medewerkers. 
              Beheerders hebben altijd toegang via hun eigen inloggegevens.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
