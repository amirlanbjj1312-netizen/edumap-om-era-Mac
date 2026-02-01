import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '../config/apiConfig';
import { SCHOOL_ACCOUNTS } from '../data/schoolAccounts';
import { supabase } from '../services/supabaseClient';

const LOCAL_STORAGE_KEY = 'EDUMAP_ACTIVE_SCHOOL_ACCOUNT_V1';

const AuthContext = createContext({
  account: null,
  hydrated: false,
  signInWithSchoolAccount: async () => ({ success: false }),
  signInWithEmail: async () => ({ success: false }),
  signOut: async () => {},
  deleteAccount: async () => ({ success: false }),
  updateAccount: async () => ({ success: false }),
  updatePassword: async () => ({ success: false }),
});

const normalize = (value = '') => value.trim().toLowerCase();

const toSupabaseAccount = (user) => {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  const firstName = metadata.firstName || metadata.name || '';
  return {
    provider: 'supabase',
    id: user.id,
    email: user.email || '',
    firstName,
    lastName: metadata.lastName || '',
    phone: metadata.phone || '',
    organization: metadata.organization || '',
    bin: metadata.bin || '',
    iin: metadata.iin || '',
    role: metadata.role || '',
    ecpStatus: metadata.ecpStatus || '',
    schoolVerified: metadata.schoolVerified ?? false,
    verificationStatus: metadata.verificationStatus || '',
    verificationSource: metadata.verificationSource || '',
  };
};

const findSchoolAccount = ({ email, password, organization, bin, iin }) => {
  const normalizedEmail = normalize(email);
  const normalizedOrg = normalize(organization);
  const trimmedBin = (bin || '').trim();
  const trimmedIin = (iin || '').trim();

  return SCHOOL_ACCOUNTS.find((account) => {
    if (normalize(account.email) !== normalizedEmail) return false;
    if (account.password !== password) return false;
    if (normalizedOrg && normalize(account.organization) !== normalizedOrg) return false;
    if (trimmedBin && account.bin !== trimmedBin) return false;
    if (trimmedIin && account.iin !== trimmedIin) return false;
    return true;
  });
};

export const AuthProvider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user && isMounted) {
          setAccount(toSupabaseAccount(data.session.user));
        } else {
          const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
          if (raw && isMounted) {
            const parsed = JSON.parse(raw);
            setAccount(parsed);
          }
        }
      } catch (error) {
        console.warn('[AuthProvider] Failed to hydrate account', error);
      } finally {
        if (isMounted) {
          setHydrated(true);
        }
      }
    })();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAccount(toSupabaseAccount(session.user));
      } else {
        setAccount((prev) => (prev?.provider === 'supabase' ? null : prev));
      }
    });
    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    (async () => {
      try {
        if (account?.provider === 'local') {
          await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(account));
        } else {
          await AsyncStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      } catch (error) {
        console.warn('[AuthProvider] Failed to persist account', error);
      }
    })();
  }, [account, hydrated]);

  const signInWithSchoolAccount = async (credentials) => {
    const match = findSchoolAccount(credentials);
    if (!match) {
      return {
        success: false,
        error: 'Неверные данные. Проверьте email, пароль, BIN и ИИН.',
      };
    }
    await supabase.auth.signOut().catch(() => {});
    const nextAccount = { ...match, provider: 'local' };
    setAccount(nextAccount);
    return { success: true, account: nextAccount };
  };

  const signInWithEmail = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const signOut = async () => {
    if (account?.provider === 'supabase') {
      await supabase.auth.signOut();
    }
    setAccount(null);
  };

  const deleteAccount = async () => {
    try {
      if (account?.provider !== 'supabase') {
        setAccount(null);
        return { success: true };
      }

    const { data, error: sessionError } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (sessionError || !token) {
        return { success: false, error: 'Missing auth token.' };
      }

      const response = await fetch(buildApiUrl('/auth/delete-account'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          error: payload?.error || payload?.message || 'Delete failed.',
        };
      }

      await supabase.auth.signOut().catch(() => {});
      setAccount(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error?.message || 'Delete failed.' };
    }
  };

  const updateAccount = async (updates) => {
    if (account?.provider === 'supabase') {
      const nextMetadata = {
        firstName: updates.firstName ?? account.firstName ?? '',
        lastName: updates.lastName ?? account.lastName ?? '',
        phone: updates.phone ?? account.phone ?? '',
        organization: updates.organization ?? account.organization ?? '',
        bin: updates.bin ?? account.bin ?? '',
        iin: updates.iin ?? account.iin ?? '',
        role: updates.role ?? account.role ?? '',
      };
      const payload = { data: nextMetadata };
      if (updates.email && updates.email !== account.email) {
        payload.email = updates.email;
      }
      const { data, error } = await supabase.auth.updateUser(payload);
      if (error) {
        return { success: false, error: error.message };
      }
      setAccount(toSupabaseAccount(data?.user));
      return { success: true };
    }
    setAccount((prev) => (prev ? { ...prev, ...updates } : { ...updates }));
    return { success: true };
  };

  const updatePassword = async ({ currentPassword, newPassword }) => {
    if (account?.provider !== 'supabase') {
      setAccount((prev) => (prev ? { ...prev, password: newPassword } : prev));
      return { success: true };
    }
    if (!account?.email) {
      return { success: false, error: 'Email is not available.' };
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: currentPassword,
    });
    if (signInError) {
      return { success: false, error: 'Current password is incorrect.' };
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  };

  const value = useMemo(
    () => ({
      account,
      hydrated,
      signInWithSchoolAccount,
      signInWithEmail,
      signOut,
      deleteAccount,
      updateAccount,
      updatePassword,
    }),
    [account, hydrated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
