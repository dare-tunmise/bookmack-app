// Jacket colours for books with no cover image.
//
// Deliberately not the brand palette. Real jackets are navy, rust, ochre, plum; a shelf of
// BookMack green would read as a chart rather than as books — which is the whole point of the
// year shelf and the posters, where the marks ARE the books.
//
// Both the colour and the layout are picked from the title, with two different hashes so they do
// not move together and every navy book is not also the framed one. A book therefore wears the
// same jacket everywhere it appears: its spine on the year shelf, its cover on a poster, the
// thumbnail in a list.

export const JACKETS: readonly (readonly [string, string])[] = [
  ['#1D3557', '#F1E3C6'],
  ['#A33B2A', '#F6E7D8'],
  ['#0F2E25', '#D9F58C'],
  ['#141414', '#E0B55C'],
  ['#EFE7D5', '#1A1A1A'],
  ['#B8831C', '#2A1A08'],
  ['#15616D', '#FFFFFF'],
  ['#5B2A4A', '#F3C6DE'],
  ['#4A5A32', '#F2EEDC'],
  ['#C65A2E', '#FBEDE2'],
  ['#3E4C59', '#FFFFFF'],
  ['#6B1414', '#F5E9DD'],
  ['#E3D5B8', '#2F3E2F'],
  ['#2B2D42', '#EDF2F4'],
  ['#7A3B12', '#F0DCC0'],
  ['#13322A', '#E8D9A8'],
  ['#8E7CC3', '#FFFFFF'],
  ['#9CC5D9', '#10303E'],
  ['#E07A5F', '#FFF4EC'],
  ['#6A7D3C', '#F6F2DF']
];

export const JACKET_LAYOUTS = 6;

const hash = (text: string, seed: number) => {
  let value = seed;
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) >>> 0;
  }
  return value;
};

export type Jacket = { bg: string; fg: string; layout: number };

export const jacketFor = (title: string): Jacket => {
  const name = title ?? '';
  const [bg, fg] = JACKETS[hash(name, 7) % JACKETS.length];
  return { bg, fg, layout: (hash(name, 131) % JACKET_LAYOUTS) + 1 };
};
