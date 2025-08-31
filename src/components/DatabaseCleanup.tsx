import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function DatabaseCleanup() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<string>("");
  
  const cleanupDuplicateUsers = useMutation(api.cleanup.cleanupDuplicateUsers);
  const checkDatabaseHealth = useMutation(api.cleanup.checkDatabaseHealth);

  const handleCleanup = async () => {
    setIsRunning(true);
    setResult("");
    
    try {
      // First check the health
      const healthCheck = await checkDatabaseHealth();
      setResult(`Database Health Check:\n${JSON.stringify(healthCheck, null, 2)}\n\n`);
      
      // Then run cleanup
      const cleanupResult = await cleanupDuplicateUsers();
      setResult(prev => prev + `Cleanup Result:\n${JSON.stringify(cleanupResult, null, 2)}`);
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4" style={{ color: '#161616' }}>
          Database Cleanup
        </h2>
        
        <button
          onClick={handleCleanup}
          disabled={isRunning}
          className="w-full px-4 py-2 text-white rounded hover:opacity-80 disabled:opacity-50 mb-4"
          style={{ backgroundColor: '#161616' }}
        >
          {isRunning ? "Running Cleanup..." : "Run Database Cleanup"}
        </button>
        
        {result && (
          <div className="p-3 rounded text-sm bg-gray-100">
            <pre className="whitespace-pre-wrap">{result}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
