import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { DebugSuperAdmin } from "./DebugSuperAdmin";

export function AdminSignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full">
      <DebugSuperAdmin />
      
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setFlow("signIn")}
          className={`px-4 py-2 rounded text-sm ${
            flow === "signIn"
              ? "text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          style={flow === "signIn" ? { backgroundColor: '#161616' } : {}}
        >
          Inloggen
        </button>
        <button
          type="button"
          onClick={() => setFlow("signUp")}
          className={`px-4 py-2 rounded text-sm ${
            flow === "signUp"
              ? "text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
          style={flow === "signUp" ? { backgroundColor: '#161616' } : {}}
        >
          Registreren
        </button>
      </div>
      
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Ongeldig wachtwoord. Probeer opnieuw.";
            } else if (error.message.includes("niet geautoriseerd om te registreren")) {
              toastTitle = "Dit e-mailadres is niet geautoriseerd. Neem contact op met een beheerder.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Kon niet inloggen. Bedoelde je te registreren?"
                  : "Kon niet registreren. Bedoelde je in te loggen?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <input
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
          style={{ borderColor: '#161616' }}
          type="email"
          name="email"
          placeholder="E-mail"
          required
        />
        <input
          className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
          style={{ borderColor: '#161616' }}
          type="password"
          name="password"
          placeholder="Wachtwoord"
          required
        />
        {flow === "signUp" && (
          <>
            <input
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2"
              style={{ borderColor: '#161616' }}
              type="text"
              name="name"
              placeholder="Naam"
              required
            />
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <strong>Let op:</strong> Alleen e-mailadressen die door een super admin zijn geautoriseerd kunnen registreren.
            </div>
          </>
        )}
        <button 
          className="px-4 py-2 text-white rounded hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: '#161616' }}
          type="submit" 
          disabled={submitting}
        >
          {submitting 
            ? (flow === "signIn" ? "Inloggen..." : "Registreren...") 
            : (flow === "signIn" ? "Inloggen" : "Registreren")
          }
        </button>
      </form>
      
      {flow === "signUp" && (
        <div className="mt-4 p-3 rounded text-sm" style={{ backgroundColor: '#FAE682', color: '#161616' }}>
          <p><strong>Let op:</strong> Gebruik het e-mailadres dat door een beheerder is toegevoegd om je account te registreren.</p>
        </div>
      )}
    </div>
  );
}
