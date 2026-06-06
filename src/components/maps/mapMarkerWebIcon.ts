import { CATEGORY_EMOJIS, isJobCategory } from '@constants/chambaCategories';

export const CHAMBA_MAP_DEEP_BLUE = '#1E293B';

const MARKER_WIDTH = 44;
const MARKER_HEIGHT = 54;

/** SVG premium para Google Maps en web (data URI). */
export function buildChambaMapMarkerIconUrl(categorySlug?: string): string {
  const emoji =
    categorySlug && isJobCategory(categorySlug)
      ? CATEGORY_EMOJIS[categorySlug]
      : '✨';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_WIDTH}" height="${MARKER_HEIGHT}" viewBox="0 0 44 54">
  <defs>
    <filter id="shadow" x="-30%" y="-20%" width="160%" height="150%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0F172A" flood-opacity="0.32"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <circle cx="22" cy="20" r="18" fill="${CHAMBA_MAP_DEEP_BLUE}" stroke="#FFFFFF" stroke-width="2"/>
    <polygon points="22,52 13,37 31,37" fill="${CHAMBA_MAP_DEEP_BLUE}"/>
  </g>
  <text x="22" y="25" text-anchor="middle" dominant-baseline="middle" font-size="15">${emoji}</text>
</svg>`.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const CHAMBA_MAP_MARKER_SIZE = { width: MARKER_WIDTH, height: MARKER_HEIGHT };
