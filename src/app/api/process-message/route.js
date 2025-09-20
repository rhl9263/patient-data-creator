import { validateRequiredFields, createErrorResponse, handleApiError } from '@/utils/errorHandling';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { type, content, domain, username, password, dataSourceIdentifier } = await request.json();
    
    // Validate required fields
    validateRequiredFields({ type, content, domain, username, password }, 
      ['type', 'content', 'domain', 'username', 'password']);

    if (typeof content !== 'string') {
      return Response.json(createErrorResponse('Content must be a string', 400), { status: 400 });
    }

    const baseUrl = domain.endsWith('/') ? domain : `${domain}/`;

    const endpointPath = type.toLowerCase() === 'json'
      ? 'health-data-hub/api/v1/transactions'
      : 'health-data-hub/api/v1/messages';

    const targetUrl = `${baseUrl}${endpointPath}`;

    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    let requestBody;
    
    if (type.toLowerCase() === 'json') {
      // For JSON transactions, send the content directly as parsed JSON
      try {
        requestBody = JSON.parse(content);
      } catch (e) {
        return Response.json(createErrorResponse('Invalid JSON content', 400), { status: 400 });
      }
    } else {
      // For HL7/CDA messages, use the message structure
      const messageData = type.toLowerCase() === 'hl7' 
        ? content.replace(/\n/g, '\r\n')  // Convert \n to \r\n for HL7
        : content;
        
      requestBody = {
        dataSourceIdentifier: dataSourceIdentifier || "LAB2",  // Use provided or default
        originalMessage: {
          data: "fake",
          type: type.toUpperCase()
        },
        message: {
          data: messageData,
          type: type.toUpperCase()
        }
      };
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
        'X-Requested-With': 'true'
      },
      body: JSON.stringify(requestBody)
    });

    let data = null;
    const contentType = response.headers.get('content-type') || '';
    const hasBody = response.headers.get('content-length') !== '0' && response.status !== 204;
    if (hasBody && contentType.includes('application/json')) {
      try { data = await response.json(); } catch {}
    } else if (hasBody) {
      try { data = await response.text(); } catch {}
    }

    if (!response.ok) {
      return Response.json(createErrorResponse(
        (data && data.message) || response.statusText,
        response.status,
        { data: data || {} }
      ), { status: response.status });
    }

    return Response.json({ success: true, status: response.status, data });
  } catch (error) {
    const errorResponse = handleApiError(error, 'ProcessMessage');
    return Response.json(errorResponse, { status: errorResponse.status });
  }
}



