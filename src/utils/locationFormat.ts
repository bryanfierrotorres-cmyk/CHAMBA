import {
  CHAMBA_DEPARTMENTS,
  isChambaDepartment,
  type ChambaDepartment,
} from '@constants/departments';

const ADDRESS_SEPARATOR = ' · ';

export interface ParsedJobAddress {
  department: ChambaDepartment | null;
  detail: string;
  full: string;
}

/** Guarda departamento + detalle opcional en el campo `address` de la BD. */
export const formatJobAddress = (
  department: ChambaDepartment,
  detail?: string,
): string => {
  const trimmed = detail?.trim();
  return trimmed ? `${department}${ADDRESS_SEPARATOR}${trimmed}` : department;
};

/** Lee departamento y detalle desde `address` (compatible con direcciones antiguas). */
export const parseJobAddress = (address: string | null | undefined): ParsedJobAddress => {
  const full = (address ?? '').trim();
  if (!full) {
    return { department: null, detail: '', full: '' };
  }

  const [first, ...rest] = full.split(ADDRESS_SEPARATOR);
  const maybeDept = first.trim();

  if (isChambaDepartment(maybeDept)) {
    return {
      department: maybeDept,
      detail: rest.join(ADDRESS_SEPARATOR).trim(),
      full,
    };
  }

  for (const dept of CHAMBA_DEPARTMENTS) {
    if (full.toLowerCase().startsWith(dept.toLowerCase())) {
      const detail = full.slice(dept.length).replace(/^[,\s·\-]+/, '').trim();
      return { department: dept, detail, full };
    }
  }

  return { department: null, detail: full, full };
};
