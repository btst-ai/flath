import spacy
import re
import json
import traceback
from modern_greek_inflexion import verb, noun, adjective

nlp = spacy.load('el_core_news_md')
greek_pattern = re.compile(r'^[α-ωΑ-ΩάέήίόύώΆΈΉΊΌΎΏϊϋΐΰ]+$')

def get_verb_entry(lemma):
    try:
        forms = verb.create_all_basic_forms(lemma)
        if not forms or 'present' not in forms:
            return None
        
        aorist_forms = forms.get('aorist', {})
        aorist = ""
        if 'active' in aorist_forms and aorist_forms['active']:
            aorist = list(aorist_forms['active'])[0]
        elif 'passive' in aorist_forms and aorist_forms['passive']:
            aorist = list(aorist_forms['passive'])[0]
        
        if not aorist:
            paratatikos_forms = forms.get('paratatikos', {})
            if 'active' in paratatikos_forms and paratatikos_forms['active']:
                aorist = list(paratatikos_forms['active'])[0]
            elif 'passive' in paratatikos_forms and paratatikos_forms['passive']:
                aorist = list(paratatikos_forms['passive'])[0]
                
        if aorist:
            return f"{lemma} / {aorist}"
        else:
            return lemma
    except Exception:
        return None

def get_noun_entry(lemma):
    try:
        forms = noun.create_all_basic_forms(lemma)
        if not forms or forms.get('nom_sg') != lemma:
            # Maybe it's a plural-only noun? e.g. "ΗΠΑ", "μαθηματικά"
            if forms and forms.get('nom_pl') == lemma and not forms.get('nom_sg'):
                genders = forms.get('genders', [])
                if 'masc' in genders: return f"οι {lemma}"
                elif 'fem' in genders: return f"οι {lemma}"
                elif 'neut' in genders: return f"τα {lemma}"
            return None
        
        genders = forms.get('genders', [])
        if 'masc' in genders: return f"ο {lemma}"
        elif 'fem' in genders: return f"η {lemma}"
        elif 'neut' in genders: return f"το {lemma}"
        else:
            # guess
            if lemma.endswith('ος'): return f"ο {lemma}"
            elif lemma.endswith('η') or lemma.endswith('α'): return f"η {lemma}"
            else: return f"το {lemma}"
    except Exception:
        return None

def get_adj_entry(lemma):
    try:
        forms = adjective.create_all_basic_forms(lemma)
        if not forms or 'adj' not in forms:
            return None
        adj_str = forms['adj']
        masc = adj_str.split('/')[0]
        # Only return if it's the masculine form
        return masc
    except Exception:
        return None

def generate():
    seen_lemmas = set()
    top_words = []
    
    with open('el_50k.txt', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for i, line in enumerate(lines):
        parts = line.strip().split()
        if not parts:
            continue
        word = parts[0]
        
        if not greek_pattern.match(word) or len(word) < 2:
            if word not in ['ο', 'η', 'ή', 'ω', 'ά', 'έ']:
                continue
                
        doc = nlp(word)
        if len(doc) == 0:
            continue
        token = doc[0]
        
        lemma = token.lemma_.lower()
        if lemma in seen_lemmas or " " in lemma:
            continue
            
        pos = token.pos_
        if pos in ['PUNCT', 'NUM', 'X', 'SPACE', 'SYM']:
            continue
            
        entry = None
        if pos == 'VERB' or pos == 'AUX':
            entry = get_verb_entry(lemma)
            # if get_verb_entry failed, maybe the lemma was wrong, skip this word
        elif pos == 'NOUN' or pos == 'PROPN':
            entry = get_noun_entry(lemma)
        elif pos == 'ADJ':
            entry = get_adj_entry(lemma)
        else:
            entry = lemma
            
        if entry:
            # Use the entry's base word (which might be corrected by the inflector) for tracking
            base_word = entry.split(' / ')[0].split(' ')[-1] if pos in ['VERB', 'AUX', 'NOUN', 'PROPN'] else entry
            if base_word in seen_lemmas:
                continue
                
            seen_lemmas.add(lemma)
            seen_lemmas.add(base_word)
            top_words.append({
                "rank": len(top_words) + 1,
                "word": entry
            })
            
            if len(top_words) >= 10000:
                break
                
        if i % 5000 == 0:
            print(f"Processed {i} words, collected {len(top_words)} lemmas.")
            
    print(f"Finished. Collected {len(top_words)} top words.")
    
    with open('top_10000_greek_words.json', 'w', encoding='utf-8') as f:
        json.dump(top_words, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    generate()
