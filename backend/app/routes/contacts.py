from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, Request, Response

from backend.app.dependencies import (
    LimitsDep,
    ServicesDep,
    SettingsDep,
    as_api_error,
    client_hash,
    client_ip,
    require_admin,
)
from backend.app.ratelimit import RateLimited
from backend.app.schemas import ContactRequest, ErrorResponse
from backend.stores import ContactRecord

router = APIRouter(prefix="/api/v1", tags=["contacts"])


@router.post(
    "/contacts",
    status_code=204,
    summary="Laisser ses coordonnées (personnes intéressées par Julia)",
    responses={422: {"model": ErrorResponse}, 429: {"model": ErrorResponse}},
)
def create_contact(
    payload: ContactRequest, request: Request, services: ServicesDep, settings: SettingsDep, limits: LimitsDep
) -> Response:
    ip = client_ip(request)
    try:
        limits.check_ip(ip)
    except RateLimited as error:
        raise as_api_error(error) from None
    services.contacts.add(
        ContactRecord(
            full_name=payload.full_name,
            email=payload.email.lower(),
            phone=payload.phone,
            company=payload.company,
            position=payload.position,
        ),
        client_hash(settings, ip),
    )
    return Response(status_code=204)


@router.get(
    "/contacts",
    summary="Export CSV des contacts, réservé à l'équipe (X-Admin-Token)",
    dependencies=[Depends(require_admin)],
    responses={200: {"content": {"text/csv": {}}}, 401: {"model": ErrorResponse}},
)
def export_contacts(services: ServicesDep) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")  # « ; » : séparateur attendu par Excel en français
    writer.writerow(["date", "nom_complet", "email", "telephone", "entreprise", "poste"])
    for contact in services.contacts.list_all():
        writer.writerow([contact.created_at or "", contact.full_name, contact.email, contact.phone or "",
                         contact.company or "", contact.position or ""])
    return Response(
        "﻿" + buffer.getvalue(),  # BOM : accents corrects à l'ouverture dans Excel
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="contacts-julia.csv"'},
    )
