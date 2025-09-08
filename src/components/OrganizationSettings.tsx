import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function OrganizationSettings() {
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isEditingSiteName, setIsEditingSiteName] = useState(false);
  const [isEditingColors, setIsEditingColors] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newSiteName, setNewSiteName] = useState("");
  const [newPrimaryColor, setNewPrimaryColor] = useState("");
  const [newSecondaryColor, setNewSecondaryColor] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPassword = useQuery(api.organizationSettings.getPublicPassword);
  const brandingSettings = useQuery(api.organizationSettings.getBrandingSettings);
  const logoUrl = useQuery(
    api.storage.getUrl,
    brandingSettings?.logoId ? { storageId: brandingSettings.logoId as any } : "skip"
  );
  
  const setPublicPassword = useMutation(api.organizationSettings.setPublicPassword);
  const setSiteName = useMutation(api.organizationSettings.setSiteName);
  const setBrandingColors = useMutation(api.branding.setBrandingColors);
  const setLogo = useMutation(api.branding.setLogo);
  const generateLogoUploadUrl = useMutation(api.branding.generateLogoUploadUrl);

  const handlePasswordSave = async () => {
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
      setIsEditingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Fout bij bijwerken wachtwoord");
    }
  };

  const handlePasswordCancel = () => {
    setIsEditingPassword(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSiteNameSave = async () => {
    if (!newSiteName.trim()) {
      toast.error("Website naam mag niet leeg zijn");
      return;
    }

    try {
      await setSiteName({ name: newSiteName });
      toast.success("Website naam succesvol bijgewerkt!");
      setIsEditingSiteName(false);
      setNewSiteName("");
    } catch (error) {
      toast.error("Fout bij bijwerken website naam");
    }
  };

  const handleSiteNameCancel = () => {
    setIsEditingSiteName(false);
    setNewSiteName("");
  };

  const handleColorsSave = async () => {
    if (!newPrimaryColor || !newSecondaryColor) {
      toast.error("Beide kleuren moeten ingevuld zijn");
      return;
    }

    try {
      await setBrandingColors({ 
        primaryColor: newPrimaryColor, 
        secondaryColor: newSecondaryColor 
      });
      toast.success("Kleuren succesvol bijgewerkt!");
      setIsEditingColors(false);
      setNewPrimaryColor("");
      setNewSecondaryColor("");
    } catch (error) {
      toast.error("Fout bij bijwerken kleuren");
    }
  };

  const handleColorsCancel = () => {
    setIsEditingColors(false);
    setNewPrimaryColor("");
    setNewSecondaryColor("");
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Alleen afbeeldingsbestanden zijn toegestaan");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Bestand is te groot (max 5MB)");
      return;
    }

    setIsUploadingLogo(true);
    try {
      // Get upload URL
      const uploadUrl = await generateLogoUploadUrl();
      
      // Upload file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      if (!result.ok) {
        throw new Error("Upload failed");
      }
      
      const { storageId } = await result.json();
      
      // Save logo ID
      await setLogo({ logoId: storageId });
      
      toast.success("Logo succesvol geüpload!");
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Logo upload error:", error);
      toast.error("Fout bij uploaden logo");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (!brandingSettings) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Organisatie Instellingen</h2>
          <p className="text-gray-600">Beheer organisatie-brede instellingen, branding en toegang</p>
        </div>
      </div>

      {/* Website Name */}
      <div className="modern-card p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Website Naam</h3>
            <p className="text-gray-600">
              De naam die wordt weergegeven in de header en titel van de website
            </p>
          </div>
          {!isEditingSiteName && (
            <button
              onClick={() => {
                setIsEditingSiteName(true);
                setNewSiteName(brandingSettings.siteName);
              }}
              className="btn-primary"
            >
              Wijzigen
            </button>
          )}
        </div>

        {!isEditingSiteName ? (
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <div>
                <p className="font-semibold text-gray-900 text-lg">
                  {brandingSettings.siteName}
                </p>
                <p className="text-sm text-gray-600">
                  Huidige website naam
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Website Naam *
              </label>
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                className="modern-input"
                placeholder="Voer website naam in"
                required
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={handleSiteNameSave}
                className="btn-primary"
                disabled={!newSiteName.trim()}
              >
                Naam Opslaan
              </button>
              <button
                onClick={handleSiteNameCancel}
                className="btn-gray"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Branding Colors */}
      <div className="modern-card p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Branding Kleuren</h3>
            <p className="text-gray-600">
              Pas de primaire en secundaire kleuren van de website aan
            </p>
          </div>
          {!isEditingColors && (
            <button
              onClick={() => {
                setIsEditingColors(true);
                setNewPrimaryColor(brandingSettings.primaryColor);
                setNewSecondaryColor(brandingSettings.secondaryColor);
              }}
              className="btn-primary"
            >
              Wijzigen
            </button>
          )}
        </div>

        {!isEditingColors ? (
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center space-x-4">
                <div 
                  className="w-12 h-12 rounded-lg border-2 border-gray-200"
                  style={{ backgroundColor: brandingSettings.primaryColor }}
                ></div>
                <div>
                  <p className="font-semibold text-gray-900">Primaire Kleur</p>
                  <p className="text-sm text-gray-600 font-mono">{brandingSettings.primaryColor}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div 
                  className="w-12 h-12 rounded-lg border-2 border-gray-200"
                  style={{ backgroundColor: brandingSettings.secondaryColor }}
                ></div>
                <div>
                  <p className="font-semibold text-gray-900">Secundaire Kleur</p>
                  <p className="text-sm text-gray-600 font-mono">{brandingSettings.secondaryColor}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Primaire Kleur *
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={newPrimaryColor}
                    onChange={(e) => setNewPrimaryColor(e.target.value)}
                    className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newPrimaryColor}
                    onChange={(e) => setNewPrimaryColor(e.target.value)}
                    className="modern-input flex-1 font-mono"
                    placeholder="#161616"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Secundaire Kleur *
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={newSecondaryColor}
                    onChange={(e) => setNewSecondaryColor(e.target.value)}
                    className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newSecondaryColor}
                    onChange={(e) => setNewSecondaryColor(e.target.value)}
                    className="modern-input flex-1 font-mono"
                    placeholder="Bijv. #FAE682"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={handleColorsSave}
                className="btn-primary"
                disabled={!newPrimaryColor || !newSecondaryColor}
              >
                Kleuren Opslaan
              </button>
              <button
                onClick={handleColorsCancel}
                className="btn-gray"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logo Upload */}
      <div className="modern-card p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Logo</h3>
            <p className="text-gray-600">
              Upload een logo dat wordt weergegeven in de header (max 5MB, alleen afbeeldingen)
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingLogo}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploadingLogo ? "Uploaden..." : "Logo Uploaden"}
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-6">
          {logoUrl ? (
            <div className="flex items-center space-x-4">
              <img 
                src={logoUrl} 
                alt="Current logo" 
                className="w-16 h-16 object-contain rounded-lg border-2 border-gray-200 bg-white"
              />
              <div>
                <p className="font-semibold text-gray-900">Logo geüpload</p>
                <p className="text-sm text-gray-600">
                  Klik op "Logo Uploaden" om een nieuw logo te selecteren
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Geen logo geüpload</p>
                <p className="text-sm text-gray-600">
                  Upload een logo om het in de header weer te geven
                </p>
              </div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="hidden"
        />
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
          {!isEditingPassword && (
            <button
              onClick={() => setIsEditingPassword(true)}
              className="btn-primary"
            >
              {currentPassword ? "Wijzigen" : "Instellen"}
            </button>
          )}
        </div>

        {!isEditingPassword ? (
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
                onClick={handlePasswordSave}
                className="btn-primary"
                disabled={!newPassword || !confirmPassword}
              >
                Wachtwoord Opslaan
              </button>
              <button
                onClick={handlePasswordCancel}
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
              Het wachtwoord beschermt de toegang tot het publieke beschikbaarheidssysteem. 
              Deel dit wachtwoord alleen met geautoriseerde medewerkers. 
              Beheerders hebben altijd toegang via hun eigen inloggegevens.
              Wijzigingen aan branding worden direct toegepast voor alle gebruikers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
