import { validateRequiredFields, createErrorResponse, handleApiError } from '@/utils/errorHandling';
import { smartRoute } from '@/app/api/_lib/smartRouter';

export const runtime = 'nodejs';

// ----------------------------------------------
// Original direct-call implementation preserved
// ----------------------------------------------
// export async function POST(request) {
//   try {
//     const { type, content, domain, username, password, dataSourceIdentifier } = await request.json();
//     
//     // Validate required fields
//     validateRequiredFields({ type, content, domain, username, password }, 
//       ['type', 'content', 'domain', 'username', 'password']);
//
//     if (typeof content !== 'string') {
//       return Response.json(createErrorResponse('Content must be a string', 400), { status: 400 });
//     }
//
//     const baseUrl = domain.endsWith('/') ? domain : `${domain}/`;
//
//     const endpointPath = type.toLowerCase() === 'json'
//       ? 'health-data-hub/api/v1/transactions'
//       : 'health-data-hub/api/v1/messages';
//
//     const targetUrl = `${baseUrl}${endpointPath}`;
//
//     const auth = Buffer.from(`${username}:${password}`).toString('base64');
//     
//     let requestBody;
//     
//     if (type.toLowerCase() === 'json') {
//       // For JSON transactions, send the content directly as parsed JSON
//       try {
//         requestBody = JSON.parse(content);
//       } catch (e) {
//         return Response.json(createErrorResponse('Invalid JSON content', 400), { status: 400 });
//       }
//     } else {
//       // For HL7/CDA messages, use the message structure
//       const messageData = type.toLowerCase() === 'hl7' 
//         ? content.replace(/\n/g, '\r\n')  // Convert \n to \r\n for HL7
//         : content;
//         
//       requestBody = {
//         dataSourceIdentifier: dataSourceIdentifier || "LAB2",  // Use provided or default
//         originalMessage: {
//           data: "fake",
//           type: type.toUpperCase()
//         },
//         message: {
//           data: messageData,
//           type: type.toUpperCase()
//         }
//       };
//     }
//
//     const response = await fetch(targetUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Basic ${auth}`,
//         'X-Requested-With': 'true'
//       },
//       body: JSON.stringify(requestBody)
//     });
//
//     let data = null;
//     const contentType = response.headers.get('content-type') || '';
//     const hasBody = response.headers.get('content-length') !== '0' && response.status !== 204;
//     if (hasBody && contentType.includes('application/json')) {
//       try { data = await response.json(); } catch {}
//     } else if (hasBody) {
//       try { data = await response.text(); } catch {}
//     }
//
//     if (!response.ok) {
//       return Response.json(createErrorResponse(
//         (data && data.message) || response.statusText,
//         response.status,
//         { data: data || {} }
//       ), { status: response.status });
//     }
//
//     return Response.json({ success: true, status: response.status, data });
//   } catch (error) {
//     const errorResponse = handleApiError(error, 'ProcessMessage');
//     return Response.json(errorResponse, { status: errorResponse.status });
//   }
// }

// ----------------------------------------------
// New implementation using Lambda proxy
// ----------------------------------------------
export async function POST(request) {
  try {
    const { type, content, domain, username, password, dataSourceIdentifier } = await request.json();

    // Validate minimally then delegate to Lambda for cross-env behavior
    validateRequiredFields({ type, content, domain, username, password }, 
      ['type', 'content', 'domain', 'username', 'password']);

    const lambdaProxyUrl = process.env.LAMBDA_PROXY_URL || 'https://5dd8m8250h.execute-api.us-west-2.amazonaws.com/default/hdh-post-api-to-dev-envs-loadpatients';

    const result = await smartRoute(lambdaProxyUrl, {
      mode: 'processMessage',
      type,
      content,
      domain,
      username,
      password,
      dataSourceIdentifier,
    });

    return Response.json(result);
  } catch (error) {
    // Keep prior error shape
    const status = error.status || 500;
    const errorResponse = handleApiError(error, 'ProcessMessageViaLambda');
    return Response.json({ ...errorResponse, status, response: error.response }, { status });
  }
}



