"""Per-ticker (aspect) sentiment for headlines that mention more than one ticker.

FinBERT scores the whole headline, so "X's Starlink poses risks to Apple" gets the same
score for both companies. A zero-shot NLI model asked "is this good/bad news for <name>"
scores each ticker separately.
"""
import torch

MODEL = "MoritzLaurer/deberta-v3-large-zeroshot-v2.0"
BATCH = 16


def aspect_score(pairs: list[tuple[str, str]]) -> list[dict]:
    """pairs: (headline, company name). Returns compound/pos/neu/neg per pair."""
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL).eval()
    entail = [i for i, l in model.config.id2label.items() if l == "entailment"][0]

    texts, hyps = [], []
    for title, name in pairs:
        for h in (f"This is good news for {name}.", f"This is bad news for {name}."):
            texts.append(title)
            hyps.append(h)

    probs = []
    for i in range(0, len(texts), BATCH):
        enc = tok(texts[i:i + BATCH], hyps[i:i + BATCH], return_tensors="pt", padding=True, truncation=True)
        with torch.no_grad():
            probs += model(**enc).logits.softmax(-1)[:, entail].tolist()

    out = []
    for good, bad in zip(probs[0::2], probs[1::2]):
        out.append({"compound": good - bad, "pos": good, "neg": bad, "neu": max(0.0, 1 - good - bad)})
    return out
