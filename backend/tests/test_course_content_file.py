from __future__ import annotations

import pytest

from app.services import db
from tests.conftest import TEST_PUBLIC_URL, auth_header, register


@pytest.fixture()
def owner(client):
    return register(client)["access_token"]


def add_material(client, token: str, *, access_url: str, name: str = "notes.pdf") -> int:
    project = client.post("/projects", json={"name": "Files"}, headers=auth_header(token)).json()
    row = db.fetch_one(
        """
        INSERT INTO public.course_contents (material_name, access_url, data_size, project_id, source_type)
        VALUES (%s, %s, 3, %s, 'pdf')
        RETURNING id
        """,
        (name, access_url, project["id"]),
    )
    db.execute(
        "INSERT INTO public.project_materials (project_id, material_id) VALUES (%s, %s)",
        (project["id"], row["id"]),
    )
    return row["id"]


def test_returns_displayable_url_for_existing_pdf(client, owner, fake_storage):
    key = "course-contents/abc/notes.pdf"
    fake_storage.put_object(key=key, body=b"%PDF", content_type="application/pdf")
    material_id = add_material(client, owner, access_url=f"{TEST_PUBLIC_URL}/{key}")

    response = client.get(f"/course-contents/{material_id}/file", headers=auth_header(owner))

    assert response.status_code == 200, response.text
    assert response.json() == {
        "course_content_id": material_id,
        "material_name": "notes.pdf",
        "source_type": "pdf",
        "url": f"{TEST_PUBLIC_URL}/{key}",
        "content_type": "application/pdf",
        "size": 4,
    }


def test_legacy_supabase_url_is_served_from_current_storage(client, owner, fake_storage):
    key = "course-contents/old/notes.pdf"
    fake_storage.put_object(key=key, body=b"%PDF", content_type="application/pdf")
    legacy = f"https://oldref.supabase.co/storage/v1/object/public/course-contents/{key}"
    material_id = add_material(client, owner, access_url=legacy)

    response = client.get(f"/course-contents/{material_id}/file", headers=auth_header(owner))

    assert response.status_code == 200
    assert response.json()["url"] == f"{TEST_PUBLIC_URL}/{key}"


def test_missing_object_returns_404_with_clear_message(client, owner, fake_storage):
    material_id = add_material(client, owner, access_url=f"{TEST_PUBLIC_URL}/course-contents/gone/notes.pdf")

    response = client.get(f"/course-contents/{material_id}/file", headers=auth_header(owner))

    assert response.status_code == 404
    assert "missing from storage" in response.json()["detail"]


def test_url_outside_bucket_returns_422(client, owner, fake_storage):
    material_id = add_material(client, owner, access_url="https://elsewhere.example.com/notes.pdf")

    response = client.get(f"/course-contents/{material_id}/file", headers=auth_header(owner))

    assert response.status_code == 422
    assert "storage bucket" in response.json()["detail"]


def test_requires_owner(client, owner, fake_storage):
    key = "course-contents/abc/notes.pdf"
    fake_storage.put_object(key=key, body=b"%PDF", content_type="application/pdf")
    material_id = add_material(client, owner, access_url=f"{TEST_PUBLIC_URL}/{key}")
    intruder = register(client, email="other@example.com", username="other")["access_token"]

    assert client.get(f"/course-contents/{material_id}/file").status_code == 401
    assert client.get(f"/course-contents/{material_id}/file", headers=auth_header(intruder)).status_code == 404
