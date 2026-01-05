# Grocery List App

A modern grocery list management application with AI-powered item parsing and categorization.

## Features

- **AI-Powered Parsing**: Add items naturally, and the AI will understand and categorize them
- **Product Cache**: Previously parsed items are cached for instant recognition
- **Shopping Mode**: Swipe-based interface for marking items as found or not found
- **History**: Track your shopping sessions and restore items if needed
- **Multi-User**: Full authentication with separate lists per user
- **Responsive**: Works great on both desktop and mobile

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS + shadcn/ui for styling
- Framer Motion for animations
- React Router for navigation

### Backend
- Express.js
- PostgreSQL database
- JWT authentication
- Google Gemini AI for item parsing

### Infrastructure
- Docker & Docker Compose
- nginx for frontend serving and API proxy
- Persistent volumes for data

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Google AI API key (for Gemini)

### Setup

1. Clone the repository and navigate to the project:
   ```bash
   cd grocery-app-web
   ```

2. Create a `.env` file with your secrets:
   ```bash
   JWT_SECRET=your-secure-jwt-secret-key
   GOOGLE_API_KEY=your-google-ai-api-key
   ```

3. Start the application:
   ```bash
   docker-compose up -d
   ```

4. Access the app at http://localhost

### Development

#### Backend Development
```bash
cd backend
npm install
npm run dev
```

#### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT signing | Yes |
| `GOOGLE_API_KEY` | Google AI API key for Gemini | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Auto-set in Docker |
| `REDIS_URL` | Redis connection string | Auto-set in Docker |

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Groceries
- `GET /api/groceries` - Get all items
- `POST /api/groceries/parse` - Parse and add items with AI
- `POST /api/groceries` - Add single item
- `PUT /api/groceries/:id` - Update item
- `PATCH /api/groceries/:id/status` - Update item status
- `DELETE /api/groceries/:id` - Delete item
- `POST /api/groceries/complete-shopping` - Complete shopping session

### History
- `GET /api/history` - Get history items
- `GET /api/history/sessions` - Get shopping sessions
- `POST /api/history/:id/restore` - Restore item from history

## Item Statuses

- `pending` - Item on the list, not yet selected
- `selected` - Item currently being looked for
- `found` - Item was found
- `not_found` - Item was not found

## License

MIT

