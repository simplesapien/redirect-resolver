const express = require('express');
const app = express();

// Node 18+ (or any environment with WHATWG fetch)
async function getFinalUrl(url, depth = 0) {
  if (depth > 5) {
    console.log('Max redirect depth reached');
    return url;
  }
  
  // First try HTTP redirects
  const res = await fetch(url, { 
    method: 'GET', 
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  
  let finalUrl = res.url;
  
  // If we got HTML, check for redirects
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const html = await res.text();
    
    // Check for canonical link - this is often the actual destination
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (canonicalMatch) {
      const canonicalUrl = canonicalMatch[1];
      // Only follow if it's different from current URL
      if (canonicalUrl !== finalUrl && canonicalUrl !== url) {
        const resolvedUrl = new URL(canonicalUrl, finalUrl).href;
        // Don't follow if it's just www vs non-www of same domain
        const currentDomain = new URL(finalUrl).hostname.replace(/^www\./, '');
        const canonicalDomain = new URL(resolvedUrl).hostname.replace(/^www\./, '');
        if (currentDomain !== canonicalDomain) {
          return await getFinalUrl(resolvedUrl, depth + 1);
        }
      }
    }
    
    // Check for meta refresh redirect
    const metaRefreshMatch = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"'>\s]+)/i);
    if (metaRefreshMatch) {
      const redirectUrl = metaRefreshMatch[1];
      const resolvedUrl = new URL(redirectUrl, finalUrl).href;
      return await getFinalUrl(resolvedUrl, depth + 1);
    }
    
    // Check for JavaScript redirects (but be more careful)
    const jsPatterns = [
      /window\.location\s*=\s*["']([^"']+)["']/i,
      /window\.location\.href\s*=\s*["']([^"']+)["']/i,
      /location\.replace\s*\(\s*["']([^"']+)["']/i
    ];
    
    for (const pattern of jsPatterns) {
      const match = html.match(pattern);
      if (match) {
        const redirectUrl = match[1];
        // Only follow if it's a different domain
        const currentDomain = new URL(finalUrl).hostname.replace(/^www\./, '');
        const redirectDomain = new URL(redirectUrl, finalUrl).hostname.replace(/^www\./, '');
        if (currentDomain !== redirectDomain) {
          const resolvedUrl = new URL(redirectUrl, finalUrl).href;
          return await getFinalUrl(resolvedUrl, depth + 1);
        }
      }
    }
  }
  
  return finalUrl;
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
    
    const finalUrl = await getFinalUrl(url);
    console.log(`[${timestamp}] Final resolved URL (before trim): ${finalUrl}`);
    
    // Trim final URL to base domain (remove query params, path, etc.)
    const trimmedFinalUrl = trimToBaseDomain(finalUrl);
    console.log(`[${timestamp}] Trimmed final URL: ${finalUrl} -> ${trimmedFinalUrl}`);
    
    res.json({ 
      originalUrl: url,
      finalUrl: finalUrl,
      trimmedFinalUrl: trimmedFinalUrl,
      redirected: url !== finalUrl
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