const express = require('express');
const app = express();

// Node 18+ (or any environment with WHATWG fetch)
async function getFinalUrl(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  // res.url holds the final URL after redirects
  return res.url;
}

// Function to trim URL to base domain (protocol + hostname + /)
function trimToBaseDomain(url) {
  try {
    const urlObj = new URL(url);
    // Reconstruct URL with just protocol + hostname + /
    return `${urlObj.protocol}//${urlObj.hostname}/`;
  } catch (error) {
    // If URL parsing fails, return original
    return url;
  }
}

// Health check endpoint
app.get('/', (req, res) => {
  console.log(`[${new Date().toISOString()}] Health check requested`);
  res.json({ 
    status: 'ok', 
    message: 'Redirect resolver service',
    usage: 'GET /redirect?url=<url> to resolve redirects'
  });
});

// Main redirect resolver endpoint
app.get('/redirect', async (req, res) => {
  const url = req.query.url;
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] Redirect resolver called with URL: ${url}`);
  
  if (!url) {
    console.log(`[${timestamp}] Error: Missing url parameter`);
    return res.status(400).json({ 
      error: 'Missing url parameter',
      usage: 'GET /redirect?url=<url>'
    });
  }

  try {
    // Validate URL format
    new URL(url);
    
    // Trim URL to base domain (remove query params, path, etc.)
    const trimmedUrl = trimToBaseDomain(url);
    console.log(`[${timestamp}] Trimmed URL: ${url} -> ${trimmedUrl}`);
    
    const finalUrl = await getFinalUrl(trimmedUrl);
    console.log(`[${timestamp}] Final resolved URL: ${finalUrl}`);
    
    res.json({ 
      originalUrl: url,
      trimmedUrl: trimmedUrl,
      finalUrl: finalUrl,
      redirected: trimmedUrl !== finalUrl
    });
  } catch (error) {
    console.error(`[${timestamp}] Error processing URL ${url}:`, error.message);
    
    if (error instanceof TypeError && error.message.includes('Invalid URL')) {
      return res.status(400).json({ 
        error: 'Invalid URL format',
        message: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to resolve redirect',
      message: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Redirect resolver server running on port ${PORT}`);
});