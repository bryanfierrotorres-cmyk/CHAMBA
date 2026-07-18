import { useEffect, useState } from 'react';
import { captureWorkerApplicantLocation } from '@utils/captureWorkerApplicantLocation';
import { reverseGeocodePlace, formatPlaceLabel } from '@utils/reverseGeocode';

/**
 * Etiqueta de ubicación del cliente (header del home) según su GPS real:
 * "Departamento, Municipio". Best-effort — si no hay permiso/GPS, deja el fallback.
 */
export function useClientLocationLabel(fallback = 'Managua, Nicaragua'): string {
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const coords = await captureWorkerApplicantLocation();
      if (!coords || cancelled) return;
      const place = await reverseGeocodePlace(coords.lat, coords.lng);
      if (cancelled) return;
      setLabel(formatPlaceLabel(place, fallback));
    })();
    return () => { cancelled = true; };
  }, [fallback]);

  return label;
}
