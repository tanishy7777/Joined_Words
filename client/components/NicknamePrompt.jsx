import React, { useState } from 'react';
import { useAuth } from '../src/contexts/AuthContext';

export default function NicknamePrompt() {
  const [nickname, setNickname] = useState('');
  const [authMethod, setAuthMethod] = useState('anonymous');
  const { signInAnonymouslyWithNickname, signInWithGoogle, setShowNicknamePrompt } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (authMethod === 'anonymous' && nickname.trim()) {
      try {
        await signInAnonymouslyWithNickname(nickname.trim());
        setShowNicknamePrompt(false);
      } catch (error) {
        alert('Failed to create account. Please try again.');
      }
    } else if (authMethod === 'google') {
      try {
        await signInWithGoogle();
        setShowNicknamePrompt(false);
      } catch (error) {
        alert('Failed to sign in with Google. Please try again.');
      }
    }
  };

  // return (
  //   <div className="nickname-prompt">
  //     <div className="auth-container">
  //       <h2>Welcome to Joined Words!</h2>
  //       <p>Choose how you'd like to sign in:</p>
        
  //       <div className="auth-methods">
  //         <button 
  //           className={`auth-method ${authMethod === 'anonymous' ? 'active' : ''}`}
  //           onClick={() => setAuthMethod('anonymous')}
  //         >
  //           Play as Guest
  //         </button>
  //         <button 
  //           className={`auth-method ${authMethod === 'google' ? 'active' : ''}`}
  //           onClick={() => setAuthMethod('google')}
  //         >
  //           Sign in with Google
  //         </button>
  //       </div>

  //       <form onSubmit={handleSubmit}>
  //         {authMethod === 'anonymous' && (
  //           <div className="nickname-input">
  //             <input
  //               type="text"
  //               placeholder="Enter your nickname"
  //               value={nickname}
  //               onChange={(e) => setNickname(e.target.value)}
  //               maxLength={20}
  //               required
  //             />
  //           </div>
  //         )}
          
  //         <button type="submit" className="start-playing-btn">
  //           {authMethod === 'anonymous' ? 'Start Playing' : 'Continue with Google'}
  //         </button>
  //       </form>
  //     </div>
  //   </div>
  // );
  return (
  <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-blue-900">Welcome to Joined Words!</h2>
        <p className="mt-2 text-sm text-blue-700">Choose how you'd like to sign in:</p>
      </div>

      {/* Auth Methods */}
      <div className="flex justify-center space-x-4">
        <button
          className={`px-4 py-2 rounded-lg font-medium transition ${
            authMethod === 'anonymous'
              ? 'bg-blue-800 text-white'
              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
          }`}
          onClick={() => setAuthMethod('anonymous')}
        >
          Play as Guest
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition ${
            authMethod === 'google'
              ? 'bg-blue-800 text-white'
              : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
          }`}
          onClick={() => setAuthMethod('google')}
        >
          Sign in with Google
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {authMethod === 'anonymous' && (
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
        )}

        <button
          type="submit"
          className="w-full bg-blue-800 text-white py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
        >
          {authMethod === 'anonymous' ? 'Start Playing' : 'Continue with Google'}
        </button>
      </form>
    </div>
  </div>
);

}
