from backend.app.routes import answers, contacts, documents, feedback, health, search

ROUTERS = [answers.router, search.router, documents.router, feedback.router, contacts.router, health.router]
