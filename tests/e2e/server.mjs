import { createServer } from 'node:http'
import { stat, readFile } from 'node:fs/promises'
import path from 'node:path'

const port = Number(process.argv[2] || process.env.PORT || 4173)
const rootDir = process.cwd()

const contentTypeMap = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp'
}

function resolvePath(urlPath) {
  const normalized = urlPath.replace(/\\/g, '/').replace(/^\/+/, '')
  let localPath = path.join(rootDir, normalized)
  if (!localPath.startsWith(rootDir)) {
    return null
  }
  return localPath
}

const server = createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
    const pathname = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname

    let localPath = resolvePath(pathname)
    if (!localPath) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    let fileStat = await stat(localPath).catch(() => null)
    if (fileStat?.isDirectory()) {
      localPath = path.join(localPath, 'index.html')
      fileStat = await stat(localPath).catch(() => null)
    }

    if (!fileStat || !fileStat.isFile()) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }

    const ext = path.extname(localPath).toLowerCase()
    const type = contentTypeMap[ext] || 'application/octet-stream'
    const body = await readFile(localPath)

    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store'
    })
    res.end(body)
  } catch (error) {
    res.writeHead(500)
    res.end(`Server Error: ${error.message}`)
  }
})

server.listen(port, '127.0.0.1', () => {
  // Playwright relies on webServer.url healthcheck. Keep this log simple.
  console.log(`[e2e-server] listening on http://127.0.0.1:${port}`)
})
