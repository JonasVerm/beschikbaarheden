import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

export function MessagesManager() {
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  
  const messages = useQuery(api.messages.listMessages);
  const markAsRead = useMutation(api.messages.markAsRead);
  const markAllAsRead = useMutation(api.messages.markAllAsRead);
  const deleteMessage = useMutation(api.messages.deleteMessage);

  const handleMarkAsRead = async (messageId: Id<"messages">) => {
    try {
      await markAsRead({ messageId });
    } catch (error) {
      toast.error("Fout bij markeren als gelezen");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      toast.success("Alle berichten gemarkeerd als gelezen");
    } catch (error) {
      toast.error("Fout bij markeren alle berichten");
    }
  };

  const handleDelete = async (messageId: Id<"messages">) => {
    if (!confirm("Weet je zeker dat je dit bericht wilt verwijderen?")) return;
    
    try {
      await deleteMessage({ messageId });
      toast.success("Bericht verwijderd");
      if (selectedMessage?._id === messageId) {
        setSelectedMessage(null);
      }
    } catch (error) {
      toast.error("Fout bij verwijderen bericht");
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('nl-BE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const unreadCount = messages?.filter(m => !m.isRead).length || 0;

  if (!messages) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (selectedMessage) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="modern-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Bericht Details</h2>
              <p className="text-gray-600">Van {selectedMessage.personName}</p>
            </div>
            <button
              onClick={() => setSelectedMessage(null)}
              className="btn-gray"
            >
              ← Terug naar Berichten
            </button>
          </div>
        </div>

        {/* Message Details */}
        <div className="modern-card p-8">
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedMessage.personName}</h3>
                    <p className="text-sm text-gray-500">{formatDate(selectedMessage._creationTime)}</p>
                  </div>
                  {!selectedMessage.isRead && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                      Nieuw
                    </span>
                  )}
                </div>
                
                <div className="mb-6">
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">{selectedMessage.subject}</h4>
                  <div className="prose max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selectedMessage.content}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-6 border-t border-gray-200">
              {!selectedMessage.isRead && (
                <button
                  onClick={() => handleMarkAsRead(selectedMessage._id)}
                  className="btn-primary"
                >
                  Markeer als Gelezen
                </button>
              )}
              <button
                onClick={() => handleDelete(selectedMessage._id)}
                className="btn-danger"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="modern-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Berichten</h2>
            <p className="text-gray-600">
              Berichten van medewerkers ({messages.length} totaal, {unreadCount} ongelezen)
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="btn-secondary"
            >
              Alle Markeren als Gelezen
            </button>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div className="modern-card p-6">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Geen berichten</h3>
            <p className="text-gray-600">Er zijn nog geen berichten ontvangen van medewerkers.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message._id}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:shadow-md ${
                  message.isRead 
                    ? 'bg-white border-gray-200 hover:border-gray-300' 
                    : 'bg-blue-50 border-blue-200 hover:border-blue-300'
                }`}
                onClick={() => {
                  setSelectedMessage(message);
                  if (!message.isRead) {
                    handleMarkAsRead(message._id);
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">
                            {message.personName}
                          </h4>
                          {!message.isRead && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{formatDate(message._creationTime)}</p>
                      </div>
                    </div>
                    <h5 className="text-sm font-medium text-gray-900 mb-1 truncate">
                      {message.subject}
                    </h5>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {message.content}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(message._id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Verwijderen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H8a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
