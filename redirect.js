const express = require('express');
const app = express();

// Node 18+ (or any environment with WHATWG fetch)
async function getFinalUrl(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'follow' });
  // res.url holds the final URL after redirects
  return res.url;
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Redirect resolver service',
    usage: 'GET /redirect?url=<url> to resolve redirects'
  });
});

// Main redirect resolver endpoint
app.get('/redirect', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ 
      error: 'Missing url parameter',
      usage: 'GET /redirect?url=<url>'
    });
  }

  try {
    // Validate URL format
    new URL(url);
    
    const finalUrl = await getFinalUrl(url);
    res.json({ 
      originalUrl: url,
      finalUrl: finalUrl,
      redirected: url !== finalUrl
    });
  } catch (error) {
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