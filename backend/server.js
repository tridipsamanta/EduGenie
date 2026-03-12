import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import next from 'next';

const isDev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);
const app = next({ dev: isDev });
const handle = app.getRequestHandler();

const publicDir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), 'public');

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const requestUrl = req.url || '/';

      // Handle API routes with Next.js
      if (requestUrl.startsWith('/api/')) {
        return handle(req, res);
      }

      // Handle static files from public folder
      const requestPath = requestUrl.split('?')[0];
      const filePath = path.join(publicDir, requestPath);
      
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        // Serve the file directly
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
          '.ttf': 'font/ttf',
        };
        
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        
        // Add cache headers for static assets
        if (ext !== '.html') {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
        
        return res.end(fs.readFileSync(filePath));
      }

      // For SPA routing: serve index.html for non-API, non-file routes
      if (!requestPath.includes('.')) {
        const indexPath = path.join(publicDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          res.setHeader('Content-Type', 'text/html');
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          return res.end(fs.readFileSync(indexPath));
        }
      }

      // Fallback to Next.js handler
      return handle(req, res);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }).listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
