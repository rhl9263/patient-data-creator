/**
 * Base64 utility functions
 */

/**
 * Encode text to Base64
 * @param {string} text - Text to encode
 * @returns {string} Base64 encoded string
 */
export const encodeToBase64 = (text) => {
  return btoa(unescape(encodeURIComponent(text)));
};

/**
 * Decode Base64 to text
 * @param {string} base64 - Base64 string to decode
 * @returns {string} Decoded text
 */
export const decodeFromBase64 = (base64) => {
  return decodeURIComponent(escape(atob(base64)));
};

/**
 * Detect file type from binary data
 * @param {Uint8Array} bytes - File bytes
 * @returns {Object} Object with mimeType and extension
 */
export const detectFileType = (bytes) => {
  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
  
  // PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }
  
  // Default
  return { mimeType: 'application/octet-stream', extension: 'bin' };
};

/**
 * Download decoded file
 * @param {string} base64Data - Base64 encoded data
 * @param {string} filename - Optional filename
 */
export const downloadDecodedFile = (base64Data, filename = 'decoded_file') => {
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const { mimeType, extension } = detectFileType(bytes);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.${extension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
