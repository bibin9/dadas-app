"use client";
import { createContext, useContext, useState, ReactNode } from "react";

type Profile = "dadas" | "bigticket";

const ProfileContext = createContext<{
  profile: Profile;
  setProfile: (p: Profile) => void;
}>({ profile: "dadas", setProfile: () => {} });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>("dadas");
  return (
    <ProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}

export type { Profile };
