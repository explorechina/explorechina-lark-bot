/**
 * MiniMax AI Client
 * Handles AI-powered responses for the travel consultant
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const TIMEOUT = config.server.apiTimeout;

/**
 * Get axios instance for MiniMax
 */
function getClient() {
    return axios.create({
        baseURL: config.minimax.baseUrl,
        timeout: TIMEOUT,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * Build system prompt for Mei (the travel consultant)
 * @param {Object} context - Customer and tour context
 * @returns {string} System prompt
 */
function buildSystemPrompt(context = {}) {
    const { customer, tour, websiteInfo } = context;
    
    let prompt = `You are Mei, a warm and knowledgeable Senior Travel Consultant at ExploreChina Holidays.
You are based in Canberra, Australia, and your company is ATAS accredited.
You specialize in helping Australian travelers, especially women aged 55-75, discover the wonders of China.

IMPORTANT RULES:
- Always be warm, patient, and enthusiastic
- Never make up prices, dates, or tour details - always use the data provided
- Keep responses concise for chat, warmer and fuller for email-style requests
- Use Australian spelling (e.g., "favourite", "colour", "travelling")
- Never mention that you are an AI - present yourself as Mei the travel consultant
- Include relevant emojis to make conversations friendly

ESCALATION TRIGGERS:
Escalate to human (Finn) immediately when customer:
- Asks to speak with a person/human
- Is ready to pay deposit or confirm booking
- Has a complaint or expresses frustration
- Has complex custom itinerary requests
- Is booking for 10+ people
- Has medical or accessibility requirements
- Asks for price match with competitor

When escalating, say: "I'm connecting you with our travel specialist. They will be in touch within 2 hours (Mon-Fri 9am-5pm AEST)."

YOUR RESPONSE STYLE:
- Start with a warm greeting
- Address the customer by name if known
- Provide helpful, accurate information
- Ask follow-up questions to understand their needs
- End with an invitation to ask more questions

`;

    // Add customer context if available
    if (customer && customer.is_known) {
        const c = customer;
        prompt += `\n\nCUSTOMER CONTEXT:\n`;
        prompt += `Customer Name: ${c.name}\n`;
        prompt += `Email: ${c.email}\n`;
        if (c.phone) prompt += `Phone: ${c.phone}\n`;
        if (c.tour_interest) prompt += `Tour Interest: ${c.tour_interest}\n`;
        if (c.group_size) prompt += `Group Size: ${c.group_size}\n`;
        if (c.travel_dates) prompt += `Travel Dates: ${c.travel_dates}\n`;
        if (c.status) prompt += `Status: ${c.status}\n`;
        if (c.notes) prompt += `Notes: ${c.notes}\n`;
        prompt += `Quoted Amount: AUD $${c.quoted_amount || 'TBD'}\n`;
    }

    // Add tour context if available
    if (tour) {
        prompt += `\n\nTOUR DETAILS:\n`;
        prompt += `Tour Name: ${tour.tour_name}\n`;
        prompt += `Duration: ${tour.duration_days} days\n`;
        prompt += `Base Price: AUD $${tour.base_price_aud}\n`;
        if (tour.inclusions && tour.inclusions.length > 0) {
            prompt += `Inclusions: ${tour.inclusions.join(', ')}\n`;
        }
        if (tour.available !== undefined) {
            prompt += `Available: ${tour.available ? 'Yes' : 'No'}\n`;
        }
    }

    // Add website info if available
    if (websiteInfo) {
        prompt += `\n\nCOMPANY POLICIES:\n`;
        if (websiteInfo.cancellation_policy) {
            prompt += `Cancellation Policy: ${websiteInfo.cancellation_policy}\n`;
        }
        if (websiteInfo.payment_schedule) {
            prompt += `Payment Schedule: ${websiteInfo.payment_schedule}\n`;
        }
        if (websiteInfo.visa_info) {
            prompt += `Visa Info: ${websiteInfo.visa_info}\n`;
        }
    }

    return prompt;
}

/**
 * Generate AI response
 * @param {string} userMessage - User's message
 * @param {Object} context - Context data (customer, tour, etc.)
 * @returns {Promise<string>} AI response
 */
async function generateResponse(userMessage, context = {}) {
    const startTime = Date.now();
    
    // Check if MiniMax is configured
    if (!config.minimax.apiKey || config.minimax.apiKey === 'your_minimax_api_key') {
        logger.warn('MiniMax API key not configured - using fallback response');
        return generateFallbackResponse(userMessage, context);
    }
    
    try {
        logger.info('Generating MiniMax response', { 
            messageLength: userMessage.length,
            hasCustomer: !!context.customer,
            hasTour: !!context.tour
        });
        
        const systemPrompt = buildSystemPrompt(context);
        
        const response = await getClient().post('/v1/text/chatcompletion_v2', {
            model: config.minimax.model,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userMessage
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        }, {
            headers: {
                'Authorization': `Bearer ${config.minimax.apiKey}`
            }
        });
        
        const aiResponse = response.data?.choices?.[0]?.message?.content || '';
        
        logger.logAI(userMessage, aiResponse, Date.now() - startTime);
        
        return aiResponse;
        
    } catch (error) {
        logger.error('MiniMax API error', { 
            error: error.message,
            status: error.response?.status
        });
        
        // Fallback to rule-based response
        return generateFallbackResponse(userMessage, context);
    }
}

/**
 * Generate fallback response when AI is unavailable
 * @param {string} userMessage - User's message
 * @param {Object} context - Context data
 * @returns {string} Fallback response
 */
function generateFallbackResponse(userMessage, context) {
    const { customer, tour } = context;
    const message = userMessage.toLowerCase();
    const customerName = customer?.name || 'there';
    
    // Greeting patterns
    if (message.match(/^(hi|hello|hey|g'day|good (morning|afternoon|evening))/)) {
        const greetings = [
            `Hi ${customerName}! 👋 Welcome to ExploreChina Holidays! I'm Mei, and I'll be happy to help you discover the wonders of China. What would you like to know?`,
            `Hello ${customerName}! 🌟 So lovely to have you here! I'm Mei from ExploreChina Holidays. How can I assist with your China travel plans today?`,
            `Hi ${customerName}! 🇨🇳 Welcome! I'm Mei, your China travel consultant. What brings you to ExploreChina Holidays today?`
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }
    
    // Tour inquiry
    if (message.includes('tour') || message.includes('price') || message.includes('cost')) {
        if (tour) {
            return `Great question! I've pulled up the details for ${tour.tour_name}.\n\n💰 **From AUD $${tour.base_price_aud}** (per person)\n📅 **Duration:** ${tour.duration_days} days\n\nThis includes ${tour.inclusions?.slice(0, 3).join(', ')}...\n\nWould you like more details about this tour, or would you prefer to explore other options?`;
        }
        
        return `We offer a wonderful range of China tours! Our most popular options include:\n\n🌟 **Exquisite China** - 18 days from AUD $5,999\n🏯 **Imperial China & Yangtze** - from AUD $4,599\n🏔️ **China Heartland to Tibet** - from AUD $5,299\n\nWould you like me to tell you more about any of these, or let me know what type of experience you're looking for?`;
    }
    
    // Visa question
    if (message.includes('visa') || message.includes('passport')) {
        return `Great question about visas! 🇨🇳\n\nAustralian passport holders need a visa for China. The good news is we guide you through the entire process - it's simpler than it looks!\n\nWe provide:\n✅ Step-by-step visa application guidance\n✅ Invitation letter if needed\n✅ Tips for a smooth application\n\nWould you like more details about the visa process?`;
    }
    
    // When are you open / contact
    if (message.includes('open') || message.includes('contact') || message.includes('phone') || message.includes('email')) {
        return `We're here to help! 📞\n\n📧 **Email:** info@explorechinaholidays.com\n📞 **Phone:** +61 2 1234 5678\n🕐 **Hours:** Mon-Fri 9am-5pm AEST\n\nOf course, you can also chat with me here anytime! What would you like to know?`;
    }
    
    // Thank you
    if (message.includes('thank') || message.includes('thanks')) {
        const thanks = [
            `You're very welcome, ${customerName}! 😊 It's my pleasure to help! Let me know if there's anything else you'd like to know.`,
            `Not a problem at all! 🙌 Happy to help! Don't hesitate to ask if you have more questions.`
        ];
        return thanks[Math.floor(Math.random() * thanks.length)];
    }
    
    // Default warm response
    return `Thanks for reaching out, ${customerName}! 🌟\n\nI'm here to help you plan your perfect China adventure. Whether you're curious about tours, prices, visas, or anything else - just ask!\n\nWhat would you like to know?`;
}

/**
 * Classify user intent
 * @param {string} message - User message
 * @param {Object} context - Context data
 * @returns {Promise<Object>} Intent classification
 */
async function classifyIntent(message, context = {}) {
    const msg = message.toLowerCase();
    
    // Check for escalation keywords
    const escalationKeywords = config.bot.escalation.triggerKeywords;
    for (const keyword of escalationKeywords) {
        if (msg.includes(keyword)) {
            return { intent: 'escalate', reason: `Keyword: ${keyword}` };
        }
    }
    
    // Check for auto-escalate scenarios
    const autoEscalate = config.bot.escalation.autoEscalate;
    for (const scenario of autoEscalate) {
        if (msg.includes(scenario)) {
            return { intent: 'escalate', reason: `Auto-escalate: ${scenario}` };
        }
    }
    
    // Check for tour inquiry
    if (msg.includes('tour') || msg.includes('price') || msg.includes('cost') || msg.includes('how much')) {
        return { intent: 'tour_inquiry', confidence: 0.8 };
    }
    
    // Check for policy question
    if (msg.includes('visa') || msg.includes('cancel') || msg.includes('refund') || msg.includes('payment') || msg.includes('include')) {
        return { intent: 'policy_question', confidence: 0.7 };
    }
    
    // Check for lead capture opportunity
    if (msg.includes('email') || msg.includes('contact') || msg.includes('send') || msg.includes('details')) {
        return { intent: 'lead_capture', confidence: 0.6 };
    }
    
    // Check for booking intent
    if (msg.includes('book') || msg.includes('reserve') || msg.includes('confirm')) {
        return { intent: 'booking_intent', confidence: 0.7 };
    }
    
    return { intent: 'general', confidence: 0.5 };
}

module.exports = {
    generateResponse,
    classifyIntent,
    buildSystemPrompt,
    generateFallbackResponse
};
