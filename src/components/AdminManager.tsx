import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function AdminManager() {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");

  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "superadmin">("admin");
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");

  const admins = useQuery(api.auth.listAdmins);
  const createAdmin = useMutation(api.auth.createAdminAccount);
  const removeAdmin = useMutation(api.auth.removeAdmin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;

    setIsCreating(true);
    setMessage("");

    try {
      await createAdmin({
        email: email.trim(),
        name: name.trim(),
        role: role,
      });
      setMessage(`Beheerder record aangemaakt voor ${email.trim()}. De nieuwe beheerder moet zich nu registreren via de inlogpagina met dit e-mailadres en een zelf gekozen wachtwoord.`);
      resetForm();
    } catch (error) {
      setMessage(`Fout: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setName("");
    setRole("admin");
    setShowForm(false);
  };

  const handleRemoveAdmin = async (adminId: any) => {
    if (confirm("Weet je zeker dat je deze beheerder wilt verwijderen?")) {
      try {
        await removeAdmin({ adminId });
        setMessage("Beheerder succesvol verwijderd");
      } catch (error) {
        setMessage(`Fout: ${error}`);
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold" style={{ color: '#161616' }}>Beheerders Beheer</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-white rounded hover:opacity-80"
          style={{ backgroundColor: '#161616' }}
        >
          Beheerder Toevoegen
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#FAE682' }}>
          <p className="text-sm" style={{ color: '#161616' }}>{message}</p>
        </div>
      )}

      {showForm && (
        <div className="p-4 rounded-lg mb-6" style={{ backgroundColor: '#FAE682' }}>
          <h3 className="font-semibold mb-4" style={{ color: '#161616' }}>
            Nieuwe Beheerder Toevoegen
          </h3>
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
            
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#161616' }}>Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "superadmin")}
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
                style={{ borderColor: '#161616' }}
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Super Admin</option>
              </select>
            </div>
            
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 text-white rounded hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: '#161616' }}
              >
                {isCreating ? "Aanmaken..." : "Aanmaken"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {admins?.map((admin) => (
          <div key={admin._id} className="flex justify-between items-center p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold" style={{ color: '#161616' }}>{admin.name}</h3>
              <p className="text-sm text-gray-600">{admin.email}</p>
              <p className="text-sm font-medium" style={{ color: admin.adminRole === 'superadmin' ? '#dc2626' : '#059669' }}>
                {admin.adminRole === 'superadmin' ? 'Super Admin' : 'Admin'}
              </p>
              <p className="text-xs text-gray-500">
                Aangemaakt: {new Date(admin._creationTime).toLocaleDateString('nl-BE')}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRemoveAdmin(admin._id)}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
              >
                Verwijderen
              </button>
            </div>
          </div>
        ))}
        
        {admins?.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Geen beheerders gevonden
          </div>
        )}
      </div>
    </div>
  );
}
