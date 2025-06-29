export async function POST(request) {
    const { domain, username, password, payloads } = await request.json();
    const baseUrl = domain.endsWith('/') ? domain : `${domain}/`;
    const targetUrl = `${baseUrl}health-data-hub/api/v1/transactions`;
  
    try {
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

          if (!response.ok) {
            // If the response is not OK, return the error details
            const errorData = await response.json().catch(() => ({}));
            return {
              status: response.status,
              error: errorData.message || response.statusText,
              data: errorData
            };
          }

          const data = await response.json();
          return {
            status: response.status,
            data: data
          };
        })
      );
  
      return Response.json({ success: true, responses });
    } catch (error) {
      return Response.json({ 
        success: false, 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, { status: 500 });
    }
  }