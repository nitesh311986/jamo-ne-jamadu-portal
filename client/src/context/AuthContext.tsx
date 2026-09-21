import { useEffect, useState, type ReactNode, type ReactElement } from 'react';
import api, { getToken, setToken, removeToken } from '../api/axios';
import { AuthContext } from './auth';
import type { AuthContextValue } from './auth';
import type { User, LoginResponse, MeResponse, ApiError } from '../types/auth';
import type { AxiosError } from 'axios';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!getToken());

  useEffect(() => {
    const token = getToken();
    if (!token) {
      return;
    }

    api
      .get<MeResponse>('/api/v1/auth/me')
      .then((response) => {
        setUser(response.data.user);
      })
      .catch(() => {
        removeToken();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response = await api.post<LoginResponse>('/api/v1/auth/login', { email, password });
      setToken(response.data.token);
      setUser(response.data.user);
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      const message = axiosError.response?.data?.error ?? 'Login failed';
      throw new Error(message, { cause: err });
    }
  };

  const logout = (): void => {
    removeToken();
    setUser(null);
    window.location.href = '/login';
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
