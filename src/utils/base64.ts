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
