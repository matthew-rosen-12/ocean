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
      <GeneratedNPCBackground />
      
      {/* Main card with glassmorphism effect */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="backdrop-blur-lg bg-white/20 border border-white/30 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          
          {/* Content */}
          <div className="relative z-10">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">🚪</div>
              <h1 className="text-2xl font-bold mb-2 text-white drop-shadow-lg">
                Removed Due to Inactivity
              </h1>
              <p className="text-white/90 drop-shadow-sm mb-4">
                You've been automatically removed from the game due to tab inactivity.
              </p>
              <p className="text-sm text-white/70 drop-shadow-sm">
                Keep the game tab active to stay connected!
              </p>
            </div>
            
            <button
              onClick={handleReturnToLogin}
              disabled={isReturning}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-2xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isReturning ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Returning...
                </span>
              ) : (
                "Return to Login"
              )}
            </button>
            
            <div className="mt-4 text-center">
              <p className="text-xs text-white/60 drop-shadow-sm">
                Tip: Don't switch tabs or minimize the window during gameplay
              </p>
            </div>
          </div>
        </div>
        
        {/* Floating elements for visual interest */}
        <div className="absolute -top-4 -left-4 w-20 h-20 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
    </div>
  );
}