/**
 * AWS S3 presigned PUT URL generator — zero external dependencies.
 * Uses Node's built-in `crypto` module to produce a Signature Version 4
 * presigned URL that allows a client to PUT an object directly to S3.
 */
const crypto = require('crypto');

const REGION     = process.env.AWS_REGION;
const BUCKET     = process.env.S3_BUCKET_NAME;
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;

/**
 * Percent-encode a string following the AWS SigV4 spec:
 * unreserved chars (A-Z a-z 0-9 - _ . ~) are NOT encoded; everything else is.
 */
function awsEncode(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, c =>
        '%' + c.charCodeAt(0).toString(16).toUpperCase()
    );
}

function hmac(key, data) {
    return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256hex(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a presigned PUT URL for a single S3 object.
 *
 * @param {string} key        - S3 object key, e.g. "damage-reports/BOOK-123/photo.jpg"
 * @param {string} contentType - MIME type, e.g. "image/jpeg"
 * @param {number} expiresIn  - Validity in seconds (default: 5 minutes)
 * @returns {{ uploadUrl: string, fileUrl: string }}
 */
function getPresignedPutUrl(key, contentType, expiresIn = 300) {
    const now      = new Date();
    const datetime = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const date     = datetime.slice(0, 8);

    const host            = `${BUCKET}.s3.${REGION}.amazonaws.com`;
    const credentialScope = `${date}/${REGION}/s3/aws4_request`;
    const credential      = `${ACCESS_KEY}/${credentialScope}`;

    // Query parameters — must be sorted lexicographically by name
    const queryParams = [
        ['X-Amz-Algorithm',    'AWS4-HMAC-SHA256'],
        ['X-Amz-Credential',   credential],
        ['X-Amz-Date',         datetime],
        ['X-Amz-Expires',      String(expiresIn)],
        ['X-Amz-SignedHeaders', 'host'],
    ].sort(([a], [b]) => (a < b ? -1 : 1));

    const canonicalQueryString = queryParams
        .map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`)
        .join('&');

    // Encode each path segment separately so slashes are preserved
    const canonicalUri = '/' + key.split('/').map(awsEncode).join('/');

    const canonicalRequest = [
        'PUT',
        canonicalUri,
        canonicalQueryString,
        `host:${host}\n`,   // canonical headers (must end with \n)
        'host',              // signed headers
        'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        datetime,
        credentialScope,
        sha256hex(canonicalRequest),
    ].join('\n');

    // Derive signing key: HMAC chain over date → region → service → terminator
    const signingKey = hmac(
        hmac(hmac(hmac(`AWS4${SECRET_KEY}`, date), REGION), 's3'),
        'aws4_request'
    );
    const signature = crypto.createHmac('sha256', signingKey)
        .update(stringToSign)
        .digest('hex');

    const uploadUrl = `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
    const fileUrl   = `https://${host}${canonicalUri}`;

    return { uploadUrl, fileUrl };
}

/**
 * Upload a Buffer directly to S3 from the backend using a SigV4-signed
 * Authorization header. No SDK, no CORS — the request goes server → S3.
 *
 * @param {string} key         - S3 object key
 * @param {string} contentType - MIME type
 * @param {Buffer} buffer      - File contents
 * @returns {Promise<string>}  - Resolves to the public S3 object URL
 */
function uploadBufferToS3(key, contentType, buffer) {
    return new Promise((resolve, reject) => {
        const https = require('https');

        const now      = new Date();
        const datetime = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
        const date     = datetime.slice(0, 8);

        const host            = `${BUCKET}.s3.${REGION}.amazonaws.com`;
        const credentialScope = `${date}/${REGION}/s3/aws4_request`;
        const canonicalUri    = '/' + key.split('/').map(awsEncode).join('/');
        const payloadHash     = sha256hex(buffer);

        // Signed headers must be sorted lexicographically
        const canonicalHeaders =
            `content-type:${contentType}\n` +
            `host:${host}\n` +
            `x-amz-content-sha256:${payloadHash}\n` +
            `x-amz-date:${datetime}\n`;
        const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

        const canonicalRequest = [
            'PUT',
            canonicalUri,
            '',   // no query string
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join('\n');

        const stringToSign = [
            'AWS4-HMAC-SHA256',
            datetime,
            credentialScope,
            sha256hex(canonicalRequest),
        ].join('\n');

        const signingKey = hmac(
            hmac(hmac(hmac(`AWS4${SECRET_KEY}`, date), REGION), 's3'),
            'aws4_request'
        );
        const signature = crypto.createHmac('sha256', signingKey)
            .update(stringToSign)
            .digest('hex');

        const authorization =
            `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const req = https.request(
            {
                hostname: host,
                method:   'PUT',
                path:     canonicalUri,
                headers:  {
                    'Authorization':         authorization,
                    'Content-Type':          contentType,
                    'Content-Length':        buffer.length,
                    'x-amz-content-sha256':  payloadHash,
                    'x-amz-date':            datetime,
                },
            },
            (res) => {
                let body = '';
                res.on('data', chunk => { body += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(`https://${host}${canonicalUri}`);
                    } else {
                        reject(new Error(`S3 PUT failed (${res.statusCode}): ${body}`));
                    }
                });
            }
        );

        req.on('error', reject);
        req.write(buffer);
        req.end();
    });
}

module.exports = { getPresignedPutUrl, uploadBufferToS3 };
