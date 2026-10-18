"""Textes fixes renvoyés par le code, jamais par le LLM."""

INSUFFICIENT_SOURCES = (
    "**Je ne peux pas répondre de manière sourcée.**\n\n"
    "Je n'ai trouvé, dans les textes fiscaux béninois de ma base documentaire, aucun passage "
    "suffisamment pertinent pour cette question. Plutôt que d'avancer une règle sans fondement, "
    "je préfère vous le signaler.\n\n"
    "Vous pouvez reformuler en précisant l'impôt concerné, l'opération ou la période."
)


def missing_texts(references: list[tuple[str, str]]) -> str:
    """Refus précis quand la question cite un texte qui n'est pas encore indexé."""
    cited = ", ".join(f"{kind} n°{number}" for kind, number in references)
    return (
        "**Ce texte n'est pas encore dans ma base documentaire.**\n\n"
        f"Je ne trouve pas le texte cité ({cited}) parmi les textes indexés : je ne peux donc pas répondre de manière "
        "sourcée à son sujet. La base est en cours d'enrichissement.\n\n"
        "Vous pouvez reformuler la question sans citer ce texte : je chercherai dans les autres sources."
    )
