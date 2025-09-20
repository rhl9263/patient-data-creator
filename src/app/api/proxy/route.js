import { validateRequiredFields, createErrorResponse, handleApiError } from '@/utils/errorHandling';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { domain, username, password, payloads } = await request.json();
    
    // Validate required fields
    validateRequiredFields({ domain, username, password, payloads }, 
      ['domain', 'username', 'password', 'payloads']);

    if (!Array.isArray(payloads) || payloads.length === 0) {
      return Response.json(createErrorResponse('Payloads must be a non-empty array', 400), { status: 400 });
    }
    
    const baseUrl = domain.endsWith('/') ? domain : `${domain}/`;
    const targetUrl = `${baseUrl}health-data-hub/api/v1/transactions`;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    
    // Process all payloads in parallel
    const responses = await Promise.all(
      payloads.map(async (payload) => {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            "X-Requested-With": "true"
          },
          body: JSON.stringify(payload)
        });

        let data = null;
        const contentType = response.headers.get('content-type') || '';
        const hasBody = response.headers.get('content-length') !== '0' && response.status !== 204;

        if (hasBody && contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch {
            // Ignore JSON parse errors
          }
        }

        if (!response.ok) {
          return {
            status: response.status,
            error: (data && data.message) || response.statusText,
            data: data || {}
          };
        }

        return {
          status: response.status,
          data: data,
          ...(data?.id && { id: data.id })
        };
      })
    );

    return Response.json({ success: true, responses });
  } catch (error) {
    const errorResponse = handleApiError(error, 'ProxyAPI');
    return Response.json(errorResponse, { status: errorResponse.status });
  }
}