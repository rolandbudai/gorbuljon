import * as functions from 'firebase-functions';
import * as https from 'https';

/**
 * Proxy Cloud Function az OVSZ API-hoz
 * Kezeli a CORS problémát és átirányítja a kéréseket a külső API-ra
 */
export const ovszwsProxy = functions.https.onRequest(async (request, response) => {
  // CORS fejlécek beállítása
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS kérés kezelése (preflight)
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return;
  }

  // Csak GET kérések támogatottak
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Query paraméterek átvétele
    const queryParams = request.query;
    
    // Az OVSZ API URL
    const apiUrl = 'https://hydroinfo.hu/WSCSS/ovszws/api.php';
    
    // Query string összeállítása
    const queryString = new URLSearchParams(
      Object.entries(queryParams).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>)
    ).toString();

    const fullUrl = `${apiUrl}?${queryString}`;

    // HTTPS kérés küldése az OVSZ API-nak
    https.get(fullUrl, (apiResponse) => {
      let data = '';

      apiResponse.on('data', (chunk) => {
        data += chunk;
      });

      apiResponse.on('end', () => {
        // HTTP státusz kód átadása
        response.status(apiResponse.statusCode || 200);
        
        // Content-Type átadása
        const contentType = apiResponse.headers['content-type'];
        if (contentType) {
          response.set('Content-Type', contentType);
        }

        // Válasz küldése
        response.send(data);
      });
    }).on('error', (error) => {
      console.error('OVSZ API hiba:', error);
      response.status(500).json({
        error: 'Failed to fetch data from OVSZ API',
        message: error.message
      });
    });

  } catch (error) {
    console.error('Cloud Function hiba:', error);
    response.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});



