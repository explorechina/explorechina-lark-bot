/**
 * Message Handler
 * Core conversation handling logic for Mei the travel consultant
 */

const supabaseService = require('../services/supabase');
const minimaxService = require('../services/minimax');
const larkService = require('../services/lark');
const leadService = require('../services/lead');
const config = require('../config');
const logger = require('../utils/logger');

// Session cache for conversation state
const sessionCache = new Map();

/**
 * Get or create session for user
 * @param {string} userId - User ID
 * @returns {Object} Session data
 */
function getSession(userId) {
    if (!sessionCache.has(userId)) {
        sessionCache.set(userId, {
            userId,
            leadInfo: {},
            contextFetched: false,
            customerContext: null,
            lastActivity: Date.now()
        });
    }
    
    const session = sessionCache.get(userId);
    session.lastActivity = Date.now();
    
    return session;
}

/**
 * Handle incoming message
 * @param {Object} params - Message parameters
 */
async function handleMessage({ userId, userName, message, messageId, res }) {
    const session = getSession(userId);
    
    logger.logConversation(userId, 'Received message', { 
        userName,
        messageLength: message.length 
    });
    
    try {
        // Step 1: Extract email and get customer context
        const email = supabaseService.extractEmail(message);
        
        let customerContext = null;
        let tourContext = null;
        let websiteInfo = null;
        
        if (email && !session.contextFetched) {
            logger.info('Fetching customer context', { email });
            customerContext = await supabaseService.getCustomerContext(email);
            
            // If known customer, get their tour context
            if (customerContext?.is_known && customerContext.tour) {
                tourContext = customerContext.tour;
            }
            
            session.customerContext = customerContext;
            session.contextFetched = true;
            session.leadInfo.email = email;
        } else if (session.customerContext) {
            customerContext = session.customerContext;
            tourContext = customerContext.tour;
        }
        
        // Get website info for policy questions
        websiteInfo = await supabaseService.getWebsiteInfo();
        
        // Step 2: Classify intent
        const intent = await minimaxService.classifyIntent(message, {
            customer: customerContext,
            tour: tourContext
        });
        
        logger.logConversation(userId, 'Intent classified', { 
            intent: intent.intent,
            reason: intent.reason 
        });
        
        // Step 3: Handle escalation
        if (intent.intent === 'escalate') {
            await handleEscalation(userId, message, session);
            return;
        }
        
        // Step 4: Try to extract and capture lead info
        const extractedLeadInfo = leadService.extractLeadInfo({
            message,
            customer: customerContext?.customer,
            existingInfo: session.leadInfo
        });
        
        // Update session with extracted info
        session.leadInfo = { ...session.leadInfo, ...extractedLeadInfo };
        
        // Step 5: Check if we can/should capture lead
        if (extractedLeadInfo.hasMinimumInfo && leadService.canCreateLead(session.leadInfo.email)) {
            // Try to capture lead
            const leadResult = await captureLead(session, message);
            
            if (leadResult.success) {
                logger.logConversation(userId, 'Lead captured', { 
                    email: session.leadInfo.email 
                });
                
                // Send confirmation to user
                await larkService.sendTextMessage(
                    userId,
                    `Thanks ${session.leadInfo.name}! I've captured your details. 🎉\n\nOur team will be in touch shortly with more information about ${session.leadInfo.tour_interest || 'our China tours'}.\n\nIs there anything else I can help you with?`
                );
                
                return;
            }
        }
        
        // Step 6: If missing info, ask for it
        if (!extractedLeadInfo.hasMinimumInfo && intent.intent !== 'tour_inquiry' && intent.intent !== 'policy_question') {
            const { prompt } = leadService.getMissingInfoPrompt(session.leadInfo);
            
            if (prompt) {
                await larkService.sendTextMessage(userId, prompt);
                return;
            }
        }
        
        // Step 7: Generate AI response
        const context = {
            customer: customerContext,
            tour: tourContext,
            websiteInfo
        };
        
        const response = await minimaxService.generateResponse(message, context);
        
        // Step 8: Send response
        await larkService.sendTextMessage(userId, response);
        
        logger.logConversation(userId, 'Response sent', { 
            responseLength: response.length 
        });
        
    } catch (error) {
        logger.error('Error handling message', { 
            userId, 
            error: error.message,
            stack: error.stack 
        });
        
        // Send error message to user
        await larkService.sendTextMessage(
            userId,
            `I'm having a bit of trouble accessing our system right now. 😔\n\nBut please let me know what you're looking for and I'll have our team follow up with you personally!`
        );
    }
}

/**
 * Handle human escalation
 * @param {string} userId - User ID
 * @param {string} message - Original message
 * @param {Object} session - Session data
 */
async function handleEscalation(userId, message, session) {
    logger.logConversation(userId, 'Escalating to human', { 
        reason: 'User requested human assistance' 
    });
    
    // Send escalation message to user
    await larkService.sendTextMessage(
        userId,
        `I'm connecting you with our travel specialist. 🧑‍💼\n\nThey will be in touch within 2 hours (Mon-Fri 9am-5pm AEST).\n\nIn the meantime, is there anything specific you'd like me to note for them?`
    );
    
    // Try to capture lead if we have info
    if (session.leadInfo.email) {
        try {
            await captureLead(session, `Escalation: ${message}`);
        } catch (error) {
            logger.error('Failed to capture lead during escalation', { 
                error: error.message 
            });
        }
    }
    
    // Note: In production, this would also:
    // - Notify Finn via Lark message
    // - Create a ticket in the CRM
    // - Send email notification
    
    logger.info('Escalation complete', { userId });
}

/**
 * Capture lead to Supabase
 * @param {Object} session - Session data
 * @param {string} message - User message
 * @returns {Promise<Object>} Result
 */
async function captureLead(session, message) {
    const { leadInfo } = session;
    
    if (!leadInfo.email) {
        return { success: false, reason: 'No email' };
    }
    
    // Check rate limit
    if (!leadService.canCreateLead(leadInfo.email)) {
        logger.warn('Rate limit exceeded', { email: leadInfo.email });
        return { success: false, reason: 'Rate limited' };
    }
    
    try {
        const result = await leadService.createLead({
            name: leadInfo.name || 'Unknown',
            email: leadInfo.email,
            phone: leadInfo.phone || '',
            message: message,
            tour_interest: leadInfo.tour_interest || '',
            group_size: leadInfo.group_size || null,
            travel_dates: leadInfo.travel_dates || '',
            utm_source: leadService.getUtmSource('lark')
        });
        
        // Record submission for rate limiting
        leadService.recordLeadSubmission(leadInfo.email);
        
        return result;
        
    } catch (error) {
        logger.error('Failed to capture lead', { 
            email: leadInfo.email,
            error: error.message 
        });
        
        return { success: false, reason: error.message };
    }
}

/**
 * Handle tour inquiry
 * @param {string} userId - User ID
 * @param {string} tourSlug - Tour slug
 * @returns {Promise<string>} Response
 */
async function handleTourInquiry(userId, tourSlug) {
    const tour = await supabaseService.getTour(tourSlug);
    
    if (!tour) {
        return `I couldn't find details for that tour. Would you like me to tell you about our popular options instead?`;
    }
    
    // Send tour card
    const card = larkService.createTourCard(tour);
    await larkService.sendCardMessage(userId, card);
    
    // Also send text summary
    const response = `Here are the details for ${tour.tour_name}:\n\n` +
        `💰 **From AUD $${tour.base_price_aud}** per person\n` +
        `📅 **Duration:** ${tour.duration_days} days\n` +
        `${tour.inclusions ? `✅ Includes: ${tour.inclusions.slice(0, 3).join(', ')}...` : ''}\n\n` +
        `Would you like more information or discuss booking?`;
    
    return response;
}

/**
 * Cleanup old sessions
 * Called periodically to prevent memory leaks
 */
function cleanupSessions() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [userId, session] of sessionCache.entries()) {
        if (now - session.lastActivity > maxAge) {
            sessionCache.delete(userId);
            logger.debug('Cleaned up session', { userId });
        }
    }
}

// Run cleanup every hour
setInterval(cleanupSessions, 60 * 60 * 1000);

module.exports = {
    handleMessage,
    getSession,
    handleEscalation,
    handleTourInquiry
};
