import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function RoleConfigManager() {
  const [isEditing, setIsEditing] = useState(false);
  const [configs, setConfigs] = useState<Record<string, number>>({});

  const roleConfigurations = useQuery(api.roleConfigurations.getRoleConfigurations);
  const updateRoleConfiguration = useMutation(api.roleConfigurations.updateRoleConfiguration);
  const initializeRoleConfigurations = useMutation(api.roleConfigurations.initializeRoleConfigurations);

  const handleEdit = () => {
    if (roleConfigurations) {
      const configMap: Record<string, number> = {};
      roleConfigurations.forEach(config => {
        configMap[config.role] = config.hoursBeforeShow;
      });
      setConfigs(configMap);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    try {
      for (const [role, hours] of Object.entries(configs)) {
        await updateRoleConfiguration({
          role: role,
          hoursBeforeShow: hours,
        });
      }
      toast.success("Functie configuraties succesvol bijgewerkt");
      setIsEditing(false);
    } catch (error) {
      toast.error(`Fout: ${error}`);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setConfigs({});
  };

  const handleInitialize = async () => {
    try {
      await initializeRoleConfigurations();
      toast.success("Standaard configuraties aangemaakt");
    } catch (error) {
      toast.error(`Fout: ${error}`);
    }
  };

  const formatHours = (hours: number): string => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    if (minutes === 0) {
      return `${wholeHours}:00`;
    }
    return `${wholeHours}:${String(minutes).padStart(2, '0')}`;
  };

  const parseHours = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + (minutes / 60);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Functie Start Tijden</h2>
          <p className="text-gray-600">Configureer hoeveel tijd voor de voorstelling elke functie moet beginnen</p>
        </div>
        {!isEditing && roleConfigurations && roleConfigurations.length > 0 && (
          <button
            onClick={handleEdit}
            className="btn-primary"
          >
            Bewerken
          </button>
        )}
      </div>

      <div className="modern-card p-8">
        {roleConfigurations && roleConfigurations.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 bg-brand-primary rounded-lg"></div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Geen configuraties gevonden</h3>
            <p className="text-gray-600 mb-6">Maak eerst functies aan voordat je hun start tijden kunt configureren</p>
            <button
              onClick={handleInitialize}
              className="btn-primary"
            >
              Standaard Configuraties Aanmaken
            </button>
          </div>
        )}

        {roleConfigurations && roleConfigurations.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-4">
              {roleConfigurations.map((config) => (
                <div key={config.role} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-bold text-lg text-gray-900">{config.displayName}</h3>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-brand-light text-brand-dark">
                        {config.role}
                      </span>
                      {!config.isConfigured && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Standaard
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Start tijd: {formatHours(configs[config.role] || config.hoursBeforeShow)} voor voorstelling
                    </p>
                  </div>
                  {isEditing && (
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700">Start tijd:</label>
                      <input
                        type="text"
                        value={formatHours(configs[config.role] || config.hoursBeforeShow)}
                        onChange={(e) => {
                          const timeValue = e.target.value;
                          if (timeValue.match(/^\d{1,2}:\d{2}$/)) {
                            setConfigs(prev => ({
                              ...prev,
                              [config.role]: parseHours(timeValue)
                            }));
                          }
                        }}
                        className="w-20 px-3 py-2 border-2 border-gray-200 rounded-lg text-center focus:border-brand-primary focus:ring-4 focus:ring-brand-light outline-none transition-all duration-200"
                        placeholder="H:MM"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {isEditing && (
              <div className="flex gap-4 pt-6 border-t border-gray-100">
                <button
                  onClick={handleSave}
                  className="btn-primary"
                >
                  Configuraties Opslaan
                </button>
                <button
                  onClick={handleCancel}
                  className="btn-gray"
                >
                  Annuleren
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
