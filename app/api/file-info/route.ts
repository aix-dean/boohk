import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import https from 'https'
import http from 'http'
import puppeteer from 'puppeteer'

async function getFileSize(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: 'HEAD' });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Header names are case-insensitive, but often standardized to lowercase in JS
    const contentLength = response.headers.get('content-length');

    if (contentLength) {
      // The API requires size to be a number (integer)
      return parseInt(contentLength, 10);
    } else {
      // Some servers may not provide Content-Length for all file types
      throw new Error('Content-Length header is missing from the response.');
    }
  } catch (error) {
    console.error("Error in getFileSize:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

const calculateMD5Hash = async (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http

    const hash = createHash("md5")

    const req = client.get(url, (res: any) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${res.statusCode})`))
        res.resume()
        return
      }
      res.on('data', (chunk: any) => {
        hash.update(chunk);
      });

      res.on('end', () => {
        // Get the final hash and ensure it is lowercase, as required by the API
        resolve(hash.digest('hex').toLowerCase());
      });
    });

    req.on('error', (e: any) => {
      reject(e);
    });
  });
}

async function getVideoDimensions(url: string): Promise<{width: number, height: number} | null> {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    const dimensions = await page.evaluate(async (url: string) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      return new Promise<{width: number, height: number}>((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => {
          resolve({ width: video.videoWidth, height: video.videoHeight });
        });
        video.addEventListener('error', () => {
          reject(new Error('Failed to load video metadata'));
        });
      });
    }, url);
    return dimensions;
  } catch (error) {
    console.error('Error getting video dimensions:', error);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const [size, md5, dimensions] = await Promise.all([
      getFileSize(url),
      calculateMD5Hash(url),
      getVideoDimensions(url)
    ])

    return NextResponse.json({ size, md5, width: dimensions?.width, height: dimensions?.height })
  } catch (error) {
    console.error('Error getting file info:', error)
    return NextResponse.json({ error: 'Failed to get file info' }, { status: 500 })
  }
}