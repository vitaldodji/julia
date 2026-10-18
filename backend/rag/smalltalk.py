"""Messages qui ne sont pas des questions juridiques : salutations, remerciements, « qui es-tu ? ».

Ils reçoivent une réponse fixe, sans recherche ni appel au LLM. Une vraie question précédée d'une
salutation (« Bonjour, quel est le taux de la TVA ? ») suit le parcours normal.
"""

from __future__ import annotations

import re
import unicodedata

PRESENTATION = (
    "Je suis **Julia**, assistante de recherche en fiscalité béninoise. Je réponds uniquement à partir "
    "des textes de ma base documentaire (Code général des impôts, arrêtés, circulaires et procédures de "
    "la DGI), en citant mes sources.\n\n"
    "Posez-moi une question précise, par exemple :\n\n"
    "- Quel est le taux de la TVA ?\n"
    "- Quel est le délai pour présenter une réclamation contentieuse ?\n"
    "- Qui doit délivrer une facture normalisée ?"
)
GREETING_REPLY = f"Bonjour !\n\n{PRESENTATION}"
THANKS_REPLY = "Avec plaisir. Vous pouvez poser une autre question sur la fiscalité béninoise."

_GREETINGS = {"bonjour", "bonsoir", "salut", "hello", "coucou", "hi", "bjr", "slt", "allo", "hey"}
_POLITE_TAILS = {
    "", "julia", "a vous", "a toi", "tout le monde", "comment allez vous", "comment vas tu", "ca va",
    "comment ca va",
}
_THANKS = re.compile(r"^(ok |d accord |super |parfait |tres bien )?(merci|thanks)( beaucoup| bien| julia)*$")
_ABOUT = re.compile(
    r"^(qui es tu|tu es qui|qui etes vous|vous etes qui|que peux tu faire|que sais tu faire|"
    r"que pouvez vous faire|a quoi sers tu|a quoi servez vous|comment ca marche|aide|help|"
    r"presente toi|presentez vous)( julia)?$"
)


def normalize(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text.lower())
    folded = "".join(char for char in folded if not unicodedata.combining(char))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", folded).split())


def small_talk_reply(question: str) -> str | None:
    """Réponse fixe si le message n'est pas une question juridique, sinon None."""
    text = normalize(question)
    if not text:
        return None
    first, _, rest = text.partition(" ")
    if first in _GREETINGS and rest in _POLITE_TAILS:
        return GREETING_REPLY
    if _THANKS.match(text):
        return THANKS_REPLY
    if _ABOUT.match(text):
        return PRESENTATION
    return None
