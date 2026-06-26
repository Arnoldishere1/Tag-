"""Backend tests for Scaffold Safety Inspection API."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://safety-tag-system-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ===== PIN verification =====
class TestPin:
    def test_verify_pin_correct(self, session):
        r = session.post(f"{API}/auth/verify-pin", json={"pin": "4060"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True

    def test_verify_pin_wrong(self, session):
        r = session.post(f"{API}/auth/verify-pin", json={"pin": "0000"})
        assert r.status_code == 401


# ===== Sites endpoint =====
class TestSites:
    def test_sites_list(self, session):
        r = session.get(f"{API}/sites")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("sites"), list)
        assert len(data["sites"]) == 9
        assert "Unilever" in data["sites"]
        assert "Um Regent" in data["sites"]
        assert isinstance(data.get("inspectors"), list)
        assert len(data["inspectors"]) == 4
        assert "Luke Arnold" in data["inspectors"]


# ===== Inspections CRUD =====
class TestInspections:
    created_ids = []

    def _payload(self, site="Unilever", scaffold="TEST_SCAFF-1"):
        return {
            "site": site,
            "scaffold_id": scaffold,
            "inspector": "Luke Arnold",
            "email": "test@example.com",
            "date": "2026-01-15",
            "status": "green",
            "notes": "All clear",
            "checklist": [
                {"key": "item1", "label": "Base plates and mudsills stable and level", "result": "pass"},
                {"key": "item2", "label": "All planks tightly abutted, no cracks", "result": "pass"},
                {"key": "item3", "label": "Guardrails and mid-rails secure", "result": "pass"},
                {"key": "item4", "label": "Structure tied / braced to building", "result": "na"},
                {"key": "item5", "label": "Ladder / stairway access clear and secure", "result": "pass"},
            ],
            "signature": "data:image/png;base64,iVBORw0KGgo=",
            "photo": "",
        }

    def test_create_inspection(self, session):
        payload = self._payload()
        r = session.post(f"{API}/inspections", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["site"] == "Unilever"
        assert data["scaffold_id"] == "TEST_SCAFF-1"
        assert data["status"] == "green"
        assert "id" in data and len(data["id"]) > 0
        assert "created_at" in data
        # RESEND_API_KEY empty -> email_sent should be False
        assert data["email_sent"] is False
        TestInspections.created_ids.append(data["id"])

    def test_create_inspection_second(self, session):
        payload = self._payload(site="Howdens", scaffold="TEST_SCAFF-2")
        r = session.post(f"{API}/inspections", json=payload)
        assert r.status_code == 200
        TestInspections.created_ids.append(r.json()["id"])

    def test_list_inspections_sorted(self, session):
        r = session.get(f"{API}/inspections")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 2
        # sorted desc by created_at
        for i in range(len(data) - 1):
            assert data[i]["created_at"] >= data[i + 1]["created_at"]

    def test_list_inspections_filter_by_site(self, session):
        r = session.get(f"{API}/inspections", params={"site": "Unilever"})
        assert r.status_code == 200
        data = r.json()
        assert all(d["site"] == "Unilever" for d in data)
        assert any(d["scaffold_id"] == "TEST_SCAFF-1" for d in data)

    def test_persistence_via_get(self, session):
        # Verify our created record persisted
        r = session.get(f"{API}/inspections", params={"site": "Howdens"})
        assert r.status_code == 200
        ids = [d["id"] for d in r.json()]
        assert TestInspections.created_ids[1] in ids

    def test_delete_inspection(self, session):
        if not TestInspections.created_ids:
            pytest.skip("No created inspections")
        target = TestInspections.created_ids[0]
        r = session.delete(f"{API}/inspections/{target}")
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        # verify gone
        r2 = session.get(f"{API}/inspections", params={"site": "Unilever"})
        ids = [d["id"] for d in r2.json()]
        assert target not in ids

    def test_delete_unknown_returns_404(self, session):
        r = session.delete(f"{API}/inspections/nonexistent-id-xyz")
        assert r.status_code == 404

    def test_cleanup(self, session):
        # Delete remaining test records
        for tid in TestInspections.created_ids[1:]:
            session.delete(f"{API}/inspections/{tid}")
