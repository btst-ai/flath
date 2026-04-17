from modern_greek_inflexion import adjective

for w in ["καλός", "καλή", "καλό", "μεγάλος", "μεγάλους"]:
    try:
        forms = adjective.create_all_basic_forms(w)
        print(f"{w} forms: {forms}")
    except Exception as e:
        print(f"{w} forms failed: {e}")
