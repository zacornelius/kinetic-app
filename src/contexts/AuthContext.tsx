"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored authentication on app load
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      // Check localStorage for PWA persistence
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');
      
      if (storedToken && storedUser) {
        // Verify token is still valid
        const response = await fetch('/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });
        
        if (response.ok) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
        } else {
          // Token is invalid, clear storage
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear invalid data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const { token, user: userData } = data;
        
        // Store in localStorage for PWA persistence
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, firstName, lastName }),
      });

      if (response.ok) {
        const data = await response.json();
        const { token, user: userData } = data;
        
        // Store in localStorage for PWA persistence
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        
        setUser(userData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Signup failed:', error);
      return false;
    }
  };

  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
  };

  const value = {
    user,
    login,
    signup,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
