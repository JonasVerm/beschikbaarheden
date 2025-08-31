import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Props {
  showId: Id<"shows">;
  onBack: () => void;
}

export function ShowDetails({ showId, onBack }: Props) {
  const showData = useQuery(api.shows.getWithShifts, { showId });
  const availability = useQuery(api.shifts.getAvailabilityForShow, { showId });
  const assignPerson = useMutation(api.shifts.assignPerson);

  if (!showData) {
    return <div>Laden...</div>;
  }

  const handleAssign = async (shiftId: Id<"shifts">, personId: Id<"people"> | null) => {
    await assignPerson({ shiftId, personId: personId || undefined });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#161616' }}>{showData.name}</h2>
            <p className="text-gray-600">
              {new Date(showData.date).toLocaleDateString('nl-BE')} om {showData.startTime}
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded hover:opacity-80"
            style={{ backgroundColor: '#FAE682', color: '#161616' }}
          >
            ← Terug naar Voorstellingen
          </button>
        </div>

        <div className="space-y-6">
          {availability?.map((shift) => (
            <div key={shift._id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg" style={{ color: '#161616' }}>
                    {shift.role}
                    {shift.position && shift.peopleNeeded && shift.peopleNeeded > 1 && ` #${shift.position}`}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {shift.personId ? "Toegewezen" : "Niet toegewezen"}
                    {shift.peopleNeeded && shift.peopleNeeded > 1 && ` (${shift.position}/${shift.peopleNeeded})`}
                  </p>
                  {shift.startTime && (
                    <p className="text-sm text-gray-500">
                      Start tijd: {shift.startTime}
                    </p>
                  )}
                </div>
                
                {shift.personId && (
                  <button
                    onClick={() => handleAssign(shift._id, null)}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    Niet Toewijzen
                  </button>
                )}
              </div>

              {shift.personId ? (
                <div className="p-3 rounded" style={{ backgroundColor: '#FAE682' }}>
                  <p className="font-medium" style={{ color: '#161616' }}>
                    Toegewezen aan: {showData.shifts.find((s: any) => s._id === shift._id)?.person?.name}
                  </p>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium mb-2" style={{ color: '#161616' }}>Beschikbare Mensen:</h4>
                  {shift.availablePeople.length === 0 ? (
                    <p className="text-gray-500 italic">Niemand beschikbaar voor deze dienst</p>
                  ) : (
                    <div className="space-y-2">
                      {shift.availablePeople.map((person) => (
                        <div key={person._id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span style={{ color: '#161616' }}>{person.name}</span>
                          <button
                            onClick={() => handleAssign(shift._id, person._id)}
                            className="px-3 py-1 text-white rounded text-sm hover:opacity-80"
                            style={{ backgroundColor: '#161616' }}
                          >
                            Toewijzen
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
