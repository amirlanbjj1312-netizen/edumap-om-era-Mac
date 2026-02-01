import React, { createContext, useContext, useMemo, useState } from 'react';

export const ROLES = {
  STUDENT: 'student',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
};

const RoleContext = createContext({
  role: ROLES.STUDENT,
  setRole: () => {},
  isGuest: false,
  setGuest: () => {},
});

export const RoleProvider = ({ children }) => {
  const [role, setRole] = useState(ROLES.STUDENT);
  const [isGuest, setGuest] = useState(false);

  const value = useMemo(
    () => ({ role, setRole, isGuest, setGuest }),
    [role, isGuest]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const useRole = () => useContext(RoleContext);
