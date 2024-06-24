
Daily Vocabulary API Integration
===============================

This Node.js application fetches new vocabulary words daily from an API, stores them in MongoDB, and sends a daily email with word meanings and examples.

Setup
-----

1. Clone the repository and install dependencies:

   ```bash
   git clone Daily-Vocab-Api---geminiAi
   cd <repository_directory>
   npm install
   ```

2. Set environment variables in a `.env` file:

   ```
   API_KEY=your_google_generative_ai_api_key
   MONGODB_URI=your_mongodb_connection_string
   EMAIL_USER=your_gmail_address
   EMAIL_PASSWORD=your_gmail_password
   ```

Usage
-----


### Production Mode

To schedule daily emails at 8:00 AM IST:

```bash
npm run start
```

Notes
-----

- Uses `@google/generative-ai` for word generation.
- Requires MongoDB for storage and Gmaigit l for email sending.

