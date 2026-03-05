# ExploreChina Holidays - Lark Bot (Mei)

An AI-powered travel consultant bot for ExploreChina Holidays, integrated with Lark (Feishu), Supabase, and MiniMax AI.

## Features

- **AI Travel Consultant**: Intelligent responses powered by MiniMax AI
- **Customer Context**: Looks up customer profiles from Supabase before responding
- **Tour Information**: Provides detailed tour pricing and itineraries
- **Lead Capture**: Captures and routes new leads automatically
- **Company Policies**: Access to pricing rules, cancellation policy, FAQs

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables** in `.env`:
   ```
   LARK_APP_ID=cli_a92279f6bf339e1b
   LARK_APP_SECRET=gJZSZKWVWPb0GTeMQTfgDbDIhZi5fRUW
   LARK_VERIFY_TOKEN=S96618512sa86w8#
   
   SUPABASE_URL=https://fyfqasvbiphvrbxgtlle.supabase.co
   SUPABASE_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5ZnFhc3ZiaXBodnJieGd0bGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyNzQ2NDQsImV4cCI6MjA4NDg1MDY0NH0.jr-DrIBIBb0lbIqndFAnkQzCSz2mbhSrSoIEObzfHZo
   SUPABASE_API_SECRET=your_api_secret_from_lovable
   
   MINIMAX_API_KEY=your_minimax_api_key
   ```

3. **Run locally**:
   ```bash
   npm start
   ```

4. **Test endpoints**:
   - Health: http://localhost:3000/health
   - Tours: http://localhost:3000/api/tours
   - Website Info: http://localhost:3000/api/website-info

## Railway Deployment

### Option 1: Deploy via GitHub

1. Push code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial Lark bot"
   # Create a new GitHub repository and push
   ```

2. Deploy in Railway:
   - Go to [railway.app](https://railway.app)
   - New Project → Deploy from GitHub repo
   - Select your repository
   - Add environment variables in Railway dashboard

3. Set environment variables in Railway:
   - `LARK_APP_ID`: `cli_a92279f6bf339e1b`
   - `LARK_APP_SECRET`: `gJZSZKWVWPb0GTeMQTfgDbDIhZi5fRUW`
   - `LARK_VERIFY_TOKEN`: `S96618512sa86w8#`
   - `SUPABASE_URL`: `https://fyfqasvbiphvrbxgtlle.supabase.co`
   - `SUPABASE_API_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - `SUPABASE_API_SECRET`: *(from Lovable settings)*
   - `MINIMAX_API_KEY`: *(your MiniMax key)*

4. Add webhook in Lark Open Platform:
   - URL: `https://your-railway-app.up.railway.app/webhook/lark`

### Option 2: Deploy via Railway CLI

```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set LARK_APP_ID=cli_a92279f6bf339e1b
# ... set other variables
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /webhook/lark` | Lark webhook handler |
| `GET /api/tours` | Get all tours |
| `GET /api/tours?slug=xxx` | Get specific tour |
| `GET /api/website-info` | Company policies |
| `GET /api/customer-context?email=xxx` | Customer profile |

## Available Tours

| Tour | Slug | Price (AUD) |
|------|------|-------------|
| Amazing China | amazing-china | $999 |
| Exquisite China | exquisite-china | $5,999 |
| Discover China | discover-china | $3,499 |
| Heart of China | heart-of-china | $2,899 |
| Incredible China | incredible-china | $3,899 |
| Imperial China & Yangtze | imperial-china-yangtze | $4,599 |
| Legends of China & Warriors | legends-of-china-warriors | $3,299 |
| Silk Road | silk-road | $4,999 |
| China Heartland to Tibet | china-heartland-tibet | $5,299 |
| Whispers of the Terracotta | whispers-of-the-terracotta | $2,499 |
| Winter Wonders China | winter-wonders-china | $2,199 |

## License

MIT
