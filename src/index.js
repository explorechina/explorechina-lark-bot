/**
 * ExploreChina Holidays - Mei Lark Bot
 * Main Server Entry Point
 * 
 * This server handles Lark (Feishu) webhooks and provides
 * AI-powered travel consulting for ExploreChina Holidays.
 */

require('dotenv').config();

const express = require('express');
const logger = require('./utils/logger');
const config = require('./config');
const larkService = require('./services/lark');
const supabaseService = require('./services/supabase');
const minimaxService = require('./services/minimax');
const leadService = require('./services/lead');
const messageHandler = require('./handlers/message');
const signatureMiddleware = require('./middleware/signature');

const app = express();

// Middleware
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

// Trust proxy for getting real IP behind load balancers
app.set('trust proxy', true);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'ExploreChina Mei Bot',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Landing page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Lark Webhook Endpoints
// -----------------------

// GET endpoint for Lark webhook verification (initial setup)
app.get('/webhook/lark', (req, res) => {
    logger.info('Lark webhook verification request (GET)', { query: req.query });
    
    const { challenge, verify_token } = req.query;
    
    // Skip token verification for now - return challenge directly
    // In production, you should verify the token matches
    if (challenge) {
        logger.info('Webhook verified successfully (GET)');
        return res.json({ challenge });
    }
    
    logger.warn('No challenge provided');
    return res.status(400).json({ error: 'No challenge provided' });
});

// POST endpoint for Lark events/messages
app.post('/webhook/lark', async (req, res) => {
    try {
        const event = req.body;
        
        // Handle URL verification challenge (POST) - before signature check
        if (event.header?.event_type === 'url_verification') {
            logger.info('URL verification challenge (POST)', { challenge: event.event?.challenge });
            return res.json({ challenge: event.event?.challenge });
        }

        // Now verify signature for other events
        const signature = req.headers['x-lark-signature'];
        const timestamp = req.headers['x-lark-timestamp'];
        const nonce = req.headers['x-lark-nonce'];
        
        if (!signature && !timestamp && !nonce) {
            logger.warn('No signature headers - allowing request');
        } else {
            // Signature verification would go here if needed
        }
        
        // Log incoming event
        logger.info('Received Lark event', { 
            eventType: event.header?.event_type,
            messageId: event.event?.message?.message_id 
        });

        // Handle message events
        if (event.header?.event_type === 'im.message.receive_v1') {
            const message = event.event?.message;
            
            // Only handle text messages
            if (message?.message_type === 'text') {
                const messageContent = message.body?.content || '';
                const userId = message.sender?.sender_id?.open_id;
                const userName = message.sender?.sender_id?.name || 'Customer';
                
                logger.info('Processing message', { 
                    userId, 
                    userName,
                    content: messageContent.substring(0, 100)
                });

                // Process message asynchronously
                messageHandler.handleMessage({
                    userId,
                    userName,
                    message: messageContent,
                    messageId: message.message_id,
                    res
                }).catch(err => {
                    logger.error('Error handling message', { error: err.message });
                });
                
                // Return 200 immediately to acknowledge receipt
                return res.json({ success: true });
            }
        }

        // Return success for other event types
        res.json({ success: true });
        
    } catch (error) {
        logger.error('Error processing Lark webhook', { 
            error: error.message,
            stack: error.stack 
        });
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Internal API Endpoints
// -----------------------

// Get all tours
app.get('/api/tours', async (req, res) => {
    try {
        const tours = await supabaseService.getTours();
        res.json(tours);
    } catch (error) {
        logger.error('Error fetching tours', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch tours' });
    }
});

// Get specific tour
app.get('/api/tours/:slug', async (req, res) => {
    try {
        const tour = await supabaseService.getTour(req.params.slug);
        if (!tour) {
            return res.status(404).json({ error: 'Tour not found' });
        }
        res.json(tour);
    } catch (error) {
        logger.error('Error fetching tour', { error: error.message, slug: req.params.slug });
        res.status(500).json({ error: 'Failed to fetch tour' });
    }
});

// Get customer context
app.get('/api/customer/:email', async (req, res) => {
    try {
        const context = await supabaseService.getCustomerContext(req.params.email);
        res.json(context);
    } catch (error) {
        logger.error('Error fetching customer context', { error: error.message, email: req.params.email });
        res.status(500).json({ error: 'Failed to fetch customer context' });
    }
});

// Create new lead
app.post('/api/leads', async (req, res) => {
    try {
        const lead = await leadService.createLead(req.body);
        res.json(lead);
    } catch (error) {
        logger.error('Error creating lead', { error: error.message });
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

// Get website info (policies, FAQs, etc.)
app.get('/api/info', async (req, res) => {
    try {
        const info = await supabaseService.getWebsiteInfo();
        res.json(info);
    } catch (error) {
        logger.error('Error fetching website info', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch website info' });
    }
});

// Test AI response (for debugging)
app.post('/api/test/ai', async (req, res) => {
    try {
        const { message, context } = req.body;
        const response = await minimaxService.generateResponse(message, context);
        res.json({ response });
    } catch (error) {
        logger.error('Error generating AI response', { error: error.message });
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = config.server.port || 3000;

app.listen(PORT, () => {
    logger.info(`ExploreChina Mei Bot starting on port ${PORT}`);
    logger.info(`Environment: ${config.server.env}`);
    logger.info(`Lark App ID: ${config.lark.appId ? 'configured' : 'not configured'}`);
    logger.info(`Supabase: ${config.supabase.url}`);
});

module.exports = app;
