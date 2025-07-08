import React, { useState } from 'react';
import { useAuth } from '../src/contexts/AuthContext';

export default function NicknamePrompt() {
  const [nickname, setNickname] = useState('');
  const [authMethod, setAuthMethod] = useState('anonymous');
  const [submitPressed, setSubmitPressed] = useState(false);
  const { signInAnonymouslyWithNickname, setShowNicknamePrompt } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nickname.trim() || submitPressed) {
      return;
    }

    setSubmitPressed(true);

    try {
      await signInAnonymouslyWithNickname(nickname.trim());
      setShowNicknamePrompt(false); 
    } catch (error) {
      toast.error("Failed to create guest account. Please try again.", {
          position: "bottom-right",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
    } finally {
      setSubmitPressed(false);
    }
  };


 return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-blue-900">Welcome to Joined Words!</h2>
          <p className="mt-2 text-sm text-blue-700">Enter a nickname to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Enter your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              required
              className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <button
            type="submit"
            disabled={submitPressed}
            className="w-full bg-blue-800 text-white py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitPressed ? 'Joining...' : 'Start Playing'}
          </button>
        </form>
      </div>
    </div>
  );
}
