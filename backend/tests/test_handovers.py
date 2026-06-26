"""Backend tests for Handover Certificate API."""
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


def _payload(site="Unilever", client="Acme Builders"):
    return {
        "contractor": "Tag Scaffolding",
        "client_name": client,
        "client_email": "client@acme.com",
        "site": site,
        "description": "North elevation, lifts 1-3",
        "drawing_no": "DRW-001",
        "quotation_no": "Q-2026-01",
        "quotation_date": "2026-01-10",
        "use_only_for": "Bricklaying",
        "ties_tested": "yes",
        "working_lifts": "3",
        "distributed_load": "1.5",
        "load_unit": "kN/m2",
        "sheeting_designed": "has",
        "contractor_name": "Luke Arnold",
        "contractor_position": "Supervisor",
        "handover_date": "2026-01-20",
        "handover_time": "10:30",
        "notes": "TEST_handover",
    }


class TestHandovers:
    created_ids = []

    def test_create_handover(self, session):
        r = session.post(f"{API}/handovers", json=_payload())
        assert r.status_code == 200, r.text
        data = r.json()
        # Required identifiers
        assert "id" in data and len(data["id"]) > 0
        assert "certificate_no" in data
        assert data["certificate_no"].startswith("HO-")
        assert len(data["certificate_no"]) == 9  # HO- + 6 hex chars
        assert "created_at" in data
        # RESEND_API_KEY empty -> graceful soft-fail
        assert data["email_sent"] is False
        # Field echoes
        assert data["client_name"] == "Acme Builders"
        assert data["site"] == "Unilever"
        assert data["ties_tested"] == "yes"
        assert data["load_unit"] == "kN/m2"
        assert data["sheeting_designed"] == "has"
        TestHandovers.created_ids.append(data["id"])

    def test_create_handover_second_site(self, session):
        p = _payload(site="Howdens", client="TEST_HowdensCo")
        r = session.post(f"{API}/handovers", json=p)
        assert r.status_code == 200
        TestHandovers.created_ids.append(r.json()["id"])

    def test_list_handovers_sorted_desc(self, session):
        r = session.get(f"{API}/handovers")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 2
        for i in range(len(data) - 1):
            assert data[i]["created_at"] >= data[i + 1]["created_at"]

    def test_list_handovers_filter_by_site(self, session):
        r = session.get(f"{API}/handovers", params={"site": "Howdens"})
        assert r.status_code == 200
        data = r.json()
        assert all(d["site"] == "Howdens" for d in data)
        assert any(d["client_name"] == "TEST_HowdensCo" for d in data)

    def test_persistence_via_get(self, session):
        r = session.get(f"{API}/handovers")
        ids = [d["id"] for d in r.json()]
        for cid in TestHandovers.created_ids:
            assert cid in ids

    def test_delete_handover(self, session):
        target = TestHandovers.created_ids[0]
        r = session.delete(f"{API}/handovers/{target}")
        assert r.status_code == 200
        assert r.json().get("ok") is True
        r2 = session.get(f"{API}/handovers")
        assert target not in [d["id"] for d in r2.json()]

    def test_delete_unknown_returns_404(self, session):
        r = session.delete(f"{API}/handovers/nonexistent-id-xyz")
        assert r.status_code == 404

    def test_email_soft_fail_no_crash(self, session):
        # Submitting handover with client_email should not crash even though RESEND_API_KEY is empty
        p = _payload(client="TEST_NoCrash")
        r = session.post(f"{API}/handovers", json=p)
        assert r.status_code == 200
        data = r.json()
        assert data["email_sent"] is False
        TestHandovers.created_ids.append(data["id"])

    def test_cleanup(self, session):
        for cid in TestHandovers.created_ids[1:]:
            session.delete(f"{API}/handovers/{cid}")
