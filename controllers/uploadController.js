const path = require('path');
const { getPresignedPutUrl, uploadBufferToS3 } = require('../config/s3');

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
]);

const MAX_PHOTOS_PER_REPORT = 5;

/**
 * POST /api/uploadRoutes/presign
 * Body: { files: [{ fileName, fileType }], folder?: string }
 * Returns: [{ uploadUrl, fileUrl, fileName }]
 */
const getPresignedUrls = (req, res) => {
    try {
        const { files, folder = 'uploads' } = req.body;

        if (!Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ message: 'files array is required.' });
        }

        if (files.length > MAX_PHOTOS_PER_REPORT) {
            return res.status(400).json({ message: `Maximum ${MAX_PHOTOS_PER_REPORT} files per request.` });
        }

        for (const f of files) {
            if (!f.fileName || !f.fileType) {
                return res.status(400).json({ message: 'Each file entry must have fileName and fileType.' });
            }
            if (!ALLOWED_MIME_TYPES.has(f.fileType)) {
                return res.status(400).json({ message: `File type "${f.fileType}" is not allowed. Only JPEG, PNG, WebP and GIF are accepted.` });
            }
        }

        const results = files.map(({ fileName, fileType }) => {
            const ext = path.extname(fileName) || '.jpg';
            const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
            const key = `${folder}/${safeName}`;
            const { uploadUrl, fileUrl } = getPresignedPutUrl(key, fileType, 300);
            return { uploadUrl, fileUrl, fileName };
        });

        res.json(results);
    } catch (err) {
        console.error('getPresignedUrls:', err);
        res.status(500).json({ message: 'Failed to generate upload URLs.' });
    }
};

/**
 * POST /api/uploadRoutes/upload
 * Body  : raw binary (the image file)
 * Headers: Content-Type (image MIME), X-File-Name, X-Folder
 * Returns: { fileUrl }
 *
 * The server receives the file and pushes it to S3 via a signed server-side
 * request — no CORS configuration on the bucket required.
 */
const uploadFile = async (req, res) => {
    try {
        const contentType = req.headers['content-type'];
        const fileName    = req.headers['x-file-name'] || 'upload';
        const folder      = req.headers['x-folder']    || 'uploads';

        if (!contentType || !ALLOWED_MIME_TYPES.has(contentType.split(';')[0].trim())) {
            return res.status(400).json({ message: 'Unsupported file type.' });
        }

        const buffer = req.body; // Buffer provided by express.raw()
        if (!buffer || buffer.length === 0) {
            return res.status(400).json({ message: 'Empty file body.' });
        }

        const ext      = path.extname(fileName) || '.jpg';
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const key      = `${folder}/${safeName}`;

        const fileUrl = await uploadBufferToS3(key, contentType.split(';')[0].trim(), buffer);
        res.json({ fileUrl });
    } catch (err) {
        console.error('uploadFile:', err);
        res.status(500).json({ message: 'Upload failed: ' + err.message });
    }
};

module.exports = { getPresignedUrls, uploadFile };
