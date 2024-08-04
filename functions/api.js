exports.handler = async (event, context) => {

  const allowedOrigins = [
    'http://localhost:3000',
    'https://tunewave.vercel.app',
    'https://audichangerr.netlify.app',
  ];

  const origin = event.headers.origin;
  const isAllowedOrigin = allowedOrigins.includes(origin);

  if (event.httpMethod === 'OPTIONS') {
    // Handle preflight request
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400', // 24 hours
      },
    };
  }

  if (!isAllowedOrigin) {
    return {
      statusCode: 403,
      headers: {
        'Access-Control-Allow-Origin': '',
      },
      body: JSON.stringify({ error: 'Origin not allowed' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': origin,
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }
  
  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": origin
    },
    body: JSON.stringify({ message: "Hello World" })
  };
  return response;
};