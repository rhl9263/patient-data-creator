/**
 * API utility functions
 */

/**
 * Get stored credentials from session storage
 * @returns {Object|null} Credentials object or null if not found
 */
export const getStoredCredentials = () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = sessionStorage.getItem('apiCredentials');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error parsing stored credentials:', error);
    return null;
  }
};

/**
 * Store credentials in session storage
 * @param {Object} credentials - The credentials to store
 */
export const storeCredentials = (credentials) => {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.setItem('apiCredentials', JSON.stringify(credentials));
  } catch (error) {
    console.error('Error storing credentials:', error);
  }
};

/**
 * Make an authenticated API request
 * @param {string} url - The API endpoint
 * @param {Object} options - Fetch options
 * @param {Object} credentials - API credentials
 * @returns {Promise<Object>} API response
 */
export const makeApiRequest = async (url, options = {}, credentials = null) => {
  const creds = credentials || getStoredCredentials();
  
  if (!creds) {
    throw new Error('No credentials available');
  }
  
  const defaultOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Validate domain URL format
 * @param {string} domain - Domain URL to validate
 * @returns {boolean} Whether the domain is valid
 */
export const validateDomain = (domain) => {
  const domainPattern = /^https?:\/\/[a-zA-Z0-9.-]+\.nextgenaws\.net\/?$/;
  return domainPattern.test(domain);
};
