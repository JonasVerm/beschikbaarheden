import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function InitialSetup() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");

  const createFirstSuperAdmin = useMutation(api.initialSetup.createFirstSuperAdmin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;

    setIsCreating(true);
    setMessage("");

    try {
      await createFirstSuperAdmin({
        email: email.trim(),
        name: name.trim(),
      });
      setMessage(`Eerste super admin aangemaakt voor ${email.trim()}. Je kunt nu registreren via de inlogpagina met dit e-mailadres.`);
      setEmail("");
      setName("");
    } catch (error) {
      setMessage(`Fout: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: '#161616' }}>
          Eerste Super Admin Aanmaken
        </h2>
        
        <p className="text-sm text-gray-600 mb-6 text-center">
          Er is nog geen super admin. Maak de eerste super admin aan om het systeem te kunnen beheren.
        </p>

        {message && (
          <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#FAE682' }}>
            <p className="text-sm" style={{ color: '#161616' }}>{message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#161616' }}>Naam</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
              style={{ borderColor: '#161616' }}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#161616' }}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
              style={{ borderColor: '#161616' }}
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isCreating}
            className="w-full px-4 py-2 text-white rounded hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: '#161616' }}
          >
            {isCreating ? "Aanmaken..." : "Super Admin Aanmaken"}
          </button>
        </form>
      </div>
    </div>
  );
}
