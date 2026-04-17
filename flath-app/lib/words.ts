import fs from 'fs';
import path from 'path';

interface WordFrequency {
    rank: number;
    word: string;
}

let frequencyData: Record<string, number> | null = null;

function loadFrequencyData() {
    if (frequencyData) return frequencyData;
    
    try {
        const filePath = path.join(process.cwd(), 'lib', 'top_10000_greek_words.json');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const parsed: WordFrequency[] = JSON.parse(fileContent);
        
        frequencyData = {};
        for (const item of parsed) {
            // Some words in the list might have slashes like "είμαι / ήμουν"
            // We'll normalize by taking the first part or keeping it as is.
            const cleanWord = item.word.trim();
            frequencyData[cleanWord] = item.rank;
        }
    } catch (error) {
        console.error('Failed to load Greek words frequency data:', error);
        frequencyData = {};
    }
    
    return frequencyData;
}

export function getFrequencyRank(greekText: string): number {
    const data = loadFrequencyData();
    const cleanText = greekText.trim();
    
    if (data[cleanText] !== undefined) {
        return data[cleanText];
    }
    
    // Fallback: check if the first word exists
    const firstWord = cleanText.split(' ')[0];
    if (firstWord && data[firstWord] !== undefined) {
        return data[firstWord];
    }
    
    return -1; // Default if not found
}
