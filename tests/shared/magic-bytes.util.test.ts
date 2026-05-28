/**
 * magic-bytes.util.test.ts
 *
 * Deep unit tests for L-1: isSupportedImageMagicBytes.
 * Tests real magic byte sequences for JPEG/PNG/WebP and common attack vectors
 * (PDF, GIF, HTML, ZIP disguised as images).
 */

import { isSupportedImageMagicBytes } from '../../src/shared/utils/magic-bytes.util';

function buf(...bytes: number[]): Buffer {
  const b = Buffer.alloc(12, 0);
  bytes.forEach((v, i) => { b[i] = v; });
  return b;
}

// ── Valid formats ──────────────────────────────────────────────────────────────

describe('L-1 magic bytes — valid image formats accepted', () => {
  it('JPEG (FF D8 FF E0 — JFIF header)', () => {
    expect(isSupportedImageMagicBytes(buf(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
  });

  it('JPEG (FF D8 FF E1 — EXIF header)', () => {
    expect(isSupportedImageMagicBytes(buf(0xff, 0xd8, 0xff, 0xe1))).toBe(true);
  });

  it('JPEG (FF D8 FF DB — quantization table)', () => {
    expect(isSupportedImageMagicBytes(buf(0xff, 0xd8, 0xff, 0xdb))).toBe(true);
  });

  it('PNG (89 50 4E 47 0D 0A 1A 0A)', () => {
    expect(isSupportedImageMagicBytes(
      buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    )).toBe(true);
  });

  it('WebP (RIFF....WEBP)', () => {
    const b = Buffer.alloc(12, 0);
    // RIFF
    b[0] = 0x52; b[1] = 0x49; b[2] = 0x46; b[3] = 0x46;
    // 4 bytes file size (arbitrary)
    b[4] = 0x00; b[5] = 0x00; b[6] = 0x00; b[7] = 0x00;
    // WEBP
    b[8] = 0x57; b[9] = 0x45; b[10] = 0x42; b[11] = 0x50;
    expect(isSupportedImageMagicBytes(b)).toBe(true);
  });
});

// ── Attack vectors — must be rejected ─────────────────────────────────────────

describe('L-1 magic bytes — attack vectors rejected', () => {
  it('PDF (%PDF)', () => {
    expect(isSupportedImageMagicBytes(buf(0x25, 0x50, 0x44, 0x46))).toBe(false);
  });

  it('GIF87a', () => {
    expect(isSupportedImageMagicBytes(buf(0x47, 0x49, 0x46, 0x38, 0x37, 0x61))).toBe(false);
  });

  it('GIF89a', () => {
    expect(isSupportedImageMagicBytes(buf(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe(false);
  });

  it('ZIP / Office docx (PK signature)', () => {
    expect(isSupportedImageMagicBytes(buf(0x50, 0x4b, 0x03, 0x04))).toBe(false);
  });

  it('ELF binary', () => {
    expect(isSupportedImageMagicBytes(buf(0x7f, 0x45, 0x4c, 0x46))).toBe(false);
  });

  it('HTML (<htm…)', () => {
    // <html
    expect(isSupportedImageMagicBytes(buf(0x3c, 0x68, 0x74, 0x6d, 0x6c))).toBe(false);
  });

  it('JavaScript (//)', () => {
    expect(isSupportedImageMagicBytes(buf(0x2f, 0x2f))).toBe(false);
  });

  it('all-zero buffer', () => {
    expect(isSupportedImageMagicBytes(Buffer.alloc(12, 0))).toBe(false);
  });

  it('RIFF without WEBP marker → not WebP', () => {
    const b = Buffer.alloc(12, 0);
    b[0] = 0x52; b[1] = 0x49; b[2] = 0x46; b[3] = 0x46; // RIFF
    // bytes 8-11 = AVIO instead of WEBP
    b[8] = 0x41; b[9] = 0x56; b[10] = 0x49; b[11] = 0x4f;
    expect(isSupportedImageMagicBytes(b)).toBe(false);
  });

  it('JPEG first 2 bytes correct but 3rd byte wrong', () => {
    expect(isSupportedImageMagicBytes(buf(0xff, 0xd8, 0x00))).toBe(false);
  });
});
