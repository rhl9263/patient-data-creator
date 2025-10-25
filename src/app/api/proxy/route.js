// import { validateRequiredFields, createErrorResponse, handleApiError } from '@/utils/errorHandling';
import { smartRoute } from '@/app/api/_lib/smartRouter';

export async function POST(request) {
  const { domain, username, password, payloads } = await request.json();
  const lambdaProxyUrl = process.env.LAMBDA_PROXY_URL || 'https://5dd8m8250h.execute-api.us-west-2.amazonaws.com/default/hdh-post-api-to-dev-envs-loadpatients';

  try {
    // Use smart routing to handle both public and private domains efficiently
    const result = await smartRoute(lambdaProxyUrl, { 
      domain, 
      username, 
      password, 
      payloads,
      mode: 'proxy' // Explicitly set mode for clarity
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      status: error.status || 500,
      response: error.response,
    }, { status: error.status || 500 });
  }
}