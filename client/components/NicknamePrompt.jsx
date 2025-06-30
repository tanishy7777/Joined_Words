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

  return (
    <div className="nickname-prompt">
      <div className="auth-container">
        <h2>Welcome to Joined Words!</h2>
        <p>Choose how you'd like to sign in:</p>
        
        <div className="auth-methods">
          <button 
            className={`auth-method ${authMethod === 'anonymous' ? 'active' : ''}`}
            onClick={() => setAuthMethod('anonymous')}
          >
            Play as Guest
          </button>
          <button 
            className={`auth-method ${authMethod === 'google' ? 'active' : ''}`}
            onClick={() => setAuthMethod('google')}
          >
            Sign in with Google
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {authMethod === 'anonymous' && (
            <div className="nickname-input">
              <input
                type="text"
                placeholder="Enter your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                required
              />
            </div>
          )}
          
          <button type="submit" className="start-playing-btn">
            {authMethod === 'anonymous' ? 'Start Playing' : 'Continue with Google'}
          </button>
        </form>
      </div>
    </div>
  );
}
