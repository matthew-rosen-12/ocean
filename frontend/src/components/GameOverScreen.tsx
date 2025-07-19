import React, { useState, useEffect } from 'react';
import { FinalScores, UserInfo, userId } from 'shared/types';
import GeneratedNPCBackground from './backgrounds/GeneratedNPCBackground';

interface GameOverScreenProps {
  finalScores: FinalScores;
  users: Map<userId, UserInfo>;
  onReturnToLogin: () => void;
  winnerScreenshot?: string;
  currentUserId: userId;
}

export default function GameOverScreen({ finalScores, users, onReturnToLogin, winnerScreenshot, currentUserId }: GameOverScreenProps) {
  const [countdown, setCountdown] = useState(20);
  const [autoRedirectCancelled, setAutoRedirectCancelled] = useState(false);

  // Countdown timer for auto redirect
  useEffect(() => {
    if (autoRedirectCancelled) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onReturnToLogin();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRedirectCancelled, onReturnToLogin]);

  // Sort users by final scores
  const sortedResults = Object.entries(finalScores)
    .map(([userId, score]) => ({
      userId,
      score,
      user: users.get(userId)
    }))
    .filter(entry => entry.user) // Only include users we have data for
    .sort((a, b) => b.score - a.score);

  const winner = sortedResults[0];
  const currentPlayerWon = winner?.userId === currentUserId;

  const handleCancelAutoRedirect = () => {
    setAutoRedirectCancelled(true);
  };

  const handleReturnNow = () => {
    onReturnToLogin();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <GeneratedNPCBackground />
      <div className="backdrop-blur-lg bg-white/20 border border-white/30 rounded-3xl shadow-2xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto relative z-10">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none rounded-3xl"></div>
        
        {/* Content wrapper */}
        <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg mb-4">
            {currentPlayerWon ? '🏆 You Won! 🏆' : '🎉 Game Over! 🎉'}
          </h1>
          {winner && (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-yellow-300 drop-shadow-md mb-4">
                🏆 Winner: {winner.user?.nickname || winner.user?.animal || 'Unknown Player'}
              </h2>
              <p className="text-lg text-black mb-4">
                {winner.score} NPC{winner.score !== 1 ? 's' : ''} captured!
              </p>
              
              {/* Winner Screenshot */}
              {winnerScreenshot && (
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-black mb-2">Final Moment:</h3>
                  <div className="border-4 border-yellow-300/70 rounded-2xl overflow-hidden shadow-lg backdrop-blur-sm">
                    <img 
                      src={winnerScreenshot} 
                      alt="Winner's final game moment"
                      className="w-full max-w-2xl mx-auto block"
                      style={{ maxHeight: '400px', objectFit: 'contain' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Final Scores */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-white drop-shadow-md mb-4 text-center">
            Final Leaderboard
          </h3>
          <div className="space-y-3">
            {sortedResults.map((result, index) => (
              <div
                key={result.userId}
                className={`flex items-center justify-between p-4 rounded-2xl backdrop-blur-sm ${
                  index === 0
                    ? 'bg-yellow-300/20 border-2 border-yellow-300/60'
                    : index === 1
                    ? 'bg-gray-300/20 border-2 border-gray-300/60'
                    : index === 2
                    ? 'bg-orange-300/20 border-2 border-orange-300/60'
                    : 'bg-white/15 border border-white/30'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`text-lg font-bold ${
                    index === 0 ? 'text-yellow-300' : 'text-white/80'
                  }`}>
                    {index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <div>
                    <div className="font-semibold text-black">
                      {result.user?.nickname || result.user?.animal || 'Unknown Player'}
                    </div>
                    {result.user?.nickname && (
                      <div className="text-sm text-black">
                        {result.user.animal}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-black">
                    {result.score}
                  </div>
                  <div className="text-sm text-black">
                    NPC{result.score !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Return to Login Controls */}
        <div className="text-center space-y-4">
          {!autoRedirectCancelled ? (
            <div>
              <p className="text-black mb-4">
                Returning to{' '}
                <button
                  onClick={handleReturnNow}
                  className="text-black underline font-medium hover:text-gray-700"
                >
                  Guest Login
                </button>
                {' '}in {countdown} seconds
              </p>
              <button
                onClick={handleCancelAutoRedirect}
                className="bg-white/80 backdrop-blur-sm text-black border border-gray-300 px-6 py-2 rounded-2xl hover:bg-white transition-all duration-200 font-medium"
              >
                Cancel Auto-Redirect
              </button>
            </div>
          ) : (
            <div>
              <p className="text-black mb-4">Auto-redirect cancelled</p>
              <button
                onClick={handleReturnNow}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-2xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 text-lg font-medium shadow-lg"
              >
                Return to Guest Login
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}