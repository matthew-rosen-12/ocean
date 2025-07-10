import { useState } from 'react';
import GeneratedNPCBackground from './backgrounds/GeneratedNPCBackground';

interface Props {
  onReturnToLogin: () => void;
}

export default function InactivityKick({ onReturnToLogin }: Props) {
  const [isReturning, setIsReturning] = useState(false);

  const handleReturnToLogin = () => {
    setIsReturning(true);
    // Small delay for better UX
    setTimeout(() => {
      onReturnToLogin();
    }, 500);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative">
      <GeneratedNPCBackground variant="alt2" />
      <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full mx-4 relative z-10">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🚪</div>
          <h1 className="text-2xl font-bold mb-2 text-gray-800">
            Removed Due to Inactivity
          </h1>
          <p className="text-gray-600 mb-4">
            You've been automatically removed from the game due to tab inactivity.
          </p>
          <p className="text-sm text-gray-500">
            Keep the game tab active to stay connected!
          </p>
        </div>
        
        <button
          onClick={handleReturnToLogin}
          disabled={isReturning}
          className="w-full bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
        >
          {isReturning ? "Returning..." : "Return to Login"}
        </button>
        
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Tip: Don't switch tabs or minimize the window during gameplay
          </p>
        </div>
      </div>
    </div>
  );
}