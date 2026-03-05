/**
 * Lead Management Service
 * Handles lead capture and management
 */

const supabaseService = require('./supabase');
const logger = require('../utils/logger');

/**
 * In-memory lead cache (for rate limiting and deduplication)
 * In production, this would be a database
 */
const leadCache = new Map();

/**
 * Create a new lead
 * @param {Object} leadData - Lead data
 * @returns {Promise<Object>} Created lead
 */
async function createLead(leadData) {
    const { name, email, phone, message, tour_interest, group_size, travel_dates } = leadData;
    
    // Validate required fields
    if (!email) {
        throw new Error('Email is required');
    }
    
    if (!name) {
        throw new Error('Name is required');
    }
    
    logger.info('Creating lead', { email, tour_interest });
    
    try {
        // Submit to Supabase
        const response = await supabaseService.submitEnquiry({
            name,
            email,
            phone: phone || '',
            message: message || `Interested in ${tour_interest || 'China tours'}`,
            tour_interest: tour_interest || '',
            group_size: group_size || null,
            travel_dates: travel_dates || '',
            utm_source: leadData.utm_source || 'lark_chat'
        });
        
        logger.logLead(leadData, response);
        
        return {
            success: true,
            category: response.category || 'sales',
            message: 'Lead created successfully'
        };
        
    } catch (error) {
        logger.error('Failed to create lead', { 
            email, 
            error: error.message 
        });
        
        throw error;
    }
}

/**
 * Check if lead can be created (rate limiting)
 * @param {string} email - Lead email
 * @returns {boolean} Can create lead
 */
function canCreateLead(email) {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    // Get lead count for this email in the last hour
    let count = 0;
    for (const [key, timestamp] of leadCache.entries()) {
        if (key.startsWith(email) && timestamp > hourAgo) {
            count++;
        }
    }
    
    // Rate limit: 5 submissions per email per hour
    return count < 5;
}

/**
 * Record lead submission (for rate limiting)
 * @param {string} email - Lead email
 */
function recordLeadSubmission(email) {
    const key = `${email}_${Date.now()}`;
    leadCache.set(key, Date.now());
    
    // Cleanup old entries
    const hourAgo = Date.now() - 60 * 60 * 1000;
    for (const [k, timestamp] of leadCache.entries()) {
        if (timestamp < hourAgo) {
            leadCache.delete(k);
        }
    }
}

/**
 * Extract lead information from conversation
 * @param {Object} context - Conversation context
 * @returns {Object|null} Extracted lead data
 */
function extractLeadInfo(context) {
    const { message, customer, existingInfo } = context;
    
    // Start with existing info
    let leadInfo = { ...existingInfo };
    
    // Extract name if mentioned
    const namePatterns = [
        /(?:i'm|i am|my name is|call me|this is)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,
        /^(hi|hello|hey)\s+([a-zA-Z]+)/i
    ];
    
    if (!leadInfo.name) {
        for (const pattern of namePatterns) {
            const match = message.match(pattern);
            if (match && match[2]) {
                leadInfo.name = match[2].charAt(0).toUpperCase() + match[2].slice(1);
                break;
            }
        }
    }
    
    // Extract email from message
    if (!leadInfo.email && customer?.email) {
        leadInfo.email = customer.email;
    } else if (!leadInfo.email) {
        leadInfo.email = supabaseService.extractEmail(message);
    }
    
    // Extract phone
    if (!leadInfo.phone && customer?.phone) {
        leadInfo.phone = customer.phone;
    } else if (!leadInfo.phone) {
        leadInfo.phone = supabaseService.extractPhone(message);
    }
    
    // Extract tour interest
    const tourKeywords = [
        'exquisite', 'amazing', 'discover', 'heart', 'incredible',
        'imperial', 'legends', 'silk', 'tibet', 'terracotta', 'winter'
    ];
    
    if (!leadInfo.tour_interest) {
        for (const tour of tourKeywords) {
            if (message.toLowerCase().includes(tour)) {
                leadInfo.tour_interest = tour;
                break;
            }
        }
    }
    
    // Extract group size
    if (!leadInfo.group_size) {
        const groupMatch = message.match(/(\d+)\s*(?:people|person|travelers|adults|pax)/i);
        if (groupMatch) {
            leadInfo.group_size = parseInt(groupMatch[1], 10);
        }
    }
    
    // Extract travel dates
    const datePatterns = [
        /([a-zA-Z]+(?:\s+\d{4})?|\d{4})/,
        /(january|february|march|april|may|june|july|august|september|october|november|december)\s*(\d{4})?/i,
        /(spring|summer|autumn|winter)\s*(\d{4})?/i
    ];
    
    if (!leadInfo.travel_dates) {
        for (const pattern of datePatterns) {
            const match = message.match(pattern);
            if (match) {
                leadInfo.travel_dates = match[0];
                break;
            }
        }
    }
    
    // Check if we have minimum required info
    const hasMinimumInfo = leadInfo.name && leadInfo.email;
    
    return {
        ...leadInfo,
        hasMinimumInfo,
        isComplete: leadInfo.name && leadInfo.email && leadInfo.tour_interest
    };
}

/**
 * Check if lead info needs more details
 * @param {Object} leadInfo - Current lead info
 * @returns {Object} Missing fields and prompt
 */
function getMissingInfoPrompt(leadInfo) {
    const missing = [];
    let prompt = '';
    
    if (!leadInfo.name) {
        missing.push('name');
        prompt = 'Could I get your name please?';
    } else if (!leadInfo.email) {
        missing.push('email');
        prompt = `Thanks ${leadInfo.name}! What's your email address so I can send you the details?`;
    } else if (!leadInfo.tour_interest) {
        missing.push('tour_interest');
        prompt = 'Which tour interests you, or would you like me to tell you about our options?';
    }
    
    return { missing, prompt };
}

/**
 * Determine UTM source from channel
 * @param {string} channel - Channel identifier
 * @returns {string} UTM source
 */
function getUtmSource(channel) {
    const sources = {
        'lark': 'lark_chat',
        'whatsapp': 'minimax_whatsapp',
        'email': 'minimax_email',
        'website': 'minimax_web',
        'chatbot': 'minimax_chatbot'
    };
    
    return sources[channel] || 'lark_chat';
}

module.exports = {
    createLead,
    canCreateLead,
    recordLeadSubmission,
    extractLeadInfo,
    getMissingInfoPrompt,
    getUtmSource
};
