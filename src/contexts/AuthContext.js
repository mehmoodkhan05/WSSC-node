import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSession, getProfile } from '../lib/auth';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const session = await getSession();
      if (session.session) {
        const userProfile = await getProfile();
        setUser(session.session);
        setProfile(userProfile);
      } else {
        // Clear state if no session
        setUser(null);
        setProfile(null);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
      // Clear state on error
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const result = await require('../lib/auth').signOut();
      if (result.error) {
        throw new Error(result.error);
      }
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      // Re-throw the error so it can be handled by the caller
      throw error;
    }
  };

  const value = {
    user,
    profile,
    loading,
    signOut,
    refreshProfile: checkAuthState,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
