export const CHAMBA_DEPARTMENTS = ['Managua', 'Masaya', 'Granada'] as const;

export type ChambaDepartment = (typeof CHAMBA_DEPARTMENTS)[number];

export const DEPARTMENT_COORDS: Record<
  ChambaDepartment,
  { lat: number; lng: number }
> = {
  Managua: { lat: 12.1364, lng: -86.2514 },
  Masaya:  { lat: 11.9744, lng: -86.0940 },
  Granada: { lat: 11.9344, lng: -85.9560 },
};

export const isChambaDepartment = (value: string): value is ChambaDepartment =>
  (CHAMBA_DEPARTMENTS as readonly string[]).includes(value);
