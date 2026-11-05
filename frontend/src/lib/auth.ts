"use client";
import { token } from "./api";
import { readLS, useLS, writeLS } from "./store";
import type { User } from "./types";

const KEY = "sbstay.user";
export const session = {
  get: (): User | null => readLS<User | null>(KEY, null),
  set: (u: User, t: string) => { writeLS(KEY, u); token.set(t); },
  update: (patch: Partial<User>) => { const u = readLS<User | null>(KEY, null); if (u) writeLS(KEY, { ...u, ...patch }); },
  clear: () => { writeLS(KEY, null); token.clear(); },
};

export function useUser() {
  const user = useLS<User | null>(KEY, null);
  return { user, setUser: (u: User | null) => writeLS(KEY, u) };
}
