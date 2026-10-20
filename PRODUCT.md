# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Node.js (Express + Socket.io), MySQL (`mysql2/promise`), MSSQL (`mssql` for hospital PM staff directory integration), Vanilla HTML/CSS/JS frontend, deployed on Windows Server via IIS + `iisnode`.

## Users

1. **Hospital Staff (Requester / ผู้ขอข้อมูล):** Nurses, doctors, pharmacists, medical technologists, and administrative staff across departments (OPD, IPD, ER, Pharmacy, Lab, etc.) who need hospital data queried from the HIS (HOMC / hospital databases) for PCT tracking, policy meetings, routine work, research/academic promotion, or external government agency requests.
2. **IT / Computer Center Staff (ผู้จัดทำรายงาน / ศูนย์คอมพิวเตอร์):** Data/IT specialists who receive data requests, clarify query conditions with the requester, run SQL queries against hospital databases, compile results into Excel, send via email/chat, and log progress (`Status`, `Owner`, `Start Date`, `Date Completed`, `% Complete`) for departmental tracking and audit logs.

## Product Purpose

BRH Data Request & Staff Messenger (ระบบขอรายงานข้อมูลและสื่อสารภายในโรงพยาบาล) streamlines the hospital's data/report request workflow while preserving real-time direct messaging and IT support ticketing. Success means hospital staff can submit structured data/report requests with clear purpose, frequency, urgency, and due dates, while IT staff can claim ownership, track query progress (`% Complete`), communicate directly via built-in real-time chat when query requirements need clarification, and maintain a complete audit log of completed reports.

## Positioning

Unlike standalone SharePoint forms that isolate requests from communication, or generic chat apps that lose structured request metadata, BRH integrates structured hospital data-query request forms and IT audit logging directly with real-time staff messaging and hospital database authentication.

## Operating Context

- Used daily inside a Thai hospital intranet (LAN) on desktop workstations.
- Replaces a legacy SharePoint list form for requesting hospital data queries ("ขอข้อมูล/ขอรายงาน").
- Staff authenticate against hospital credentials / MySQL database.
- IT specialists query hospital databases (e.g., HOMC, PACS, LIS, SQL) and deliver Excel reports via email or direct file attachment, recording start dates, completion dates, and completion percentages.

## Capabilities and Constraints

- **Primary Workspace — Data / Report Request System (ระบบขอข้อมูลและรายงาน):**
  - **Requester Fields:** ผู้ขอข้อมูล (Requester Name), ตำแหน่ง (Position), ชื่องาน / หัวข้อรายงาน (Report Title, e.g., "ยอดผู้ป่วยในปีงบ 59"), กลุ่มงาน/ฝ่าย/ศูนย์ (Department), โทรติดต่อ (Phone/Ext), มีความประสงค์ขอข้อมูลเพื่อ (Purpose checkboxes: ติดตามงาน PCT/นโยบาย, ประชุม วันที่, งานประจำ, วิจัย/เลื่อนระดับ, หน่วยราชการอื่นขอ, อื่นๆ ระบุ), ความถี่ของการใช้ข้อมูล (Frequency select + custom specification), รายละเอียดที่ต้องการ (Detailed query requirements), รายละเอียดช่องทางรับข้อมูล (Delivery channel: รหัสรายงาน, ระบบ, e-mail, อื่นๆ), กำหนดรับข้อมูล (Due Date), ความเร่งด่วน (Urgency: ปกติ ภายใน 10 วัน / ด่วน), เหตุผลในการขอด่วน (Urgent reason).
  - **IT Center Management & Log Fields (เฉพาะเจ้าหน้าที่ศูนย์คอม):** Status (ยังไม่ดำเนินการ, กำลังดำเนินการ, รอข้อมูลเพิ่มเติม, เสร็จสิ้น, ยกเลิก), Owner (ผู้รับผิดชอบ), Start Date (วันที่เริ่มดำเนินการ), Date Completed (วันที่เสร็จสิ้น), `% Complete` (0–100%), and Resolution/Delivery Note.
  - **Log & Export:** Filterable ledger of all requests and completed work logs by owner, status, department, and date, with CSV/Excel export for IT reporting.
- **Preserved Workspace — Real-time Chat & IT Support Board:**
  - Direct 1-on-1 real-time messaging (text, images, video, Excel/document attachments, voice recording), online status, read receipts, quick templates, and IT specialties matching must remain completely functional.
  - One-click contextual chat from any Report Request to message the requester or assigned IT owner directly.

## Brand Commitments

- **Name:** BRH Data & Chat (ศูนย์ข้อมูลและระบบสื่อสารภายในโรงพยาบาล)
- **Language:** Thai primary interface (`th`), with clear operational terminology matching hospital workflows.

## Product Principles

1. **Operational Clarity First:** Every request's status, urgency, due date, and assigned IT owner must be scannable at a glance in a dense, high-craft operational ledger.
2. **Structured Form, Instant Conversation:** Submitting a formal data request and asking a quick follow-up question via chat should feel like two sides of one seamless workflow.
3. **Zero Lost Work:** All existing chat, file sharing, voice messaging, and IT board capabilities remain intact and accessible without friction.
