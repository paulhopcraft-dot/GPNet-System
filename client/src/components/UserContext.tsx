import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  userType: 'admin' | 'client';
  organizationId?: string;
  permissions?: string[];
  isImpersonating?: boolean;
  impersonationTarget?: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  // TEMPORARY: Mock user for development bypass
  const [user, setUser] = useState<User | null>({
    id: 'dev-user',
    email: 'support@gpnet.au',
    name: 'Natalie Support',
    role: 'Administrator',
    userType: 'admin',
    permissions: ['admin', 'superuser']
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // TEMPORARY: Authentication bypassed for development
    // Fetch user from authentication API
    // const fetchUser = async () => {
    //   try {
    //     const response = await fetch('/api/auth/me', {
    //       credentials: 'include' // CRITICAL: Include cookies for session
    //     });
    //     if (response.ok) {
    //       const userData = await response.json();
    //       setUser(userData);
    //     } else {
    //       // User not authenticated, set to null
    //       setUser(null);
    //     }
    //   } catch (error) {
    //     console.error('Failed to fetch user:', error);
    //     setUser(null);
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };

    // fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}