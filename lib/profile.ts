'use client';

import { getSupabase } from './supabase';

/** The "from" block and payment details, reused on every invoice. */
export type Profile = {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  accountNo: string;
  ifsc: string;
  pan: string;
};

const LOCAL_KEY = 'invoice-generator:profile';

export const emptyProfile = (): Profile => ({
  fullName: '',
  addressLine1: '',
  addressLine2: '',
  phone: '',
  accountNo: '',
  ifsc: '',
  pan: '',
});

/** True once there's anything worth copying onto an invoice. */
export const hasProfileData = (p: Profile) =>
  Object.values(p).some((v) => v.trim() !== '');

export async function loadProfile(): Promise<Profile> {
  const sb = getSupabase();

  if (!sb) {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? { ...emptyProfile(), ...JSON.parse(raw) } : emptyProfile();
    } catch {
      return emptyProfile();
    }
  }

  const { data, error } = await sb
    .from('profile')
    .select('full_name, address_line1, address_line2, phone, account_no, ifsc, pan')
    .maybeSingle();

  if (error) throw error;
  if (!data) return emptyProfile();

  return {
    fullName: data.full_name ?? '',
    addressLine1: data.address_line1 ?? '',
    addressLine2: data.address_line2 ?? '',
    phone: data.phone ?? '',
    accountNo: data.account_no ?? '',
    ifsc: data.ifsc ?? '',
    pan: data.pan ?? '',
  };
}

export async function saveProfile(profile: Profile): Promise<void> {
  const sb = getSupabase();

  if (!sb) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
    return;
  }

  const { data: user } = await sb.auth.getUser();
  if (!user.user) throw new Error('Not signed in.');

  // user_id is the primary key, so this updates in place rather than
  // accumulating a row per save.
  const { error } = await sb.from('profile').upsert({
    user_id: user.user.id,
    full_name: profile.fullName,
    address_line1: profile.addressLine1,
    address_line2: profile.addressLine2,
    phone: profile.phone,
    account_no: profile.accountNo,
    ifsc: profile.ifsc,
    pan: profile.pan,
  });

  if (error) throw error;
}
