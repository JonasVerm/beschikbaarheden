import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface MessageFormProps {
  personId: Id<"people">;
  personName: string;
  onClose: () => void;
}

export function MessageForm({ personId, personName, onClose }: MessageFormProps) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendMessage = useMutation(api.messages.sendMessage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !content.trim()) {
      toast.error("Vul alle velden in");
      return;
    }

    setIsSubmitting(true);
    
    try {
      await sendMessage({
        personId,
        subject: subject.trim(),
        content: content.trim(),
      });
      
      toast.success("Bericht verzonden naar de beheerders");
      setSubject("");
      setContent("");
      onClose();
    } catch (error) {
      toast.error("Fout bij verzenden bericht");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Bericht Versturen</h3>
              <p className="text-gray-600">Van: {personName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Onderwerp *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Waar gaat je bericht over?"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Bericht *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Typ hier je bericht..."
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Je bericht wordt verzonden naar medewerkers van jouw organisatie.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting || !subject.trim() || !content.trim()}
                className="flex-1 py-3 px-6 rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#FAE682', color: '#161616' }}
              >
                {isSubmitting ? 'Verzenden...' : 'Bericht Verzenden'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-3 px-6 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-all duration-200 disabled:opacity-50"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
