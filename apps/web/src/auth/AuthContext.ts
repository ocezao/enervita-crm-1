import { createContext } from 'react';
import type { AuthUser } from './authTypes';

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
