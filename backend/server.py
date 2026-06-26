from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import uuid
import resend
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend config
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '')
ACCESS_PIN = os.environ.get('ACCESS_PIN', '4060')

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ===== Models =====

class ChecklistItem(BaseModel):
    key: str
    label: str
    result: str  # "pass" | "fail" | "na"


class InspectionCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    site: str
    scaffold_id: str
    inspector: str
    email: str
    date: str  # YYYY-MM-DD
    status: str  # "green" | "red"
    notes: Optional[str] = ""
    checklist: List[ChecklistItem] = []
    signature: Optional[str] = ""  # base64 data url
    photo: Optional[str] = ""  # base64 data url


class Inspection(InspectionCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    email_sent: bool = False


class PinVerifyRequest(BaseModel):
    pin: str


class HandoverCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    contractor: str
    client_name: str
    client_email: str
    site: str
    description: str
    drawing_no: Optional[str] = ""
    quotation_no: Optional[str] = ""
    quotation_date: Optional[str] = ""
    use_only_for: str
    ties_tested: str  # "yes" | "no" | "na"
    working_lifts: str
    distributed_load: str
    load_unit: str  # "kN/m2" | "lbs/ft2"
    sheeting_designed: str  # "has" | "has_not"
    contractor_name: str
    contractor_position: str
    contractor_signature: Optional[str] = ""
    handover_date: str
    handover_time: str
    received_by_name: Optional[str] = ""
    received_by_position: Optional[str] = ""
    received_by_signature: Optional[str] = ""
    notes: Optional[str] = ""


class Handover(HandoverCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    certificate_no: str = Field(default_factory=lambda: f"HO-{uuid.uuid4().hex[:6].upper()}")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    email_sent: bool = False


# ===== Helpers =====

def build_email_html(insp: Inspection) -> str:
    status_color = "#10B981" if insp.status == "green" else "#EF4444"
    status_text = "GREEN TAG — Safe to Use" if insp.status == "green" else "RED TAG — Do Not Use"

    rows = ""
    for item in insp.checklist:
        result = item.result.upper()
        color = {"PASS": "#10B981", "FAIL": "#EF4444", "NA": "#64748B"}.get(result, "#64748B")
        rows += (
            f'<tr><td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:14px;color:#27272a;">{item.label}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #e4e4e7;font-size:12px;color:{color};font-weight:700;text-align:right;">{result}</td></tr>'
        )

    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;padding:24px;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;">
          <tr><td style="background:#09090b;color:#ffffff;padding:24px 28px;">
            <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#a1a1aa;">Scaffold Safety Inspection</div>
            <div style="font-size:28px;font-weight:900;letter-spacing:-0.5px;margin-top:4px;">Inspection Report</div>
          </td></tr>
          <tr><td style="padding:24px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;padding-bottom:4px;">Final Status</td></tr>
              <tr><td style="background:{status_color};color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.5px;padding:14px 16px;text-transform:uppercase;">{status_text}</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #e4e4e7;">
              <tr>
                <td style="padding:12px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;width:140px;">Site</td>
                <td style="padding:12px 0;font-size:14px;color:#09090b;font-weight:600;">{insp.site}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Scaffold ID</td>
                <td style="padding:12px 0;font-size:14px;color:#09090b;font-weight:600;border-top:1px solid #e4e4e7;">{insp.scaffold_id}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Inspector</td>
                <td style="padding:12px 0;font-size:14px;color:#09090b;font-weight:600;border-top:1px solid #e4e4e7;">{insp.inspector}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Date</td>
                <td style="padding:12px 0;font-size:14px;color:#09090b;font-weight:600;border-top:1px solid #e4e4e7;">{insp.date}</td>
              </tr>
            </table>

            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;margin-top:24px;margin-bottom:8px;">Safety Checklist</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;">
              {rows or '<tr><td style="padding:12px;color:#71717a;font-size:13px;">No checklist items submitted.</td></tr>'}
            </table>

            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;margin-top:24px;margin-bottom:8px;">Notes</div>
            <div style="font-size:14px;color:#27272a;line-height:1.5;border-left:3px solid #EA580C;padding:8px 14px;background:#fafafa;">
              {(insp.notes or 'No notes provided.').replace(chr(10), '<br>')}
            </div>
          </td></tr>
          <tr><td style="background:#fafafa;padding:16px 28px;font-size:11px;color:#71717a;letter-spacing:1px;text-transform:uppercase;border-top:1px solid #e4e4e7;">
            Submitted {insp.created_at[:19].replace('T', ' ')} UTC · Tag Scaffolding
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


async def send_inspection_email(insp: Inspection) -> bool:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set; skipping email send.")
        return False

    recipients = []
    if insp.email:
        recipients.append(insp.email)
    if ADMIN_EMAIL and ADMIN_EMAIL not in recipients:
        recipients.append(ADMIN_EMAIL)

    if not recipients:
        return False

    subject = f"[{insp.status.upper()} TAG] {insp.site} · {insp.scaffold_id} · {insp.date}"
    html = build_email_html(insp)

    params = {
        "from": SENDER_EMAIL,
        "to": recipients,
        "subject": subject,
        "html": html,
    }

    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Inspection email sent: {result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send inspection email: {e}")
        return False


# ===== Routes =====

@api_router.get("/")
async def root():
    return {"message": "Scaffold Safety Inspection API"}


@api_router.post("/auth/verify-pin")
async def verify_pin(req: PinVerifyRequest):
    if req.pin == ACCESS_PIN:
        return {"ok": True}
    raise HTTPException(status_code=401, detail="Invalid passcode")


@api_router.post("/inspections", response_model=Inspection)
async def create_inspection(payload: InspectionCreate):
    insp = Inspection(**payload.model_dump())
    doc = insp.model_dump()
    await db.inspections.insert_one(doc)

    # Send email in background-safe manner (await but resilient)
    email_ok = await send_inspection_email(insp)
    if email_ok:
        await db.inspections.update_one({"id": insp.id}, {"$set": {"email_sent": True}})
        insp.email_sent = True

    return insp


@api_router.get("/inspections", response_model=List[Inspection])
async def list_inspections(site: Optional[str] = None):
    query = {"site": site} if site else {}
    docs = await db.inspections.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Inspection(**d) for d in docs]


@api_router.delete("/inspections/{inspection_id}")
async def delete_inspection(inspection_id: str):
    result = await db.inspections.delete_one({"id": inspection_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return {"ok": True, "deleted": inspection_id}


@api_router.get("/sites")
async def list_sites():
    return {
        "sites": [
            "Unilever", "Baker baker", "Erl", "Chane", "Howdens",
            "Iko", "Byk", "Cp", "Um Regent"
        ],
        "inspectors": ["Luke Arnold", "Jeff Arnold", "Jon McHale", "Josh McHale"],
    }


# ===== Handover =====

def build_handover_email_html(h: Handover) -> str:
    ties_label = {"yes": "YES", "no": "NO", "na": "N/A"}.get(h.ties_tested, "N/A")
    sheeting_label = "HAS been designed to take sheeting/debris netting" if h.sheeting_designed == "has" else "HAS NOT been designed to take sheeting/debris netting"
    received_block = ""
    if h.received_by_name:
        received_block = f"""
        <tr><td style="padding:12px 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Received By</td>
            <td style="padding:12px 0;font-size:14px;color:#09090b;font-weight:600;border-top:1px solid #e4e4e7;">{h.received_by_name} · {h.received_by_position or ''}</td>
        </tr>"""
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;padding:24px;">
      <tr><td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #09090b;">
          <tr><td style="background:#09090b;color:#ffffff;padding:24px 28px;">
            <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#a1a1aa;">Scaffolding Handing-Over Certificate</div>
            <div style="font-size:28px;font-weight:900;letter-spacing:-0.5px;margin-top:4px;">Handover · {h.certificate_no}</div>
          </td></tr>

          <tr><td style="padding:24px 28px;">
            <div style="background:#EA580C;color:#fff;padding:14px 16px;font-size:13px;line-height:1.5;font-weight:600;">
              Scaffolding as described below has now been completed and complies with the Work at Height Regulations, 2005. It is structurally sound and should only be used in accordance with the agreed specification.
            </div>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #e4e4e7;">
              <tr><td style="padding:12px 14px;background:#fafafa;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;width:200px;">Contractor</td>
                  <td style="padding:12px 14px;background:#fafafa;font-size:14px;color:#09090b;font-weight:700;">{h.contractor}</td></tr>
              <tr><td style="padding:12px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Client</td>
                  <td style="padding:12px 14px;font-size:14px;color:#09090b;font-weight:700;border-top:1px solid #e4e4e7;">{h.client_name}</td></tr>
              <tr><td style="padding:12px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Site</td>
                  <td style="padding:12px 14px;font-size:14px;color:#09090b;font-weight:700;border-top:1px solid #e4e4e7;">{h.site}</td></tr>
              <tr><td style="padding:12px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Section Handed Over</td>
                  <td style="padding:12px 14px;font-size:14px;color:#09090b;font-weight:500;border-top:1px solid #e4e4e7;line-height:1.5;">{(h.description or '').replace(chr(10),'<br>')}</td></tr>
              <tr><td style="padding:12px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Drawing No.</td>
                  <td style="padding:12px 14px;font-size:14px;color:#09090b;font-weight:500;border-top:1px solid #e4e4e7;">{h.drawing_no or '—'}</td></tr>
              <tr><td style="padding:12px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Quotation No. · Date</td>
                  <td style="padding:12px 14px;font-size:14px;color:#09090b;font-weight:500;border-top:1px solid #e4e4e7;">{h.quotation_no or '—'} · {h.quotation_date or '—'}</td></tr>
            </table>

            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;margin-top:24px;margin-bottom:8px;">Use & Loading</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;">
              <tr><td style="padding:12px 14px;background:#fafafa;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;width:200px;">Use Only For</td>
                  <td style="padding:12px 14px;background:#fafafa;font-size:14px;color:#09090b;font-weight:600;">{h.use_only_for}</td></tr>
              <tr><td style="padding:12px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Ties Tested</td>
                  <td style="padding:12px 14px;font-size:14px;color:#09090b;font-weight:700;border-top:1px solid #e4e4e7;">{ties_label}</td></tr>
              <tr><td style="padding:12px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Loading</td>
                  <td style="padding:12px 14px;font-size:14px;color:#09090b;font-weight:600;border-top:1px solid #e4e4e7;">{h.working_lifts} working lift(s) · {h.distributed_load} {h.load_unit} per lift</td></tr>
              <tr><td style="padding:12px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Sheeting / Debris Netting</td>
                  <td style="padding:12px 14px;font-size:14px;color:#09090b;font-weight:600;border-top:1px solid #e4e4e7;">{sheeting_label}</td></tr>
            </table>

            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;margin-top:24px;margin-bottom:8px;">Sign-off</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;">
              <tr><td style="padding:12px 14px;background:#fafafa;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;width:200px;">Scaffolding Contractor</td>
                  <td style="padding:12px 14px;background:#fafafa;font-size:14px;color:#09090b;font-weight:700;">{h.contractor_name} · {h.contractor_position}</td></tr>
              <tr><td style="padding:12px 14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;border-top:1px solid #e4e4e7;">Date · Time</td>
                  <td style="padding:12px 14px;font-size:14px;color:#09090b;font-weight:600;border-top:1px solid #e4e4e7;">{h.handover_date} · {h.handover_time}</td></tr>
              {received_block}
            </table>

            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;margin-top:24px;margin-bottom:8px;">Regulatory Notice</div>
            <div style="font-size:12px;color:#52525B;line-height:1.6;border-left:3px solid #09090b;padding:8px 14px;background:#fafafa;">
              In order to comply with the Work at Height Regulations 2005, this scaffold must be inspected before being taken into use for the first time, at regular intervals not exceeding 7 days since the last inspection, after any event likely to have affected its strength or stability, and after any substantial addition, dismantling or other alteration.
            </div>

            { f'<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#71717a;margin-top:20px;margin-bottom:6px;">Notes</div><div style="font-size:13px;color:#27272a;line-height:1.5;">{(h.notes or "").replace(chr(10), "<br>")}</div>' if h.notes else "" }
          </td></tr>

          <tr><td style="background:#fafafa;padding:16px 28px;font-size:11px;color:#71717a;letter-spacing:1px;text-transform:uppercase;border-top:1px solid #e4e4e7;">
            Issued {h.created_at[:19].replace('T', ' ')} UTC · Tag Scaffolding · Certificate {h.certificate_no}
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


async def send_handover_email(h: Handover) -> bool:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set; skipping handover email send.")
        return False
    recipients = []
    if h.client_email:
        recipients.append(h.client_email)
    if ADMIN_EMAIL and ADMIN_EMAIL not in recipients:
        recipients.append(ADMIN_EMAIL)
    if not recipients:
        return False

    subject = f"[HANDOVER · {h.certificate_no}] {h.site} · {h.contractor}"
    params = {
        "from": SENDER_EMAIL,
        "to": recipients,
        "subject": subject,
        "html": build_handover_email_html(h),
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Handover email sent: {result.get('id')}")
        return True
    except Exception as e:
        logger.error(f"Failed to send handover email: {e}")
        return False


@api_router.post("/handovers", response_model=Handover)
async def create_handover(payload: HandoverCreate):
    h = Handover(**payload.model_dump())
    await db.handovers.insert_one(h.model_dump())
    email_ok = await send_handover_email(h)
    if email_ok:
        await db.handovers.update_one({"id": h.id}, {"$set": {"email_sent": True}})
        h.email_sent = True
    return h


@api_router.get("/handovers", response_model=List[Handover])
async def list_handovers(site: Optional[str] = None):
    query = {"site": site} if site else {}
    docs = await db.handovers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Handover(**d) for d in docs]


@api_router.delete("/handovers/{handover_id}")
async def delete_handover(handover_id: str):
    result = await db.handovers.delete_one({"id": handover_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Handover not found")
    return {"ok": True, "deleted": handover_id}


# Mount router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
