// Netlify Function - OVSZ API Proxy
// URL: /.netlify/functions/ovsz-proxy

const https = require('https');

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Only GET allowed
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get query string from request
    const queryString = event.rawQuery || '';
    
    // Forward to OVSZ API
    const apiUrl = `https://hydroinfo.hu/WSCSS/ovszws/api.php?${queryString}`;
    
    console.log('Proxying to:', apiUrl);

    // Use native https module instead of fetch
    const data = await new Promise((resolve, reject) => {
      https.get(apiUrl, { headers: { 'Accept': 'application/json' } }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body, contentType: res.headers['content-type'] }));
        res.on('error', reject);
      }).on('error', reject);
    });

    console.log('Response status:', data.statusCode);

    return {
      statusCode: data.statusCode,
      headers: {
        ...headers,
        'Content-Type': data.contentType || 'application/json'
      },
      body: data.body
    };

  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Proxy error', message: error.message })
    };
  }
};
