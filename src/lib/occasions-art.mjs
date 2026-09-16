/* ===========================================================================
   The ten occasion badges, drawn rather than photographed.
   ===========================================================================

   The model shop puts a photograph in each circle. Photographs do not work for
   these: at 74px across, a photograph of a small engraved disc becomes a beige
   smudge, and ten beige smudges in a row tell a visitor nothing about where
   each one leads. A drawing at that size can still say "trophy" or "pram".

   So each one is a line drawing of the thing the occasion actually sells —
   the daisy the workshop really cuts for Mother's Day, the "superhero" shield
   for Father's Day, the birth disc with its rows of data. They share one
   grammar on purpose: a 48-unit square, a 1.4 stroke, round joins, and one
   filled accent each. That is what makes ten different subjects read as one
   set rather than ten clip-art icons.
   ------------------------------------------------------------------------- */

const ART = {
  /* A bauble: the two wooden halves that click together, with the name between. */
  christmas: `
    <path d="M21.5 11.5h5v3.4h-5z"/>
    <path d="M24 11.5V9.2a2.6 2.6 0 0 0-2.6-2.6"/>
    <circle cx="24" cy="28.4" r="13"/>
    <path d="M11.2 26.6h25.6"/>
    <path d="M18 33.5h12M20.5 37.2h7"/>
    <circle cx="24" cy="20.8" r="1.5" fill="currentColor" stroke="none"/>`,

  /* The daisy they really cut, on its stem. Eight proper teardrop petals
     rotated around the centre — the first version drew them as loose marks
     and read as scattered debris rather than a flower. */
  'mothers-day': `
    ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) =>
      `<path d="M24 19.8C21.3 18 20.8 14 24 8.8C27.2 14 26.7 18 24 19.8Z" transform="rotate(${a} 24 22)"/>`).join('\n    ')}
    <circle cx="24" cy="22" r="3.4" fill="currentColor" stroke="none" opacity=".55"/>
    <path d="M24 35.2V42"/>
    <path d="M24 38.4c-3.2 0-5.2-1.6-6-4.8 3.2-.6 5.2.9 6 4.8Z"/>`,

  /* The "you are my superhero" shield, with the small figure and the cape. */
  'fathers-day': `
    <path d="M24 7.5 37 12v12.4c0 9-5.5 14.3-13 17.1-7.5-2.8-13-8.1-13-17.1V12Z"/>
    <path d="M17.6 18.6h12.8"/>
    <circle cx="26.4" cy="27.2" r="2.1"/>
    <path d="M26.4 29.5v5.2M23.4 31.6h6M24.6 34.7l-1.2 3.2M28.2 34.7l1.2 3.2"/>
    <path d="M28.6 29.6c2.4 1.1 3.1 3.3 2.2 6.5"/>
    <circle cx="20.6" cy="31.8" r="1.4"/>
    <path d="M20.6 33.4v3.1M19.2 37.9l1.4-1.4 1.4 1.4"/>`,

  /* A balloon with a name tag on its string. The first attempt was a rocking
     horse and at badge size it read as a tent: too many joints, none of them
     legible below 40px. A balloon survives being small. */
  'childrens-day': `
    <path d="M24 9.6c5.3 0 9.2 4 9.2 9.4 0 5.6-4.1 10.4-9.2 13-5.1-2.6-9.2-7.4-9.2-13 0-5.4 3.9-9.4 9.2-9.4Z"/>
    <path d="M21.8 32.4h4.4l-2.2 2.8Z" fill="currentColor" stroke="none"/>
    <path d="M24 35.2c0 2.6 2.4 2.6 2.4 5.2"/>
    <path d="M19.6 15.4c-1 1-1.6 2.3-1.8 3.8"/>
    <path d="M28.6 38h5.8a1.4 1.4 0 0 1 1.4 1.4v2.2a1.4 1.4 0 0 1-1.4 1.4h-5.8Z"/>`,

  /* A heart on a ribbon. The scalloped disc I drew first sat on its ribbon
     tail and read as a lollipop, which is not what a christening favour is. */
  keepsakes: `
    <path d="M24 39.4C14.6 33 10.2 27.6 10.2 22.2a7.2 7.2 0 0 1 13.8-2.9 7.2 7.2 0 0 1 13.8 2.9c0 5.4-4.4 10.8-13.8 17.2Z"/>
    <circle cx="24" cy="17.6" r="1.6"/>
    <path d="M24 16c0-2.6-2-3.6-2-5.6a2 2 0 0 1 4 0c0 2-2 3-2 5.6Z"/>
    <path d="M16.6 24.4h14.8M18.8 28.6h10.4"/>`,

  /* The birth disc: name, date, time, weight, length, all engraved. */
  'new-baby': `
    <circle cx="24" cy="25" r="14"/>
    <path d="M17 19.4h14"/>
    <path d="M15.6 24.6h7.2M15.6 28.6h5.6"/>
    <path d="M27 25.4a2.6 2.6 0 0 1 4.6 1.7c0 1.9-2.3 3.4-4.6 5.1-2.3-1.7-4.6-3.2-4.6-5.1A2.6 2.6 0 0 1 27 25.4Z" fill="currentColor" stroke="none" opacity=".5"/>
    <path d="M20.4 11v-.4a3.6 3.6 0 0 1 7.2 0v.4"/>`,

  /* A name cut in wood, on its little standing base. */
  names: `
    <path d="M9 30.6c2.4-5.6 4-8.4 4.8-8.4s1 2.2 1 5.2c0 1.7.6 2.6 1.7 2.6 1.6 0 2.7-1.9 3.2-5.6"/>
    <path d="M19.7 24.4c1.6 0 3-.9 4.3-2.6M22.4 30.6c1.2-4.4 2.6-8.8 4.2-13.2.7-2 1.4-3 2.1-3 .6 0 .9.4.9 1.2 0 2.4-2 6.4-6 12"/>
    <path d="M26.8 30.6c2.5-3 4.4-4.6 5.6-4.6.9 0 1.3.5 1.3 1.4 0 .6-.2 1.3-.6 2.1.9.7 1.8 1.1 2.7 1.1h3.2"/>
    <path d="M13 36.6h22M17 36.6v3.2M31 36.6v3.2"/>`,

  /* A growth chart on a wall: the piece that stays in the house for years. */
  home: `
    <path d="M11.4 22.6 24 12l12.6 10.6"/>
    <path d="M14.6 21v15.4a1.6 1.6 0 0 0 1.6 1.6h15.6a1.6 1.6 0 0 0 1.6-1.6V21"/>
    <path d="M27.8 38V26.2a1.4 1.4 0 0 0-1.4-1.4h-4.8a1.4 1.4 0 0 0-1.4 1.4V38"/>
    <path d="M20.2 29.4h7.6M20.2 33h4.4"/>`,

  /* A tag on a ribbon, hanging. */
  hanging: `
    <path d="M24 7v4.4a3.4 3.4 0 0 1-3.4 3.4h-1.2"/>
    <path d="M19.4 14.8h9.2a2.4 2.4 0 0 1 2.4 2.4V36a2.4 2.4 0 0 1-2.4 2.4h-9.2A2.4 2.4 0 0 1 17 36V17.2a2.4 2.4 0 0 1 2.4-2.4Z"/>
    <circle cx="24" cy="19.6" r="1.5"/>
    <path d="M20 25.4h8M20 29h8M20 32.6h5"/>`,

  /* A trophy, for the clubs and the end-of-season nights. */
  awards: `
    <path d="M17 10.4h14v8.4a7 7 0 0 1-14 0Z"/>
    <path d="M17 13.2h-3.4a4 4 0 0 0 4 6.4M31 13.2h3.4a4 4 0 0 1-4 6.4"/>
    <path d="M24 25.8v5.4M19.6 37.6h8.8a4.4 4.4 0 0 0-4.4-6.4 4.4 4.4 0 0 0-4.4 6.4Z"/>
    <path d="M24 12.6l1.2 2.5 2.8.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.8-.4Z" fill="currentColor" stroke="none" opacity=".5"/>`,
};

export function occasionArt(slug, size = 30) {
  const body = ART[slug];
  if (!body) return '';
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor"
    stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${body}</svg>`;
}

export const drawnOccasions = Object.keys(ART);
