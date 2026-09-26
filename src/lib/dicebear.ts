// DiceBear images (dicebear.com), CC0 styles only. PNGs are at most 256px, so show them at that
// size or smaller. The same seed always gives the same image. Colors are hex without "#".
export const dicebearUrl = (
  style: 'notionists' | 'shapes',
  seed: string,
  backgroundColor: string,
  // Style options, e.g. { shape1Color: '347821' } for shapes.
  options: Record<string, string> = {}
) => {
  const params = new URLSearchParams({ seed, backgroundColor, ...options });
  return `https://api.dicebear.com/10.x/${style}/png?${params.toString()}`;
};

// Shapes in brand colors instead of DiceBear's default orange and blue.
export const BRAND_SHAPE_COLORS = { shape1Color: '347821', shape2Color: '9fe870', shape3Color: '163300' };
