import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface Props {
  onPasswordVerified: () => void;
  onAdminLogin: () => void;
}

export function PasswordPrompt({ onPasswordVerified, onAdminLogin }: Props) {
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const verifyPassword = useQuery(
    api.organizationSettings.verifyPublicPassword,
    password.length > 0 ? { password } : "skip"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsVerifying(true);
    setError("");

    // Wait a moment for the query to complete
    setTimeout(() => {
      if (verifyPassword === true) {
        onPasswordVerified();
      } else if (verifyPassword === false) {
        setError("Onjuist wachtwoord. Probeer opnieuw.");
        setPassword("");
      }
      setIsVerifying(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full mx-4">
        <div className="modern-card p-8 animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="w-16 h-16 gradient-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-brand-dark font-bold text-2xl">C</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Capitole Gent</h1>
            <p className="text-gray-600">Beschikbaarheden Systeem</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Wachtwoord vereist
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="modern-input"
                placeholder="Voer het wachtwoord in"
                required
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-600 mt-2">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying || !password.trim()}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? "Controleren..." : "Toegang"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center space-y-4">
            <button
              onClick={onAdminLogin}
              className="btn-outline w-full"
            >
              Beheerder Inloggen
            </button>
            <p className="text-sm text-gray-500">
              Neem contact op met een beheerder als je het wachtwoord niet weet
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
