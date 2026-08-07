/**
 * Payload Mutator Utility
 * Takes a base string and returns an array of mutation variants.
 */

export function urlEncode(str) {
  return encodeURIComponent(str);
}

export function doubleUrlEncode(str) {
  return encodeURIComponent(encodeURIComponent(str));
}

export function htmlEntityEncode(str) {
  return str.replace(/[\u00A0-\u9999<>\&"']/g, function(i) {
    return '&#' + i.charCodeAt(0) + ';';
  });
}

export function unicodeEscape(str) {
  return str.split('').map(char => {
    const code = char.charCodeAt(0).toString(16).padStart(4, '0');
    return `\\u${code}`;
  }).join('');
}

export function hexEncode(str) {
  return str.split('').map(char => {
    return `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`;
  }).join('');
}

export function base64Encode(str) {
  try {
    return btoa(str);
  } catch (e) {
    return "Error encoding";
  }
}

/**
 * Returns a list of all mutated variations for a given payload.
 */
export function generateMutations(payload) {
  if (!payload) return [];

  return [
    { name: "Original", value: payload },
    { name: "URL Encoded", value: urlEncode(payload) },
    { name: "Double URL", value: doubleUrlEncode(payload) },
    { name: "HTML Entity", value: htmlEntityEncode(payload) },
    { name: "Hex Escape", value: hexEncode(payload) },
    { name: "Unicode", value: unicodeEscape(payload) },
    { name: "Base64", value: base64Encode(payload) },
  ];
}
