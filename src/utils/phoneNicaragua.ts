export const NICA_PHONE_PREFIX = '+505 ';

export const formatNicaPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

export const formatNicaPhoneDisplay = (phone: string | null | undefined): string => {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '').slice(-8);
  return digits.length === 8 ? formatNicaPhone(digits) : phone;
};

export const isValidNicaPhone = (raw: string): boolean => {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 8 && /^[2578]/.test(digits);
};
