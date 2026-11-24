import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../server-app.ts';

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  const rawUrl = req.url || '/';
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const originalPath = parsed.searchParams.get('__path');
    if (originalPath) {
      parsed.searchParams.delete('__path');
      const remainingQuery = parsed.searchParams.toString();
      const normalizedPath = originalPath.startsWith('/') ? originalPath : `/${originalPath}`;
      req.url = remainingQuery ? `${normalizedPath}?${remainingQuery}` : normalizedPath;
    }
  } catch {
    // Keep original req.url if URL parsing fails
  }

  app(req, res);
}
