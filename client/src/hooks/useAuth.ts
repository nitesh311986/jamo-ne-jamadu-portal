import { useContext } from 'react';
import { AuthContext } from '../context/auth';
import type { AuthContextValue } from '../context/auth';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
