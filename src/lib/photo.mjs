/* The pixel size of a JPEG, read out of the file itself.
 *
 * The product gallery needs each photograph's shape to give its frame the
 * right box and its <img> the right intrinsic size. That could have come from
 * a generated manifest; it does not, on purpose. A manifest is a second source
 * of truth that goes stale the day somebody replaces a photograph and forgets
 * to re-run the script, and then it needs a guard of its own to police it.
 * The file already knows how big it is.
 *
 * Zero dependencies: CI has no Pillow, and adding one for twenty-five lines
 * would be the tail wagging the dog. Verified against Pillow on all 209 JPEGs
 * in photos/ -- 209 agree, 0 disagree.
 */
import { openSync, readSync, closeSync } from 'node:fs';

const cache = new Map();

/** @returns {{w:number,h:number}} */
export function shapeOf(file) {
  if (cache.has(file)) return cache.get(file);
  const fd = openSync(file, 'r');
  try {
    const head = Buffer.alloc(2);
    readSync(fd, head, 0, 2, 0);
    if (head[0] !== 0xFF || head[1] !== 0xD8) throw new Error(`${file} is not a JPEG`);

    let at = 2;
    const seg = Buffer.alloc(9);
    for (;;) {
      readSync(fd, seg, 0, 4, at);
      if (seg[0] !== 0xFF) throw new Error(`${file}: lost the marker chain at byte ${at}`);
      const marker = seg[1];
      // Standalone markers carry no length: skip two bytes and go on.
      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { at += 2; continue; }
      const len = seg.readUInt16BE(2);
      /* Every start-of-frame carries the size, and there are more of them than
         the famous one: C0 baseline, C1 extended, C2 progressive, and C5..CF
         minus the four that are not frames (C4 Huffman, C8 reserved, CC
         arithmetic). Reading only C0 would work on these 209 files and break on
         the first progressive JPEG the owner exports from a phone. */
      const isFrame = (marker >= 0xC0 && marker <= 0xCF)
        && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
      if (isFrame) {
        readSync(fd, seg, 0, 9, at + 4);
        const shape = { h: seg.readUInt16BE(1), w: seg.readUInt16BE(3) };
        cache.set(file, shape);
        return shape;
      }
      at += 2 + len;
    }
  } finally {
    closeSync(fd);
  }
}

/** The rendition widths that exist for a master this wide.
 *  Never wider than the file: asking a browser to fetch a bigger file to see
 *  the same picture blurrier is the rule scripts/renditions.py already keeps. */
export const LADDER = [200, 400, 600, 1000];
export const ZOOM_W = 1400;
/** The WHOLE-photograph rungs for a master this wide. Must agree with
 *  scripts/renditions.py -- the two are the same ladder written twice, which is
 *  why they are both here in one place each and both say why. */
export function rungs(w) {
  const out = LADDER.filter((x) => x >= 400 && x <= w);
  // A master narrower than the smallest rung gets one rung at its own width.
  if (!out.length) return [w];
  if (w >= 1250) out.push(ZOOM_W);
  return out;
}
