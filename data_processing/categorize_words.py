import json
import csv
import spacy
from collections import defaultdict

# Load the spaCy model
nlp = spacy.load("el_core_news_md")

# Define the themes and their seed words
THEMES = {
    "Cycling": ["ποδήλατο", "ποδηλασία"],
    "Sports": ["αθλητισμός", "σπορ", "αγώνας", "γυμναστήριο"],
    "Outdoors": ["φύση", "ύπαιθρος", "βουνό", "δάσος", "θάλασσα"],
    "Work/Digital": ["εργασία", "δουλειά", "υπολογιστής", "διαδίκτυο", "τεχνολογία", "γραφείο"],
    "Admin": ["γραφειοκρατία", "έγγραφο", "αίτηση", "διοίκηση", "δημόσιο"],
    "Money": ["χρήματα", "λεφτά", "οικονομία", "τράπεζα", "αγορά", "πληρωμή"],
    "Social": ["κοινωνία", "παρέα", "φίλος", "οικογένεια", "άνθρωπος", "σχέση"],
    "Geopolitics": ["γεωπολιτική", "έθνος", "χώρα", "σύνορα", "συμμαχία", "διεθνής"],
    "Politics": ["πολιτική", "κυβέρνηση", "εκλογές", "κόμμα", "υπουργός"],
    "Urban": ["πόλη", "αστικός", "δρόμος", "κτίριο", "πλατεία", "κέντρο"]
}

# Precompute doc objects for theme seeds to speed up similarity checks
theme_docs = {}
for theme, seeds in THEMES.items():
    theme_docs[theme] = nlp(" ".join(seeds))

def clean_word(word_str):
    # Clean the word from articles (ο, η, το, οι, τα) and aorist forms ( / ...)
    parts = word_str.split(" / ")[0].split()
    if len(parts) > 1 and parts[0] in ["ο", "η", "το", "οι", "τα"]:
        return parts[1]
    return parts[0]

def categorize(word_str):
    cleaned = clean_word(word_str)
    word_doc = nlp(cleaned)
    
    # If the word doesn't have a vector, default to General
    if not word_doc.has_vector or word_doc.vector_norm == 0:
        return "General"
    
    best_theme = "General"
    best_sim = 0.0
    
    for theme, t_doc in theme_docs.items():
        sim = word_doc.similarity(t_doc)
        if sim > best_sim:
            best_sim = sim
            best_theme = theme
            
    # Set a threshold for similarity to avoid false positives
    if best_sim > 0.45:
        return best_theme
    return "General"

def main():
    # 1. Load the JSON
    input_file = "greek-app/lib/top_10000_greek_words.json"
    output_file = "master_categorized_greek.csv"
    
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print(f"Loaded {len(data)} words.")
    
    categorized_data = defaultdict(list)
    
    # 2. Categorize each word
    for i, item in enumerate(data):
        rank = item["rank"]
        word_str = item["word"]
        
        theme = categorize(word_str)
        categorized_data[theme].append({
            "word": word_str,
            "rank": rank
        })
        
        if (i + 1) % 1000 == 0:
            print(f"Categorized {i + 1} words...")
            
    # 3. Sort within themes and assign levels
    final_rows = []
    
    # For consistent output ordering
    sorted_themes = list(THEMES.keys()) + ["General"]
    
    for theme in sorted_themes:
        if theme not in categorized_data:
            continue
            
        # Sort by rank (though they should already be in order, just to be safe)
        theme_items = sorted(categorized_data[theme], key=lambda x: x["rank"])
        
        for index, item in enumerate(theme_items):
            level = (index // 30) + 1
            final_rows.append({
                "Greek Word": item["word"],
                "Frequency Rank": item["rank"],
                "Theme": theme,
                "Level": level,
                "French Translation": "",
                "Part of Speech": ""
            })
            
    # 4. Write to CSV
    with open(output_file, "w", newline='', encoding="utf-8") as f:
        fieldnames = ["Greek Word", "Frequency Rank", "Theme", "Level", "French Translation", "Part of Speech"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        
        writer.writeheader()
        writer.writerows(final_rows)
        
    print(f"Successfully wrote {len(final_rows)} categorized words to {output_file}")

if __name__ == "__main__":
    main()
