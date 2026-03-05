/**
 * Supabase API Client
 * Handles all communication with Supabase backend
 */

const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const TIMEOUT = config.server.apiTimeout;

/**
 * Get axios instance for Supabase
 */
function getClient() {
    return axios.create({
        baseURL: config.supabase.functionsUrl,
        timeout: TIMEOUT,
        headers: {
            'Content-Type': 'application/json'
        }
    });
}

/**
 * Get axios instance with API secret for customer-context
 */
function getSecretClient() {
    return axios.create({
        baseURL: config.supabase.functionsUrl,
        timeout: TIMEOUT,
        headers: {
            'Content-Type': 'application/json',
            'x-api-secret': config.supabase.apiSecret
        }
    });
}

/**
 * Get customer context by email
 * @param {string} email - Customer email
 * @returns {Promise<Object>} Customer context
 */
async function getCustomerContext(email) {
    const startTime = Date.now();
    
    try {
        logger.info('Fetching customer context', { email });
        
        const response = await getSecretClient().get('/customer-context', {
            params: { email }
        });
        
        logger.logRequest('GET', '/customer-context', response.status, Date.now() - startTime);
        
        return response.data;
    } catch (error) {
        logger.error('Failed to fetch customer context', { 
            email, 
            error: error.message 
        });
        
        // Return unknown customer on error
        return {
            is_known: false,
            customer: null,
            tour: null
        };
    }
}

/**
 * Get all tours
 * @returns {Promise<Array>} List of tours
 */
async function getTours() {
    const startTime = Date.now();
    
    try {
        logger.info('Fetching all tours');
        
        const response = await getClient().get('/get-tours', {
            headers: {
                'apikey': config.supabase.apiKey
            }
        });
        
        logger.logRequest('GET', '/get-tours', response.status, Date.now() - startTime);
        
        return response.data;
    } catch (error) {
        logger.error('Failed to fetch tours', { error: error.message });
        
        // Return fallback tour catalog
        return config.tours.catalog;
    }
}

/**
 * Get specific tour by slug
 * @param {string} slug - Tour slug
 * @returns {Promise<Object>} Tour details
 */
async function getTour(slug) {
    const startTime = Date.now();
    
    try {
        logger.info('Fetching tour', { slug });
        
        const response = await getClient().get('/get-tours', {
            params: { slug },
            headers: {
                'apikey': config.supabase.apiKey
            }
        });
        
        logger.logRequest('GET', `/get-tours?slug=${slug}`, response.status, Date.now() - startTime);
        
        // Handle array response (returns all tours filtered)
        if (Array.isArray(response.data) && response.data.length > 0) {
            return response.data[0];
        }
        
        return response.data;
    } catch (error) {
        logger.error('Failed to fetch tour', { slug, error: error.message });
        
        // Return fallback tour
        return config.tours.catalog.find(t => t.slug === slug) || null;
    }
}

/**
 * Get website info (policies, FAQs, etc.)
 * @returns {Promise<Object>} Website info
 */
async function getWebsiteInfo() {
    const startTime = Date.now();
    
    try {
        logger.info('Fetching website info');
        
        const response = await getClient().get('/website-info', {
            headers: {
                'apikey': config.supabase.apiKey
            }
        });
        
        logger.logRequest('GET', '/website-info', response.status, Date.now() - startTime);
        
        return response.data;
    } catch (error) {
        logger.error('Failed to fetch website info', { error: error.message });
        
        // Return default info
        return {
            company_name: 'ExploreChina Holidays',
            phone: '+61 2 1234 5678',
            email: 'info@explorechinaholidays.com',
            address: 'Canberra ACT, Australia',
            atas_accredited: true,
            cancellation_policy: 'Contact us for details',
            payment_schedule: '30% deposit, remainder 60 days before departure'
        };
    }
}

/**
 * Submit contact enquiry (create lead)
 * @param {Object} data - Lead data
 * @returns {Promise<Object>} Response
 */
async function submitEnquiry(data) {
    const startTime = Date.now();
    
    try {
        logger.info('Submitting contact enquiry', { 
            email: data.email,
            tour_interest: data.tour_interest 
        });
        
        const response = await getClient().post('/contact-enquiry', data, {
            headers: {
                'apikey': config.supabase.apiKey
            }
        });
        
        logger.logRequest('POST', '/contact-enquiry', response.status, Date.now() - startTime);
        
        return response.data;
    } catch (error) {
        logger.error('Failed to submit enquiry', { 
            error: error.message,
            data 
        });
        
        throw error;
    }
}

/**
 * Extract email from text
 * @param {string} text - Text to search
 * @returns {string|null} Email if found
 */
function extractEmail(text) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    return matches ? matches[0] : null;
}

/**
 * Extract phone from text
 * @param {string} text - Text to search
 * @returns {string|null} Phone if found
 */
function extractPhone(text) {
    // Match various phone formats
    const phoneRegex = /(?:\+?61|0)[2-478](?:[ -]?[0-9]){8}|(?:\+?64|0)[2-9](?:[ -]?[0-9]){7,9}/g;
    const matches = text.match(phoneRegex);
    return matches ? matches[0] : null;
}

module.exports = {
    getCustomerContext,
    getTours,
    getTour,
    getWebsiteInfo,
    submitEnquiry,
    extractEmail,
    extractPhone
};
