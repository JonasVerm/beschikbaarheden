import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useState } from "react";
import { SignInForm } from "./SignInForm";
import { AdminSignInForm } from "./components/AdminSignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { PublicView } from "./components/PublicView";
import { AdminDashboard } from "./components/AdminDashboard";
import { InitialSetup } from "./components/InitialSetup";
import { PasswordPrompt } from "./components/PasswordPrompt";

export default function App() {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [isRaining, setIsRaining] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const hasSuperAdmin = useQuery(api.initialSetup.hasSuperAdmin);
  const hasPublicPassword = useQuery(api.organizationSettings.hasPublicPassword);
  const brandingSettings = useQuery(api.organizationSettings.getBrandingSettings);
  const logoUrl = useQuery(
    api.storage.getUrl,
    brandingSettings?.logoId ? { storageId: brandingSettings.logoId as any } : "skip"
  );
  const linkUserToAdminRole = useMutation(api.roleLinking.linkUserToAdminRole);
  
  // Try to link user to admin role when they log in
  useEffect(() => {
    if (loggedInUser && !loggedInUser.adminRole) {
      linkUserToAdminRole().catch(() => {
        // Ignore errors - user might not be an admin
      });
    }
  }, [loggedInUser, linkUserToAdminRole]);

  // Check if password verification is needed for public access
  const needsPasswordVerification = hasPublicPassword && !isPasswordVerified && !showAdminLogin;

  // Update document title when branding settings change
  useEffect(() => {
    if (brandingSettings?.siteName) {
      document.title = `${brandingSettings.siteName} - Beschikbaarheden`;
    }
  }, [brandingSettings?.siteName]);

  // Update CSS custom properties for dynamic colors
  useEffect(() => {
    if (brandingSettings) {
      document.documentElement.style.setProperty('--primary-color', brandingSettings.primaryColor);
      document.documentElement.style.setProperty('--secondary-color', brandingSettings.secondaryColor);
      
      // Create a faded version of the secondary color for gradients
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };
      
      const rgb = hexToRgb(brandingSettings.secondaryColor);
      if (rgb) {
        const fadedColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
        document.documentElement.style.setProperty('--secondary-color-fade', fadedColor);
      }
    }
  }, [brandingSettings]);

  // Handle easter egg click
  const handleEasterEggClick = () => {
    if (isRaining) return;
    setIsRaining(true);
    
    const createLetterM = () => {
      const m = document.createElement('div');
      m.innerHTML = `<div class="w-12 h-12 text-gray-400 font-bold text-4xl flex items-center justify-center">M</div>`;
      m.style.cssText = `position:fixed;top:-60px;left:${Math.random()*window.innerWidth}px;z-index:9999;pointer-events:none;animation:fall 3s linear forwards;transform:rotate(${Math.random()*360}deg)`;
      document.body.appendChild(m);
      setTimeout(() => m.remove(), 3000);
    };
    
    const interval = setInterval(createLetterM, 100);
    
    // Show credits popup after 2 seconds
    setTimeout(() => {
      setShowCredits(true);
      // Auto-close credits after 5 seconds
      setTimeout(() => {
        setShowCredits(false);
      }, 5000);
    }, 2000);
    
    setTimeout(() => { clearInterval(interval); setIsRaining(false); }, 3000);
  };

  // Handle logo click to go home
  const handleLogoClick = () => {
    // Reset all states to go back to the home/password prompt page
    setShowAdminLogin(false);
    setIsPasswordVerified(false);
  };

  // Handle credits popup close
  const handleCreditsClose = () => {
    setShowCredits(false);
  };

  // Determine if easter egg should be shown (only on password prompt page)
  const showEasterEgg = hasSuperAdmin !== false && needsPasswordVerification;

  return (
    <div className="min-h-screen h-screen flex flex-col overflow-hidden">
      <header className="sticky top-0 z-50 glass-effect h-20 flex justify-between items-center border-b border-white/20 shadow-lg px-6 flex-shrink-0">
        <button 
          onClick={handleLogoClick}
          className="flex items-center space-x-4 hover:opacity-80 transition-opacity duration-200 cursor-pointer"
        >
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="h-12 w-12 object-contain rounded-lg shadow-md bg-white"
            />
          ) : (
            <div 
              className="h-12 w-12 rounded-lg shadow-md flex items-center justify-center text-white font-bold text-xl" 
              style={{ backgroundColor: brandingSettings?.primaryColor || '#161616' }}
            >
              {brandingSettings?.siteName?.charAt(0).toUpperCase() || 'C'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {brandingSettings?.siteName || 'Capitole Gent'}
            </h1>
            <p className="text-sm text-gray-600">mijnbeschikbaarheden.be</p>
          </div>
        </button>
        <div className="flex items-center gap-6">
          <Authenticated>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{loggedInUser?.name || 'Admin'}</p>
                <p className="text-xs text-brand-primary font-semibold">
                  {loggedInUser?.adminRole === "superadmin" ? "Super Admin" : "Admin"}
                </p>
              </div>
              <div className="w-10 h-10 gradient-accent rounded-full flex items-center justify-center">
                <span className="text-brand-dark font-semibold">
                  {(loggedInUser?.name || 'A').charAt(0).toUpperCase()}
                </span>
              </div>
              <SignOutButton />
            </div>
          </Authenticated>
          <Unauthenticated>
            {!showAdminLogin && !needsPasswordVerification && (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="btn-outline"
              >
                Beheerder Inloggen
              </button>
            )}
          </Unauthenticated>
        </div>
      </header>
      
      <div className="flex-1 flex overflow-hidden">
        <Authenticated>
          <AdminDashboard />
        </Authenticated>
        
        <Unauthenticated>
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {hasSuperAdmin === false ? (
                <InitialSetup onSetupComplete={() => setShowAdminLogin(true)} />
              ) : needsPasswordVerification ? (
                <PasswordPrompt 
                  onPasswordVerified={() => setIsPasswordVerified(true)} 
                  onAdminLogin={() => setShowAdminLogin(true)}
                />
              ) : showAdminLogin ? (
                <div className="max-w-md mx-auto mt-12 animate-fade-in-up">
                  <div className="modern-card p-8">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">Welkom Terug</h3>
                        <p className="text-gray-600">Log in om door te gaan</p>
                      </div>
                      <button
                        onClick={() => setShowAdminLogin(false)}
                        className="text-gray-400 hover:text-gray-600 text-2xl font-light"
                      >
                        ×
                      </button>
                    </div>
                    <AdminSignInForm />
                  </div>
                </div>
              ) : (
                <PublicView />
              )}
            </div>
          </div>
        </Unauthenticated>
      </div>
      
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px',
          },
        }}
      />
      
      {/* Easter egg - only show on password prompt page */}
      {showEasterEgg && (
        <footer className="fixed bottom-0 right-0 z-10">
          <button 
            onClick={handleEasterEggClick}
            className="text-gray-300 opacity-40 hover:opacity-100 transition-opacity duration-500 select-none cursor-pointer p-4 rounded-full hover:bg-gray-100/10"
            disabled={isRaining}
          >
            <div className="w-4 h-4 font-bold text-lg flex items-center justify-center">M</div>
          </button>
        </footer>
      )}

      {/* Credits Popup */}
      {showCredits && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4"
          onClick={handleCreditsClose}
        >
          <div 
            className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl transform animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <h2 className="text-3xl font-bold text-brand-primary mb-6">Miljaardedju!</h2>
              <div className="space-y-4 text-gray-700">
                <p className="text-lg">
                  <span className="font-semibold">Naar een idee van:</span>
                  <br />
                  Imke Martens
                </p>
                <p className="text-lg">
                  <span className="font-semibold">Ontwikkeling:</span>
                  <br />
                  Jonas Vermeulen
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
