/**
 * Configuration Management
 * Centralized configuration for all services
 */

module.exports = {
    // Lark (Feishu) Configuration
    lark: {
        appId: process.env.LARK_APP_ID || '',
        appSecret: process.env.LARK_APP_SECRET || '',
        verifyToken: process.env.LARK_VERIFY_TOKEN || '',
        encryptKey: process.env.LARK_ENCRYPT_KEY || '',
        baseUrl: 'https://open.feishu.cn/open-apis'
    },

    // Supabase Configuration
    supabase: {
        url: process.env.SUPABASE_URL || 'https://fyfqasvbiphvrbxgtlle.supabase.co',
        apiKey: process.env.SUPABASE_API_KEY || '',
        apiSecret: process.env.SUPABASE_API_SECRET || '',
        functionsUrl: (process.env.SUPABASE_URL || 'https://fyfqasvbiphvrbxgtlle.supabase.co') + '/functions/v1'
    },

    // MiniMax AI Configuration
    minimax: {
        apiKey: process.env.MINIMAX_API_KEY || '',
        baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat',
        model: process.env.MINIMAX_MODEL || 'abab6.5s-chat'
    },

    // Server Configuration
    server: {
        port: parseInt(process.env.PORT, 10) || 3000,
        env: process.env.NODE_ENV || 'development',
        apiTimeout: parseInt(process.env.API_TIMEOUT, 10) || 30000
    },

    // Bot Persona Configuration
    bot: {
        name: 'Mei',
        fullName: 'Mei - ExploreChina Travel Consultant',
        role: 'Senior Travel Consultant at ExploreChina Holidays',
        company: 'ExploreChina Holidays',
        tagline: 'Your Expert Guide to China Travel',
        
        // Persona traits
        personality: {
            warm: true,
            patient: true,
            knowledgeable: true,
            enthusiastic: true,
            professional: true
        },

        // Target audience
        audience: {
            primary: 'Women aged 55-75',
            secondary: 'First-time China travelers from Australia',
            language: 'English (Australian spelling)'
        },

        // Escalation settings
        escalation: {
            // Keywords that trigger human handoff
            triggerKeywords: [
                'human', 'agent', 'manager', 'speak to someone',
                'real person', 'person', 'complaint', 'speak to Finn',
                'talk to a person', 'need help from person'
            ],
            // Sentiment threshold for escalation (0-1)
            negativeSentimentThreshold: 0.7,
            // Auto-escalate these scenarios
            autoEscalate: [
                'ready to pay', 'want to book', 'confirm booking',
                'pay deposit', 'credit card', 'make payment'
            ]
        }
    },

    // Tour Catalog (fallback if API unavailable)
    tours: {
        catalog: [
            { name: 'Amazing China', slug: 'amazing-china', priceAud: 999 },
            { name: 'Exquisite China', slug: 'exquisite-china', priceAud: 5999 },
            { name: 'Discover China', slug: 'discover-china', priceAud: 3499 },
            { name: 'Heart of China', slug: 'heart-of-china', priceAud: 2899 },
            { name: 'Incredible China', slug: 'incredible-china', priceAud: 3899 },
            { name: 'Imperial China & Yangtze', slug: 'imperial-china-yangtze', priceAud: 4599 },
            { name: 'Legends of China & Warriors', slug: 'legends-of-china-warriors', priceAud: 3299 },
            { name: 'Silk Road', slug: 'silk-road', priceAud: 4999 },
            { name: 'China Heartland to Tibet', slug: 'china-heartland-tibet', priceAud: 5299 },
            { name: 'Whispers of the Terracotta', slug: 'whispers-of-the-terracotta', priceAud: 2499 },
            { name: 'Winter Wonders China', slug: 'winter-wonders-china', priceAud: 2199 }
        ]
    }
};
