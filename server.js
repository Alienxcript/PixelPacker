const http = require('http');
const fs = require('fs');
const path = require('path');

const requestedPort = Number(process.env.PORT) || 3000;
const fallbackPorts = [requestedPort, requestedPort + 1, requestedPort + 2, requestedPort + 3];
const publicDir = __dirname;
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function requestHandler(req, res) {
  let requestPath = req.url.split('?')[0];
  if (requestPath === '/' || requestPath === '/index.html') {
    requestPath = '/index.html';
  }

  const filePath = path.join(publicDir, decodeURIComponent(requestPath));

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404: File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

let currentPortIndex = 0;

function startServer() {
  const port = fallbackPorts[currentPortIndex];
  const server = http.createServer(requestHandler);

  server.listen(port, () => {
    console.log(`Image Compressor web app running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use. Trying next port...`);
      currentPortIndex += 1;
      if (currentPortIndex < fallbackPorts.length) {
        startServer();
      } else {
        console.error(`All fallback ports are busy: ${fallbackPorts.join(', ')}.`);
        process.exit(1);
      }
    } else {
      console.error(err);
      process.exit(1);
    }
  });
}

startServer();
