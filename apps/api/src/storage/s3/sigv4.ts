import { createHmac, createHash } from 'crypto';

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

export function getAmzDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function getDateStamp(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

export function hashPayload(data: Buffer | string): string {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

export function getCanonicalRequest(
  method: string,
  uri: string,
  queryString: string,
  headers: Record<string, string>,
  payloadHash: string
): string {
  // Filter to only signed headers (host, x-amz-date, x-amz-content-sha256)
  const signedHeaderNames = ['host', 'x-amz-date', 'x-amz-content-sha256'];
  const signedHeadersMap: Record<string, string> = {};
  
  for (const key of signedHeaderNames) {
    const value = headers[key.toLowerCase()] || headers[key];
    if (value) {
      signedHeadersMap[key.toLowerCase()] = value.trim();
    }
  }

  // Build canonical headers - must be sorted and lowercase
  const canonicalHeaders = Object.keys(signedHeadersMap)
    .sort()
    .map(key => `${key}:${signedHeadersMap[key]}\n`)
    .join('');

  // Build signed headers list - must match canonical headers
  const signedHeaders = Object.keys(signedHeadersMap)
    .sort()
    .join(';');

  return [
    method,
    uri,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
}

export function getStringToSign(
  date: Date,
  region: string,
  canonicalRequest: string
): string {
  const dateStamp = getDateStamp(date);
  const amzDate = getAmzDate(date);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const hashedRequest = createHash('sha256').update(canonicalRequest).digest('hex');

  return [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    hashedRequest,
  ].join('\n');
}

export function getSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string
): Buffer {
  const kDate = createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac('sha256', kDate).update(region).digest();
  const kService = createHmac('sha256', kRegion).update('s3').digest();
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
  return kSigning;
}

export function getAuthorizationHeader(
  accessKey: string,
  secretKey: string,
  region: string,
  date: Date,
  canonicalRequest: string,
  headers: Record<string, string>
): string {
  const dateStamp = getDateStamp(date);
  const amzDate = getAmzDate(date);
  const stringToSign = getStringToSign(date, region, canonicalRequest);
  const signingKey = getSigningKey(secretKey, dateStamp, region);
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const scope = `${dateStamp}/${region}/s3/aws4_request`;

  // Extract signed headers from canonical request (they're sorted)
  const signedHeaderNames = ['host', 'x-amz-date', 'x-amz-content-sha256'];
  const signedHeaders = signedHeaderNames
    .filter(name => headers[name.toLowerCase()] || headers[name])
    .join(';');

  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}
