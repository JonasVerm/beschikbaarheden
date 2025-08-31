import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function DebugSuperAdmin() {
  const setupStatus = useQuery(api.manualSuperAdminFix.checkSetupStatus);
  const manualFix = useMutation(api.manualSuperAdminFix.checkAndFixSuperAdminSetup);

  const handleManualFix = async () => {
    try {
      const result = await manualFix();
      if (result.success) {
        toast.success(result.message);
        // Refresh the page to update the UI
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Fout bij handmatige fix: " + (error instanceof Error ? error.message : "Onbekende fout"));
    }
  };

  if (!setupStatus) {
    return null;
  }

  // Only show if user is authenticated but should be super admin but isn't
  if (setupStatus.authenticated && setupStatus.shouldBeSuperAdmin && !setupStatus.hasRole) {
    return (
      <div className="modern-card p-6 bg-yellow-50 border-yellow-200 mb-6">
        <h3 className="text-lg font-semibold text-yellow-900 mb-3">Setup Probleem Gedetecteerd</h3>
        <div className="space-y-2 text-sm text-yellow-800 mb-4">
          <p><strong>Email:</strong> {setupStatus.email}</p>
          <p><strong>Heeft Rol:</strong> {setupStatus.hasRole ? 'Ja' : 'Nee'}</p>
          <p><strong>Huidige Rol:</strong> {setupStatus.role || 'Geen'}</p>
          <p><strong>Pending Email:</strong> {setupStatus.pendingEmail || 'Geen'}</p>
          <p><strong>Zou Super Admin moeten zijn:</strong> {setupStatus.shouldBeSuperAdmin ? 'Ja' : 'Nee'}</p>
        </div>
        <p className="text-sm text-yellow-800 mb-4">
          Je account zou automatisch de super admin rol moeten krijgen, maar dit is niet gebeurd. 
          Klik op de knop hieronder om dit handmatig te repareren.
        </p>
        <button
          onClick={handleManualFix}
          className="btn-primary"
        >
          Repareer Super Admin Setup
        </button>
      </div>
    );
  }

  return null;
}
