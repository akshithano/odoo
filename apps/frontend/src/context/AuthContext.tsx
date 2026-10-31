import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { UserRole } from '@odoo/shared';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive?: boolean;
  customerId?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, userData: AuthUser) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getStorageItem = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
};

const setStorageItem = (key: string, value: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage write errors
  }
};

const removeStorageItem = (key: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage removal errors
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = getStorageItem('auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => getStorageItem('auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const login = (newToken: string, userData: AuthUser) => {
    setStorageItem('auth_token', newToken);
    setStorageItem('auth_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      removeStorageItem('auth_token');
      removeStorageItem('auth_user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const storedToken = getStorageItem('auth_token');
    if (!storedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiClient.get('/auth/me');
      if (res.data?.data) {
        const u = res.data.data;
        const mappedUser: AuthUser = {
          id: u.id,
          email: u.email,
          role: u.role,
          firstName: u.firstName,
          lastName: u.lastName,
          isActive: u.isActive,
          customerId: u.customer?.id || null,
        };
        setUser(mappedUser);
        setStorageItem('auth_user', JSON.stringify(mappedUser));
      }
    } catch {
      // If token is expired or invalid, clear state
      removeStorageItem('auth_token');
      removeStorageItem('auth_user');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
