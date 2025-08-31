import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function AdminPasswordChange() {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChanging, setIsChanging] = useState(false);

  const changePassword = useMutation(api.adminHelpers.changeAdminPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Nieuwe wachtwoorden komen niet overeen");
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error("Nieuw wachtwoord moet minimaal 6 karakters lang zijn");
      return;
    }

    setIsChanging(true);
    
    try {
      const result = await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      
      if (result.success) {
        toast.success(result.message || "Wachtwoord wijziging aangevraagd!");
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fout bij wijzigen wachtwoord");
      console.error(error);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Wachtwoord Wijzigen</h2>
        <p className="text-gray-600">Wijzig je admin wachtwoord</p>
      </div>

      {/* Password Change Form */}
      <div className="modern-card p-8">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Huidig Wachtwoord *
            </label>
            <input
              type="password"
              value={formData.currentPassword}
              onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
              className="modern-input"
              placeholder="Voer huidig wachtwoord in"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nieuw Wachtwoord *
            </label>
            <input
              type="password"
              value={formData.newPassword}
              onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
              className="modern-input"
              placeholder="Voer nieuw wachtwoord in"
              minLength={6}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Minimaal 6 karakters</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Bevestig Nieuw Wachtwoord *
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className="modern-input"
              placeholder="Bevestig nieuw wachtwoord"
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="submit" 
              className="btn-primary"
              disabled={isChanging || !formData.currentPassword || !formData.newPassword || !formData.confirmPassword}
            >
              {isChanging ? "Wijzigen..." : "Wachtwoord Wijzigen"}
            </button>
          </div>
        </form>
      </div>

      {/* Security Tips */}
      <div className="modern-card p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Beveiligingstips</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• Gebruik een sterk wachtwoord met minimaal 6 karakters</li>
          <li>• Combineer letters, cijfers en speciale tekens</li>
          <li>• Deel je wachtwoord nooit met anderen</li>
          <li>• Wijzig je wachtwoord regelmatig</li>
        </ul>
      </div>
    </div>
  );
}
