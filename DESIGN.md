# Design System — BRH Data & Chat

<!-- impeccable:design-schema 1 -->

## Aesthetic Direction & World

- **Form:** Gridded Hospital Data Specification Ledger (inspired by Wim Crouwel's visible construction grid and hospital architectural specification sheets).
- **Mode:** Operate (High-density hospital intranet data-query request queue, IT execution console, and real-time staff communication).
- **Physical Scene:** Daytime clinical & administrative hospital workstations across OPD, IPD, Pharmacy, and the Computer Center (ศูนย์คอมพิวเตอร์) under bright fluorescent office light.

## Color & Atmospheric Polarity

- **Surface Polarity:** High-craft Warm Clinical Alabaster Paper (`#F7F6F2`) paired with crisp white specification sheets (`#FFFFFF`) and exposed 1px slate hairlines (`#DCD9D0` / `#C4C0B5`).
- **Ink Hierarchy:**
  - `--ink-900`: `#111827` (Primary body & headings)
  - `--ink-700`: `#334155` (Secondary labels & table headers)
  - `--ink-500`: `#5A6578` (Muted hints & metadata)
- **Primary Signal Accent:**
  - `--primary-500`: `#0F52BA` (Clinical Cobalt Blue — primary actions, active workspace state, progress indicators)
  - `--primary-600`: `#0D449B`
  - `--primary-50`: `#EEF5FF` (Selected ledger row highlight)
- **Semantic Status Roles:**
  - **Pending (`ยังไม่ดำเนินการ`):** Amber (`#B45309` on `#FEF3C7`)
  - **In Progress (`กำลังดำเนินการ`):** Clinical Cobalt (`#0A357A` on `#D9E8FF`)
  - **Completed (`เสร็จสิ้น`):** Clinical Emerald (`#095C47` on `#ECFDF5`)
  - **Urgent (`ด่วน`):** Signal Crimson (`#BE123C` on `#FFF1F2`)

## Typography & Scannable Hierarchy

- **Primary UI & Thai Body Face:** `'Sarabun'`, sans-serif (`14.5px` base, `1.35` heading line-height, `1.55` specification detail line-height).
- **Tabular Data & Measurement Face:** `'JetBrains Mono'`, monospace with `font-variant-numeric: tabular-nums` applied to all Request IDs (`#REP-0001`), dates (`DD/MM/YYYY`), phone extensions, and `% Complete` counters.

## Layout, Spatial Architecture & Functional Workspaces

1. **Top Architectural Command Bar (`.topbar`):**
   - Houses the brand mark, global Workspace Switcher (`ระบบขอรายงานข้อมูล` vs. `แชท & แจ้งซ่อม IT`), primary CTA (`+ เขียนคำขอข้อมูลใหม่`), and logged-in user identity chip.
2. **Primary Workspace — Data & Report Request Ledger (`.reports-workspace`):**
   - **Filter & Action Strip (`.ledger-toolbar`):** Instant status filters with live tabular counters (`รายการทั้งหมด`, `ยังไม่ดำเนินการ`, `กำลังคิวรี่ข้อมูล`, `เสร็จสิ้น (Log ปิดงาน)`, `ที่เกี่ยวข้องกับฉัน`), real-time keyword search, and one-click `Export Log (Excel CSV)` with UTF-8 BOM support for Thai Excel compatibility.
   - **2-Column Split Construction Grid (`.ledger-split-grid`):**
     - **Left Pane:** Sticky-header ledger table displaying ID, Report Title + Purpose summary, Requester + Department, Due Date + Urgency badge, Status + `% Complete` bar, and Assigned IT Owner.
     - **Right Pane (`.ledger-inspector-pane`):** Gridded specification sheet displaying all SharePoint-parity fields and the **IT Center Execution & Log Console** (`Status`, `Owner`, `Start Date`, `Date Completed`, `% Complete` slider/input, and delivery notes) plus a 1-click **Contextual Chat** button.
3. **Preserved Secondary Workspace — Real-time Messenger & IT Repair Board (`.chat-workspace`):**
   - Retains full 1-on-1 Socket.io chat, file/image/video/Excel attachments, voice messages, quick templates, and IT specialty tags.
