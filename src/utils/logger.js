/**
 * Logging Utility
 * Simple structured logging for the bot
 */

const config = require('../config');

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

class Logger {
    constructor() {
        this.level = config.server.env === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug;
        this.service = 'MeiBot';
    }

    _log(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            service: this.service,
            level: level.toUpperCase(),
            message,
            ...meta
        };

        // Console output with colors
        const colors = {
            debug: '\x1b[36m',   // cyan
            info: '\x1b[32m',    // green
            warn: '\x1b[33m',    // yellow
            error: '\x1b[31m',   // red
            reset: '\x1b[0m'
        };

        const color = colors[level] || '';
        const reset = colors.reset;

        if (LOG_LEVELS[level] >= this.level) {
            if (level === 'error') {
                console.error(color + `[${timestamp}] [${level.toUpperCase()}] [${this.service}] ${message}` + reset, meta);
            } else if (level === 'warn') {
                console.warn(color + `[${timestamp}] [${level.toUpperCase()}] [${this.service}] ${message}` + reset, meta);
            } else {
                console.log(color + `[${timestamp}] [${level.toUpperCase()}] [${this.service}] ${message}` + reset, meta);
            }
        }

        return logEntry;
    }

    debug(message, meta) {
        return this._log('debug', message, meta);
    }

    info(message, meta) {
        return this._log('info', message, meta);
    }

    warn(message, meta) {
        return this._log('warn', message, meta);
    }

    error(message, meta) {
        return this._log('error', message, meta);
    }

    // Log API request
    logRequest(method, url, status, duration, meta = {}) {
        this.info(`${method} ${url} ${status}`, {
            duration_ms: duration,
            ...meta
        });
    }

    // Log conversation
    logConversation(userId, action, meta = {}) {
        this.info(`Conversation[${userId}]: ${action}`, meta);
    }

    // Log lead capture
    logLead(leadData, result) {
        this.info('Lead captured', {
            lead_email: leadData.email,
            lead_name: leadData.name,
            tour_interest: leadData.tour_interest,
            success: result.success,
            category: result.category
        });
    }

    // Log AI response
    logAI(prompt, response, duration, meta = {}) {
        this.debug('AI Response', {
            prompt_length: prompt.length,
            response_length: response.length,
            duration_ms: duration,
            ...meta
        });
    }
}

// Export singleton logger
module.exports = new Logger();
