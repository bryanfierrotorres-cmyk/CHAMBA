import type { JobCategory } from '@/types';
import { validateClientPrice } from '@constants/servicePricing';

/** Validates an email address format. */
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/** Validates a Mexican phone number (10 digits). */
export const isValidPhone = (phone: string): boolean => {
  return /^\d{10}$/.test(phone.replace(/\D/g, ''));
};

/** Validates password: minimum 8 chars, at least one number. */
export const isValidPassword = (password: string): boolean => {
  return password.length >= 8 && /\d/.test(password);
};

/** Validates that a monetary amount is positive and ≤ C$99,999. */
export const isValidAmount = (amount: number): boolean => {
  return amount > 0 && amount <= 99999;
};

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export const validateRegistration = (
  fullName: string,
  email: string,
  phone: string,
  password: string,
): ValidationResult => {
  if (!fullName.trim() || fullName.trim().length < 3)
    return { valid: false, message: 'El nombre debe tener al menos 3 caracteres' };
  if (!isValidEmail(email))
    return { valid: false, message: 'Correo electrónico inválido' };
  if (!isValidPhone(phone))
    return { valid: false, message: 'Teléfono inválido (10 dígitos)' };
  if (!isValidPassword(password))
    return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres y un número' };
  return { valid: true, message: '' };
};

export const validateJobForm = (
  title: string,
  description: string,
  payAmount: number,
  address: string,
  category?: JobCategory,
): ValidationResult => {
  if (!title.trim() || title.trim().length < 5)
    return { valid: false, message: 'El título debe tener al menos 5 caracteres' };
  if (!description.trim() || description.trim().length < 10)
    return { valid: false, message: 'La descripción debe tener al menos 10 caracteres' };
  if (!isValidAmount(payAmount))
    return { valid: false, message: 'El pago debe ser entre C$1 y C$99,999' };
  if (category) {
    const priceCheck = validateClientPrice(category, payAmount);
    if (!priceCheck.valid) return priceCheck;
  }
  if (!address.trim())
    return { valid: false, message: 'La dirección es requerida' };
  return { valid: true, message: '' };
};
