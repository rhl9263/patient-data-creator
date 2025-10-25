import https from 'https';
import http from 'http';

/**
 * PRODUCTION-READY Lambda for private domain routing
 * Deploy this to AWS Lambda to fix the 500 errors
 */

// Keep-alive agents for connection reuse
const httpsAgent = new https.Agent({ 
    keepAlive: true,
    maxSockets: 50 
});
const httpAgent = new http.Agent({ 
    keepAlive: true,
    maxSockets: 50 
});

export const handler = async (event) => {
    console.log('[Lambda] Request received for private domain routing');
    
    try {
        // Parse body
        const body = typeof event.body === 'string' 
            ? JSON.parse(event.body) 
            : event.body;
        
        console.log(`[Lambda] Mode: ${body.mode}, Type: ${body.type || 'N/A'}`);
        
        // Route based on mode
        if (body.mode === 'processMessage') {
            return await handleProcessMessage(body);
        } else {
            return await handleProxy(body);
        }
    } catch (error) {
        console.error('[Lambda] Handler Error:', error);
        return createErrorResponse(500, error.message);
    }
};

// Handle process-message requests
async function handleProcessMessage(body) {
    const { type, content, domain, username, password, dataSourceIdentifier } = body;
    
    // Validation
    if (!type || !content || !domain || !username || !password) {
        console.error('[Lambda] Missing required fields');
        return createErrorResponse(400, 'Missing required fields');
    }
    
    console.log(`[Lambda] Processing ${type} message for ${domain}`);
    
    const baseUrl = domain.endsWith('/') ? domain : `${domain}/`;
    const endpointPath = String(type).toLowerCase() === 'json'
        ? 'health-data-hub/api/v1/transactions'
        : 'health-data-hub/api/v1/messages';
    const targetUrl = `${baseUrl}${endpointPath}`;
    
    console.log(`[Lambda] Target URL: ${targetUrl}`);
    
    // Prepare request body
    let requestBody;
    if (String(type).toLowerCase() === 'json') {
        try {
            requestBody = JSON.parse(content);
        } catch {
            return createErrorResponse(400, 'Invalid JSON content');
        }
    } else {
        // For HL7 and CDA - use content as-is (no line ending conversion)
        const messageData = content;
        
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
    
    // Make request
    try {
        // FIXED: Correct Authorization header
        const authString = `${username}:${password}`;
        const authBase64 = Buffer.from(authString).toString('base64');
        
        const response = await makeHttpsRequest(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authBase64}`,
                'X-Requested-With': 'true',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log(`[Lambda] Response status: ${response.status}`);
        
        if (response.status >= 400) {
            console.error(`[Lambda] Error response:`, response.data);
            return createErrorResponse(response.status, 
                response.data?.message || 'Request failed',
                { data: response.data || {} });
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                status: response.status,
                data: response.data
            })
        };
    } catch (error) {
        console.error('[Lambda] Request failed:', error);
        return createErrorResponse(500, `Request failed: ${error.message}`);
    }
}

// Handle proxy requests (batch transactions)
async function handleProxy(body) {
    const { domain, username, password, payloads } = body;
    
    // Validation
    if (!domain || !username || !password || !Array.isArray(payloads) || payloads.length === 0) {
        return createErrorResponse(400, 'Invalid proxy request parameters');
    }
    
    console.log(`[Lambda] Processing ${payloads.length} payloads for ${domain}`);
    
    const baseUrl = domain.endsWith('/') ? domain : `${domain}/`;
    const targetUrl = `${baseUrl}health-data-hub/api/v1/transactions`;
    
    // FIXED: Correct Authorization header
    const authString = `${username}:${password}`;
    const auth = `Basic ${Buffer.from(authString).toString('base64')}`;
    
    // Process all payloads in parallel
    const responses = await Promise.all(
        payloads.map(async (payload, index) => {
            try {
                const response = await makeHttpsRequest(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': auth,
                        'X-Requested-With': 'true',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                console.log(`[Lambda] Payload ${index + 1}/${payloads.length}: Status ${response.status}`);
                return response;
            } catch (error) {
                console.error(`[Lambda] Payload ${index + 1} failed:`, error.message);
                return {
                    status: 500,
                    data: { error: error.message }
                };
            }
        })
    );
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: JSON.stringify({
            success: true,
            responses,
            targetUrl,
            processedAt: new Date().toISOString()
        })
    };
}

// HTTPS request function
function makeHttpsRequest(url, options) {
    return new Promise((resolve, reject) => {
        let urlObj;
        try {
            urlObj = new URL(url);
        } catch {
            return reject(new Error(`Invalid URL: ${url}`));
        }
        
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        const agent = isHttps ? httpsAgent : httpAgent;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method,
            headers: {
                ...options.headers,
                'Content-Length': Buffer.byteLength(options.body || '')
            },
            timeout: 30000,
            agent // Use keep-alive agent
        };
        
        console.log(`[Lambda] Making ${options.method} request to: ${url}`);
        
        const req = client.request(requestOptions, (res) => {
            const chunks = [];
            
            res.on('data', chunk => chunks.push(chunk));
            
            res.on('end', () => {
                const data = Buffer.concat(chunks).toString();
                const contentType = (res.headers['content-type'] || '').toLowerCase();
                
                let parsedData = null;
                if (data && data.length > 0) {
                    if (contentType.includes('application/json')) {
                        try {
                            parsedData = JSON.parse(data);
                        } catch {
                            parsedData = data;
                        }
                    } else {
                        parsedData = data;
                    }
                }
                
                resolve({
                    status: res.statusCode,
                    data: parsedData,
                    headers: res.headers
                });
            });
        });
        
        req.on('error', (error) => {
            console.error(`[Lambda] Network error for ${url}:`, error.message);
            reject(new Error(`Network error: ${error.message}`));
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout after 30 seconds'));
        });
        
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

// Error response helper
function createErrorResponse(statusCode, message, details = {}) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            success: false,
            error: message,
            timestamp: new Date().toISOString(),
            ...details
        })
    };
}
