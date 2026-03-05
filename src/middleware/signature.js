/**
 * Lark Signature Verification Middleware
 * Verifies that incoming requests are from Lark platform
 */

const CryptoJS = require('crypto-js');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Generate signature for verification
 * @param {string} timestamp - Unix timestamp
 * @param {string} nonce - Random string
 * @param {string} body - Request body string
 * @returns {string} - Signature
 */
function generateSignature(timestamp, nonce, body) {
    const { encryptKey, appSecret } = config.lark;
    
    // Sort and concatenate parameters
    const sortedParams = [encryptKey, timestamp, nonce, body].sort();
    const signStr = sortedParams.join('');
    
    // Calculate SHA256 hash
    const signature = CryptoJS.SHA256(signStr).toString();
    
    return signature;
}

/**
 * Verify Lark webhook signature
 */
function verifySignature(req, res, next) {
    // Skip verification in development if no token configured
    if (!config.lark.verifyToken || config.lark.verifyToken === 'your_verify_token') {
        logger.warn('Signature verification disabled - no verify token configured');
        return next();
    }

    const signature = req.headers['x-lark-signature'];
    const timestamp = req.headers['x-lark-timestamp'];
    const nonce = req.headers['x-lark-nonce'];
    
    // If no signature headers, check if it's a GET request (verification challenge)
    if (!signature && req.method === 'GET') {
        return next();
    }

    // If no signature but has body, still process (for development)
    if (!signature && !timestamp && !nonce) {
        logger.warn('No signature headers present - allowing request (dev mode)');
        return next();
    }

    // Verify signature
    const body = req.rawBody || JSON.stringify(req.body);
    const expectedSignature = generateSignature(timestamp, nonce, body);

    if (signature !== expectedSignature) {
        logger.warn('Invalid signature', {
            provided: signature,
            expected: expectedSignature,
            timestamp,
            nonce
        });
        return res.status(403).json({ error: 'Invalid signature' });
    }

    logger.debug('Signature verified successfully');
    next();
}

/**
 * Encrypt response for Lark (if encrypt key is configured)
 */
function encryptResponse(data) {
    const { encryptKey } = config.lark;
    
    if (!encryptKey || encryptKey === 'your_encrypt_key') {
        return data;
    }

    try {
        // Generate random IV
        const iv = CryptoJS.lib.WordArray.random(16);
        
        // Encrypt data
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(data),
            CryptoJS.enc.Base64.parse(encryptKey),
            { iv: iv }
        );
        
        // Combine IV and encrypted data
        const result = iv.concat(encrypted.ciphertext);
        
        return {
            encrypt: 'bizmsg_at',
            msg: CryptoJS.enc.Base64.stringify(result)
        };
    } catch (error) {
        logger.error('Encryption error', { error: error.message });
        return data;
    }
}

module.exports = {
    verifySignature,
    generateSignature,
    encryptResponse
};
