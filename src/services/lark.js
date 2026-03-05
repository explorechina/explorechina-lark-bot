/**
 * Lark (Feishu) API Client
 * Handles communication with Lark Open Platform
 */

const axios = require('axios');
const CryptoJS = require('crypto-js');
const config = require('../config');
const logger = require('../utils/logger');

const TIMEOUT = config.server.apiTimeout;

/**
 * Get axios instance for Lark API
 */
function getClient() {
    return axios.create({
        baseURL: config.lark.baseUrl,
        timeout: TIMEOUT,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * Get app access token
 * @returns {Promise<string>} Access token
 */
async function getAccessToken() {
    const cacheKey = 'lark_access_token';
    
    // Check cache (simple in-memory cache)
    if (getAccessToken.cache && getAccessToken.cache.expires > Date.now()) {
        return getAccessToken.cache.token;
    }
    
    try {
        logger.info('Fetching Lark access token');
        
        const response = await getClient().post('/authen/v1/access_token', {
            app_id: config.lark.appId,
            app_secret: config.lark.appSecret
        });
        
        const { access_token, expire } = response.data;
        
        // Cache token (subtract 5 minutes for safety)
        getAccessToken.cache = {
            token: access_token,
            expires: Date.now() + (expire - 300) * 1000
        };
        
        return access_token;
    } catch (error) {
        logger.error('Failed to get Lark access token', { error: error.message });
        throw error;
    }
}
// Cache for access token
getAccessToken.cache = null;

/**
 * Send message to user
 * @param {string} openId - User's open ID
 * @param {string} content - Message content (text or JSON for cards)
 * @param {string} msgType - Message type (text, interactive, etc.)
 * @returns {Promise<Object>} Send response
 */
async function sendMessage(openId, content, msgType = 'text') {
    try {
        const accessToken = await getAccessToken();
        
        logger.info('Sending Lark message', { openId, msgType });
        
        const response = await getClient().post('/im/v1/messages', {
            receive_id_type: 'open_id',
            receiver_id: openId,
            msg_type: msgType,
            content: typeof content === 'string' ? content : JSON.stringify(content)
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        logger.logRequest('POST', '/im/v1/messages', response.status, 0);
        
        return response.data;
    } catch (error) {
        logger.error('Failed to send Lark message', { 
            openId, 
            error: error.message 
        });
        throw error;
    }
}

/**
 * Send text message to user
 * @param {string} openId - User's open ID
 * @param {string} text - Text message
 * @returns {Promise<Object>} Send response
 */
async function sendTextMessage(openId, text) {
    return sendMessage(openId, { text }, 'text');
}

/**
 * Send interactive card to user
 * @param {string} openId - User's open ID
 * @param {Object} card - Card JSON
 * @returns {Promise<Object>} Send response
 */
async function sendCardMessage(openId, card) {
    return sendMessage(openId, card, 'interactive');
}

/**
 * Create tour card
 * @param {Object} tour - Tour data
 * @returns {Object} Card JSON
 */
function createTourCard(tour) {
    return {
        config: {
            wide_screen_mode: true
        },
        elements: [
            {
                tag: 'div',
                text: {
                    tag: 'plain_text',
                    content: tour.tour_name || tour.tourName || 'China Tour',
                    style: {
                        bold: true,
                        font_size: 'large'
                    }
                }
            },
            {
                tag: 'div',
                text: {
                    tag: 'plain_text',
                    content: `Duration: ${tour.duration_days || tour.durationDays || 'N/A'} days`,
                    style: {
                        color: '#666666'
                    }
                }
            },
            {
                tag: 'div',
                text: {
                    tag: 'plain_text',
                    content: `From: AUD $${tour.base_price_aud || tour.priceAud || 'Contact us'}`,
                    style: {
                        color: '#1A56A0',
                        bold: true
                    }
                }
            },
            {
                tag: 'action',
                actions: [
                    {
                        tag: 'button',
                        text: {
                            tag: 'plain_text',
                            content: 'View Details'
                        },
                        type: 'primary',
                        url: `https://explorechinaholidays.com/tours/${tour.slug}`
                    }
                ]
            }
        ]
    };
}

/**
 * Create lead confirmation card
 * @param {Object} leadData - Lead data
 * @returns {Object} Card JSON
 */
function createLeadConfirmationCard(leadData) {
    return {
        config: {
            wide_screen_mode: true
        },
        header: {
            title: {
                tag: 'plain_text',
                content: 'Lead Captured ✓'
            },
            template: 'green'
        },
        elements: [
            {
                tag: 'div',
                text: {
                    tag: 'plain_text',
                    content: `Name: ${leadData.name}`
                }
            },
            {
                tag: 'div',
                text: {
                    tag: 'plain_text',
                    content: `Email: ${leadData.email}`
                }
            },
            {
                tag: 'div',
                text: {
                    tag: 'plain_text',
                    content: `Tour: ${leadData.tour_interest || 'General inquiry'}`
                }
            },
            {
                tag: 'div',
                text: {
                    tag: 'plain_text',
                    content: 'Our team will contact you shortly!'
                }
            }
        ]
    };
}

/**
 * Reply to message
 * @param {string} messageId - Message ID to reply to
 * @param {string} content - Reply content
 * @param {string} msgType - Message type
 * @returns {Promise<Object>} Reply response
 */
async function replyToMessage(messageId, content, msgType = 'text') {
    try {
        const accessToken = await getAccessToken();
        
        logger.info('Replying to Lark message', { messageId });
        
        const response = await getClient().post(`/im/v1/messages/${messageId}/reply`, {
            msg_type: msgType,
            content: typeof content === 'string' ? content : JSON.stringify(content)
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        return response.data;
    } catch (error) {
        logger.error('Failed to reply to Lark message', { 
            messageId, 
            error: error.message 
        });
        throw error;
    }
}

/**
 * Get user info
 * @param {string} openId - User's open ID
 * @returns {Promise<Object>} User info
 */
async function getUserInfo(openId) {
    try {
        const accessToken = await getAccessToken();
        
        const response = await getClient().get(`/contact/v3/users/${openId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        return response.data;
    } catch (error) {
        logger.error('Failed to get user info', { openId, error: error.message });
        return null;
    }
}

module.exports = {
    getAccessToken,
    sendMessage,
    sendTextMessage,
    sendCardMessage,
    createTourCard,
    createLeadConfirmationCard,
    replyToMessage,
    getUserInfo
};
