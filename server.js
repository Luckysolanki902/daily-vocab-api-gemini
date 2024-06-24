require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const moment = require('moment-timezone');

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

const wordSchema = new mongoose.Schema({
    word: { type: String, required: true, unique: true },
    meaning: { type: String, required: true },
    examples: { type: [String], required: true }
});

const Word = mongoose.model('Word', wordSchema);

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.log("MongoDB connection error:", err));

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAllWords() {
    try {
        const words = await Word.find().select('word -_id');
        console.log("Fetched existing words from DB");
        return words.map(word => word.word);
    } catch (err) {
        console.error("Error fetching words from DB:", err);
        throw err;
    }
}

async function getNewWord(existingWords) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const chat = model.startChat({
        history: [
            {
                role: "user",
                parts: [{
                    text: `Give me a new commonly used intermediate English word to improve my English vocabulary. The word should be suitable for everyday conversation and practical usage. Provide the word, its meaning, and two example sentences demonstrating its use in daily life. Please respond in JSON format like this: { "word": "example", "meaning": "example meaning", "examples": ["example usage 1", "example usage 2"] }. Avoid these words: ${existingWords.join(', ')}. Just return the JSON and nothing else, in the response.`
                }]
            }
        ],
        generationConfig: { maxOutputTokens: 200 }
    });

    try {
        const result = await chat.sendMessage("");
        const response = result.response;

        let jsonResponse;

        try {
            const cleanedResponse = response.text().replace(/```json|```/g, '').trim();
            jsonResponse = JSON.parse(cleanedResponse);
        } catch (error) {
            console.error("Error parsing JSON response:", error);
            throw new Error("Invalid JSON response");
        }

        return jsonResponse;
    } catch (err) {
        console.error("Error generating new word:", err);
        throw err;
    }
}

async function generateWords() {
    let newWords = [];
    const existingWords = await getAllWords();

    while (newWords.length < 5) {
        try {
            const wordData = await getNewWord(existingWords);
            if (!existingWords.includes(wordData.word)) {
                const newWord = new Word(wordData);
                await newWord.save();
                console.log(`Saved new word: ${wordData.word}`);
                newWords.push(wordData);
                existingWords.push(wordData.word);
            } else {
                console.log(`Word already exists: ${wordData.word}`);
            }
            await delay(5000);
        } catch (err) {
            console.error("Error generating or saving word:", err);
            await delay(15000);
        }
    }

    return newWords;
}

function generateEmailHtml(words) {
    return `
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h1 style="color: #333;">Daily Vocabulary</h1>
            ${words.map(word => `
                <div style="margin-bottom: 20px;">
                    <h2 style="color: #444;">${word.word}</h2>
                    <p><strong>Meaning:</strong> ${word.meaning}</p>
                    <p><strong>Examples:</strong></p>
                    <ul>
                        ${word.examples.map(example => `<li>${example}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </body>
        </html>
    `;
}

async function sendEmail(words) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        subject: 'Your Daily Vocabulary',
        html: generateEmailHtml(words)
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (err) {
        console.error("Error sending email:", err);
        throw err;
    }
}

async function main(testMode = false) {
    try {
        if (testMode) {
            const words = await generateWords();
            await sendEmail(words);
        }

        if (!testMode) {
            cron.schedule('0 8 * * *', async () => {
                console.log('Generating and sending daily vocabulary email...');
                const words = await generateWords();
                await sendEmail(words);
            }, {
                timezone: "Asia/Kolkata"
            });
            console.log("Cron job scheduled to run at 8:00 AM IST");
        }
    } catch (err) {
        console.error("Error in main:", err);
    }
}

main().catch(err => console.error("Unhandled error in main:", err));
