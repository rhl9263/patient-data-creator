/**
 * Smart Router for handling dual-domain architecture
 * Routes private domains through Lambda (VPC access)
 * Routes public domains directly from Next.js (internet access)
 */

// Domain classification helper
export function isPrivateDomain(domain) {
  // Check for private domain patterns
  const privateDomainPatterns = [
    /\.rnd\.hdh\.nextgenaws\.net/,  // Your private domain
    /\.internal\./,
    /\.private\./,
    /localhost/,
    /127\.0\.0\.1/,
    /192\.168\./,
    /10\./,
    /172\.(1[6-9]|2[0-9]|3[0-1])\./
  ];
  
  return privateDomainPatterns.some(pattern => pattern.test(domain));
}

// Direct HTTP request function for public domains
async function makeDirectRequest(url, options) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    const response = await fetch(url, {
      method: options.method || 'POST',
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    let data = null;
    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const hasBody = contentLength !== '0' && response.status !== 204;
    
    if (hasBody) {
      const text = await response.text();
      if (text && text.length > 0) {
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        } else {
          data = text;
        }
      }
    }

    return {
      status: response.status,
      data,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Direct request timeout after 30 seconds');
    }
    throw error;
  }
}

// Lambda proxy function (existing)
async function postToLambda(lambdaProxyUrl, payload) {
  if (!lambdaProxyUrl) {
    throw new Error('LAMBDA_PROXY_URL environment variable is not set.');
  }

  console.log(`[Lambda Proxy] ${payload.mode} - Type: ${payload.type || 'N/A'}`);

  try {
    const res = await fetch(lambdaProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Read as text first; many gateways return JSON as text
    const text = await res.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }

    if (!res.ok) {
      console.error(`[Lambda Proxy] Error ${res.status}:`, result);
      const message = typeof result === 'string' ? result : result?.message || res.statusText;
      const error = new Error(message);
      error.status = res.status;
      error.response = result;
      throw error;
    }

    return result;
  } catch (error) {
    console.error(`[Lambda Proxy] Request failed:`, error.message);
    throw error;
  }
}

// Handle direct process-message requests for public domains
async function handleDirectProcessMessage(payload) {
  const { type, content, domain, username, password, dataSourceIdentifier } = payload;
  
  const baseUrl = domain.endsWith('/') ? domain : `${domain}/`;
  const endpointPath = String(type).toLowerCase() === 'json'
    ? 'health-data-hub/api/v1/transactions'
    : 'health-data-hub/api/v1/messages';
  
  const targetUrl = `${baseUrl}${endpointPath}`;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
  let requestBody;
  
  if (String(type).toLowerCase() === 'json') {
    try {
      requestBody = JSON.parse(content);
    } catch (e) {
      throw new Error('Invalid JSON content');
    }
  } else {
    const t = String(type).toLowerCase();
    const messageData = t === 'hl7' 
      ? content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').join('\r') 
      : content;
      
    requestBody = {
      dataSourceIdentifier: dataSourceIdentifier || 'LAB2',
      originalMessage: {
        data: messageData,
        type: String(type).toUpperCase()
      },
      message: {
        data: messageData,
        type: String(type).toUpperCase()
      }
    };
  }

  const response = await makeDirectRequest(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'X-Requested-With': 'true',
      'Accept': 'application/json',
      'User-Agent': 'NextJS-Direct/1.0'
    },
    body: JSON.stringify(requestBody)
  });

  if (response.status >= 400) {
    const error = new Error((response.data && response.data.message) || 'Request failed');
    error.status = response.status;
    error.response = response.data;
    throw error;
  }

  return {
    success: true,
    status: response.status,
    data: response.data,
    routedVia: 'direct'
  };
}

// Handle direct proxy requests for public domains
async function handleDirectProxy(payload) {
  const { domain, username, password, payloads } = payload;
  
  const baseUrl = domain.endsWith('/') ? domain : `${domain}/`;
  const targetUrl = `${baseUrl}health-data-hub/api/v1/transactions`;
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  
  const responses = await Promise.all(
    payloads.map(async (payloadItem, index) => {
      try {
        const response = await makeDirectRequest(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'X-Requested-With': 'true'
          },
          body: JSON.stringify(payloadItem)
        });
        
        return response;
      } catch (error) {
        console.error(`[Direct Proxy] Error processing payload ${index + 1}:`, error.message);
        return {
          status: 500,
          data: { error: `Request failed: ${error.message}` }
        };
      }
    })
  );

  return {
    success: true,
    responses,
    targetUrl,
    processedAt: new Date().toISOString(),
    routedVia: 'direct'
  };
}

// Main smart routing function
export async function smartRoute(lambdaProxyUrl, payload) {
  const domain = payload.domain;
  const mode = payload.mode;
  
  const isPrivate = isPrivateDomain(domain);
  console.log(`[Smart Router] ${mode || 'proxy'} for ${domain} (${isPrivate ? 'private' : 'public'})`);
  
  // For private domains, always use Lambda (VPC access required)
  if (isPrivate) {
    // Add retry logic for Lambda cold starts
    let retries = 0;
    const maxRetries = 1; // One retry for cold start issues
    
    while (retries <= maxRetries) {
      try {
        return await postToLambda(lambdaProxyUrl, payload);
      } catch (error) {
        if (error.status === 500 && retries < maxRetries) {
          console.log(`[Smart Router] Lambda returned 500, retrying (${retries + 1}/${maxRetries})...`);
          retries++;
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw error;
        }
      }
    }
  }
  
  // For public domains, use direct requests (avoids VPC networking issues)
  try {
    if (mode === 'processMessage') {
      return await handleDirectProcessMessage(payload);
    } else {
      return await handleDirectProxy(payload);
    }
  } catch (error) {
    console.error('[Smart Router] Direct request failed:', error.message);
    
    // Optional: Try Lambda as fallback for public domains
    // Uncomment if you want to try Lambda when direct fails
    // console.log('[Smart Router] Attempting Lambda as fallback...');
    // try {
    //   const result = await postToLambda(lambdaProxyUrl, payload);
    //   return { ...result, routedVia: 'lambda-fallback' };
    // } catch (lambdaError) {
    //   console.error('[Smart Router] Lambda fallback also failed:', lambdaError.message);
    //   throw error; // Throw original error
    // }
    
    throw error;
  }
}

// Export the original postToLambda for backward compatibility
export { postToLambda };
