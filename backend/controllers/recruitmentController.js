import OpenAI from 'openai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

console.log('Recruitment Controller Loaded (OpenAI Version)');

// Lazy init inside the function to ensure env vars are loaded
let openai;

export const parseResume = async (req, res) => {
    try {
        if (!openai) {
            console.log('Initializing OpenAI Client...');
            openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
        }
        console.log('--- Resume Parse Request Received ---');
        console.log('File:', req.file?.originalname);
        console.log('MimeType:', req.file?.mimetype);

        if (!req.file) {
            console.warn('No file in request');
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const dataBuffer = req.file.buffer;
        let text = '';

        if (req.file.mimetype === 'application/pdf') {
            try {
                // Verified pdf-parse v1.1.1 exports the function directly
                const data = await pdf(dataBuffer);
                text = data.text;
            } catch (pdfError) {
                console.error('PDF Parse Error:', pdfError);
                // Fallback to text if possible or just log
            }
        } else {
            // Basic text extraction for non-pdf if needed
            text = dataBuffer.toString('utf-8');
        }

        console.log('Extracted Text Length:', text.length);

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Could not extract text from the file.' });
        }

        const prompt = `
            You are a professional HR assistant. Extract candidate information from the following resume text.
            If a field is not found, return an empty string.
            
            Format the output as a JSON object with these exact keys:
            - full_name
            - email
            - phone
            - current_position
            - current_company
            - experience_years (as a number or string like "5")
            - skills (as a comma-separated string)
            - education (as a string with each degree on a new line)
            - location
            - expected_salary (empty or number)
            - current_salary (empty or number)

            Resume text:
            ${text.substring(0, 12000)}
        `;

        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: "You are a helpful HR assistant. Output valid JSON." },
                { role: "user", content: prompt }
            ],
            model: "gpt-3.5-turbo-1106",
        });

        const content = completion.choices[0].message.content;
        console.log('OpenAI Response:', content.substring(0, 100)); // Log detailed response

        const parsedData = JSON.parse(content);

        console.log('Successfully Parsed Data with OpenAI');
        res.json({ success: true, data: parsedData });

    } catch (error) {
        console.error('Resume Parsing Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const uploadResumeHandler = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const url = `/uploads/resumes/${req.file.filename}`;
    res.json({ success: true, url: url, filename: req.file.filename });
};
