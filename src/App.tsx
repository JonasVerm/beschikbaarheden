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
  
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const hasSuperAdmin = useQuery(api.initialSetup.hasSuperAdmin);
  const hasPublicPassword = useQuery(api.organizationSettings.hasPublicPassword);
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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 glass-effect h-20 flex justify-between items-center border-b border-white/20 shadow-lg px-6">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center">
            <span className="text-brand-dark font-bold text-xl">C</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Capitole Gent</h1>
            <p className="text-sm text-gray-600">Beschikbaarheden Systeem</p>
          </div>
        </div>
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
      
      <main className="flex-1 p-6">
        <Authenticated>
          <AdminDashboard />
        </Authenticated>
        
        <Unauthenticated>
          {hasSuperAdmin === false ? (
            <InitialSetup />
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
        </Unauthenticated>
      </main>
      
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
    </div>
  );
}
