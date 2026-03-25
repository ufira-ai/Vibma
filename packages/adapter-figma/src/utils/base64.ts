/** Base64 encode a Uint8Array (works in Figma plugin sandbox where btoa may not exist). */
export function customBase64Encode(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";

  const byteLength = bytes.byteLength;
  const byteRemainder = byteLength % 3;
  const mainLength = byteLength - byteRemainder;

  for (let i = 0; i < mainLength; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    base64 +=
      chars[(chunk & 16515072) >> 18] +
      chars[(chunk & 258048) >> 12] +
      chars[(chunk & 4032) >> 6] +
      chars[chunk & 63];
  }

  if (byteRemainder === 1) {
    const chunk = bytes[mainLength];
    base64 += chars[(chunk & 252) >> 2] + chars[(chunk & 3) << 4] + "==";
  } else if (byteRemainder === 2) {
    const chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
    base64 +=
      chars[(chunk & 64512) >> 10] +
      chars[(chunk & 1008) >> 4] +
      chars[(chunk & 15) << 2] +
      "=";
  }

  return base64;
}

/** Base64 decode a string to Uint8Array (works in Figma plugin sandbox where atob may not exist). */
export function customBase64Decode(b64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(128);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  // Strip padding
  let len = b64.length;
  while (len > 0 && b64[len - 1] === "=") len--;

  const out = new Uint8Array(Math.floor(len * 3 / 4));
  let j = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[b64.charCodeAt(i)];
    const b = lookup[b64.charCodeAt(i + 1)];
    const c = lookup[b64.charCodeAt(i + 2)];
    const d = lookup[b64.charCodeAt(i + 3)];
    out[j++] = (a << 2) | (b >> 4);
    if (i + 2 < len) out[j++] = ((b & 0xF) << 4) | (c >> 2);
    if (i + 3 < len) out[j++] = ((c & 0x3) << 6) | d;
  }
  return out.subarray(0, j);
}
