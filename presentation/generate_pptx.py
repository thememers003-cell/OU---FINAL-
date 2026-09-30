import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def create_presentation():
    prs = Presentation()
    # 16:9 Widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_slide_layout = prs.slide_layouts[6]

    # Logo Path
    LOGO_PATH = "c:\\Users\\ADMIN\\Desktop\\XPOS\\presentation\\printbro_logo.png"

    # Clean, High-Contrast Light Theme Colors (Ideal for Projectors & CIE Panels)
    BG_LIGHT = RGBColor(248, 250, 252)     # Slate 50 / Clean Light Grey-White
    CARD_BG = RGBColor(255, 255, 255)      # Pure Crisp White
    CARD_BORDER = RGBColor(203, 213, 225)  # Slate 300 / Crisp Border
    TEXT_HEAD = RGBColor(15, 23, 42)       # Slate 900 / Deep Black-Navy (Maximum Contrast)
    TEXT_BODY = RGBColor(30, 41, 59)       # Slate 800 / Very Dark Charcoal (Super Clear)
    TEXT_MUTED = RGBColor(71, 85, 105)     # Slate 600 / Visible Dark Slate
    PRIMARY = RGBColor(2, 132, 199)        # Deep Sky Blue 600
    ACCENT = RGBColor(67, 56, 202)         # Deep Indigo 700
    SUCCESS = RGBColor(5, 150, 105)        # Emerald Green 600
    DANGER = RGBColor(220, 38, 38)         # Crimson Red 600
    CALLOUT_BG = RGBColor(241, 245, 249)   # Slate 100
    HEADER_BG = RGBColor(30, 58, 138)      # Deep Navy 900 for Tables

    def set_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_LIGHT
        bg.line.fill.background()
        return bg

    def add_header(slide, slide_num, title, subtitle=None):
        # Category / Tag
        cat_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.42), Inches(9.0), Inches(0.35))
        tf = cat_box.text_frame
        tf.word_wrap = True
        tf.margin_top = tf.margin_bottom = tf.margin_left = tf.margin_right = 0
        p = tf.paragraphs[0]
        p.text = f"PRINT BRO  |  CIE PITCH DECK  •  SLIDE {slide_num:02d}"
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = PRIMARY

        # Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.78), Inches(9.6), Inches(0.75))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_top = tf_t.margin_bottom = tf_t.margin_left = tf_t.margin_right = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(25)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_HEAD

        if subtitle:
            sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(9.8), Inches(0.42))
            tf_s = sub_box.text_frame
            tf_s.word_wrap = True
            tf_s.margin_top = tf_s.margin_bottom = tf_s.margin_left = tf_s.margin_right = 0
            p_s = tf_s.paragraphs[0]
            p_s.text = subtitle
            p_s.font.size = Pt(13)
            p_s.font.bold = True
            p_s.font.color.rgb = TEXT_MUTED

        # Add top-right PrintBro Logo
        if os.path.exists(LOGO_PATH):
            try:
                slide.shapes.add_picture(LOGO_PATH, Inches(10.7), Inches(0.4), width=Inches(1.85))
            except Exception:
                pass

    def add_card(slide, left, top, width, height, title, items, badge=None, badge_color=PRIMARY, border_color=CARD_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = CARD_BG
        card.line.color.rgb = border_color
        card.line.width = Pt(1.5)

        tb = slide.shapes.add_textbox(left + Inches(0.28), top + Inches(0.22), width - Inches(0.56), height - Inches(0.44))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_top = tf.margin_bottom = tf.margin_left = tf.margin_right = 0

        p0 = tf.paragraphs[0]
        if badge:
            p0.text = f"[{badge.upper()}]  {title}"
        else:
            p0.text = title
        p0.font.size = Pt(15)
        p0.font.bold = True
        p0.font.color.rgb = badge_color
        p0.space_after = Pt(10)

        for item in items:
            p = tf.add_paragraph()
            p.text = f"•  {item}"
            p.font.size = Pt(12.5)
            p.font.color.rgb = TEXT_BODY
            p.space_after = Pt(6)

    # -------------------------------------------------------------
    # SLIDE 1: Cover / Problem Overview with HERO LOGO
    # -------------------------------------------------------------
    s1 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s1)

    # Hero card on Left & Center
    hero_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.8), Inches(7.2), Inches(5.9))
    hero_card.fill.solid()
    hero_card.fill.fore_color.rgb = CARD_BG
    hero_card.line.color.rgb = CARD_BORDER
    hero_card.line.width = Pt(2)

    tf1 = hero_card.text_frame
    tf1.word_wrap = True
    tf1.margin_left = Inches(0.5)
    tf1.margin_right = Inches(0.5)
    tf1.margin_top = Inches(0.45)

    p = tf1.paragraphs[0]
    p.text = "PRINT BRO"
    p.font.size = Pt(40)
    p.font.bold = True
    p.font.color.rgb = PRIMARY
    p.space_after = Pt(2)

    p = tf1.add_paragraph()
    p.text = "Scan. Pay. Print. — Autonomous Campus Kiosks"
    p.font.size = Pt(18)
    p.font.bold = True
    p.font.color.rgb = TEXT_HEAD
    p.space_after = Pt(12)

    p = tf1.add_paragraph()
    p.text = "Slide 01 — The Problem with Traditional Campus Printing"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = ACCENT
    p.space_after = Pt(10)

    p = tf1.add_paragraph()
    p.text = "• College students frequently need to print assignments, lab records, resumes, notes, project reports & certificates."
    p.font.size = Pt(13)
    p.font.color.rgb = TEXT_BODY
    p.space_after = Pt(6)

    p = tf1.add_paragraph()
    p.text = "• Most campuses depend on 1 or 2 congested Xerox shops handling printing alongside binding, scanning, stationery & lamination."
    p.font.size = Pt(13)
    p.font.color.rgb = TEXT_BODY
    p.space_after = Pt(6)

    p = tf1.add_paragraph()
    p.text = "• A shopkeeper must manually: receive file, inspect, select settings, take payment, print, and hand over — taking several minutes per student."
    p.font.size = Pt(13)
    p.font.color.rgb = TEXT_BODY
    p.space_after = Pt(12)

    p = tf1.add_paragraph()
    p.text = "KEY ISSUE: Concentrating thousands of students and multiple services at one physical counter creates massive waiting queues."
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = DANGER

    # Right Side: Mascot Logo Card
    right_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.2), Inches(0.8), Inches(4.333), Inches(5.9))
    right_card.fill.solid()
    right_card.fill.fore_color.rgb = CARD_BG
    right_card.line.color.rgb = PRIMARY
    right_card.line.width = Pt(2)

    if os.path.exists(LOGO_PATH):
        try:
            s1.shapes.add_picture(LOGO_PATH, Inches(8.35), Inches(1.2), width=Inches(4.0))
        except Exception:
            pass

    rtf = right_card.text_frame
    rtf.word_wrap = True
    rtf.margin_top = Inches(4.2)
    rtf.margin_left = Inches(0.3)
    rtf.margin_right = Inches(0.3)
    rp = rtf.paragraphs[0]
    rp.text = "CIE Pitch Presentation"
    rp.font.size = Pt(16)
    rp.font.bold = True
    rp.font.color.rgb = PRIMARY
    rp.alignment = PP_ALIGN.CENTER
    rp.space_after = Pt(4)

    rp2 = rtf.add_paragraph()
    rp2.text = "Centre for Innovation & Entrepreneurship\nG. Pulla Reddy Engineering College (GPREC)"
    rp2.font.size = Pt(12)
    rp2.font.bold = True
    rp2.font.color.rgb = TEXT_MUTED
    rp2.alignment = PP_ALIGN.CENTER

    # -------------------------------------------------------------
    # SLIDE 2: What Students Experience
    # -------------------------------------------------------------
    s2 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s2)
    add_header(s2, 2, "The Current Student Experience", "The painful friction points in an everyday student's printing journey")

    flow_box = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(2.0), Inches(11.7), Inches(1.1))
    flow_box.fill.solid()
    flow_box.fill.fore_color.rgb = CARD_BG
    flow_box.line.color.rgb = PRIMARY
    flow_box.line.width = Pt(1.5)
    flow_tf = flow_box.text_frame
    flow_tf.word_wrap = True
    flow_tf.margin_left = Inches(0.3)
    p = flow_tf.paragraphs[0]
    p.text = "CURRENT FLOW:"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = PRIMARY
    p.space_after = Pt(4)
    p2 = flow_tf.add_paragraph()
    p2.text = "Student needs print  →  Goes to Xerox shop  →  Finds crowd  →  Waits in queue  →  Shares file  →  Payment  →  Printing  →  Collects pages"
    p2.font.size = Pt(12.5)
    p2.font.bold = True
    p2.font.color.rgb = TEXT_HEAD

    add_card(s2, Inches(0.8), Inches(3.35), Inches(3.6), Inches(3.6), "Queue & Time Loss", [
        "🔴 Long queues during morning rush",
        "🔴 15 to 45 mins spent just waiting",
        "🔴 Peak-hour crowding before deadlines",
        "🔴 Risk of arriving late to classes/labs"
    ], "Friction 1", DANGER, DANGER)

    add_card(s2, Inches(4.85), Inches(3.35), Inches(3.6), Inches(3.6), "Manual Bottlenecks", [
        "🔴 Manual file handling takes operator time",
        "🔴 WhatsApp file sharing creates privacy issues",
        "🔴 USB drive transfers spread computer viruses",
        "🔴 Frequent manual billing & cash disputes"
    ], "Friction 2", DANGER, DANGER)

    add_card(s2, Inches(8.9), Inches(3.35), Inches(3.6), Inches(3.6), "Location & Hours", [
        "🔴 Limited printing locations across campus",
        "🔴 Heavy dependence on 1 or 2 shops",
        "🔴 Closed early mornings and late evenings",
        "🔴 Zero 24/7 printing option for hostels"
    ], "Friction 3", DANGER, DANGER)

    # -------------------------------------------------------------
    # SLIDE 3: The Bigger Problem
    # -------------------------------------------------------------
    s3 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s3)
    add_header(s3, 3, "More Than Just a Printing Problem", "The issue isn't simply the cost of printing — it is Time + Accessibility + Operational Efficiency")

    add_card(s3, Inches(0.8), Inches(2.2), Inches(5.6), Inches(4.7), "The Disproportionate Time Equation", [
        "A student who needs only 5–10 pages spends significantly more time travelling to the shop, waiting in queue, and completing the transaction than the actual printing time.",
        "Walking to shop & return: 10–15 mins",
        "Waiting in peak-hour queue: 20–30 mins",
        "Operator file handling: 3–5 mins",
        "Actual machine print time: Just 15–20 SECONDS!",
        "Result: Over 90% of student time is pure deadweight waiting.",
        "Across 4,000+ students, thousands of academic hours are wasted."
    ], "Time Deficit", ACCENT)

    add_card(s3, Inches(6.9), Inches(2.2), Inches(5.6), Inches(4.7), "High-Stakes Deadline Chaos", [
        "This becomes especially problematic during critical periods:",
        "  • Before Exams (Hall tickets, formulas)",
        "  • During Assignment Submissions",
        "  • During Project Reviews & Reports",
        "  • During Record Submissions",
        "  • During Placement & Job Application Drives",
        "  • During College Events & Conferences",
        "Academic impact: Unavoidable delays cause panic, late penalties, and missed deadlines outside student control."
    ], "Campus Pressure", DANGER, DANGER)

    # -------------------------------------------------------------
    # SLIDE 4: Limitations of Traditional Model
    # -------------------------------------------------------------
    s4 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s4)
    add_header(s4, 4, "Why Existing Xerox Shops Struggle", "Limitations of the traditional model: Designed around the shop, rather than student convenience")

    rows = 7
    cols = 2
    table_shape = s4.shapes.add_table(rows + 1, cols, Inches(0.8), Inches(2.0), Inches(11.7), Inches(4.3))
    table = table_shape.table
    table.columns[0].width = Inches(3.5)
    table.columns[1].width = Inches(8.2)

    headers = ["Traditional Xerox Shop", "Operational Bottleneck / Problem"]
    for i, h in enumerate(headers):
        cell = table.cell(0, i)
        cell.fill.solid()
        cell.fill.fore_color.rgb = HEADER_BG
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = RGBColor(255, 255, 255)

    data = [
        ("Single counter", "Creates long queues and severe single-point bottlenecks."),
        ("Manual file handling", "Takes operator time for every single customer."),
        ("Multiple services", "Printing gets mixed with binding, scanning, and stationery orders."),
        ("Limited working hours", "Students cannot print anytime (closed at night/early morning)."),
        ("Physical presence required", "Student must stand at the counter to keep their place in line."),
        ("High peak-hour demand", "Crowding increases drastically before classes and deadlines."),
        ("Operator-dependent", "Every single order requires manual intervention to execute.")
    ]

    for row_idx, (col1, col2) in enumerate(data, start=1):
        cell1 = table.cell(row_idx, 0)
        cell1.fill.solid()
        cell1.fill.fore_color.rgb = CARD_BG
        p1 = cell1.text_frame.paragraphs[0]
        p1.text = col1
        p1.font.size = Pt(12)
        p1.font.bold = True
        p1.font.color.rgb = ACCENT

        cell2 = table.cell(row_idx, 1)
        cell2.fill.solid()
        cell2.fill.fore_color.rgb = CARD_BG
        p2 = cell2.text_frame.paragraphs[0]
        p2.text = col2
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_BODY

    callout = s4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(6.45), Inches(11.7), Inches(0.55))
    callout.fill.solid()
    callout.fill.fore_color.rgb = CALLOUT_BG
    callout.line.color.rgb = PRIMARY
    ctf = callout.text_frame
    cp = ctf.paragraphs[0]
    cp.text = "CORE OBSERVATION: The existing model is designed around the shop, rather than around the student's convenience."
    cp.font.size = Pt(12)
    cp.font.bold = True
    cp.font.color.rgb = TEXT_HEAD

    # -------------------------------------------------------------
    # SLIDE 5: The Opportunity - What If Printing Was Self-Service?
    # -------------------------------------------------------------
    s5 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s5)
    add_header(s5, 5, "Our Opportunity: What If Printing Was Self-Service?", "Imagine a student walking up to a kiosk: Upload Document → Select Pages → Choose B/W or Colour → Pay → Print → Collect")

    add_card(s5, Inches(0.8), Inches(2.2), Inches(5.6), Inches(4.7), "What We Eliminate", [
        "❌ Waiting for an operator",
        "❌ Standing in a long queue",
        "❌ Sharing files through WhatsApp repeatedly",
        "❌ Manual order processing & paper settings",
        "❌ Waiting behind spiral binding and lamination orders",
        "❌ Cash change hassles or manual calculation errors"
    ], "No More", DANGER, DANGER)

    add_card(s5, Inches(6.9), Inches(2.2), Inches(5.6), Inches(4.7), "The Print Bro Advantage", [
        "✅ 100% Self-Service: Full student control via phone or touch",
        "✅ Fast: Total transaction finished in under 45 seconds",
        "✅ Digital Payment: Instant UPI (PhonePe, GPay, Paytm)",
        "✅ Automated Printing: Cloud-orchestrated instant output",
        "✅ Available Inside Campus: Deployed in blocks & hostels",
        "✅ 24/7 Access: Ready whenever academic buildings are open"
    ], "Instead", SUCCESS, SUCCESS)

    # -------------------------------------------------------------
    # SLIDE 6: Introducing Print Bro with LOGO
    # -------------------------------------------------------------
    s6 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s6)
    add_header(s6, 6, "Introducing Print Bro / Smart Campus Printing Kiosk", "Print Bro is a self-service printing kiosk designed specifically for colleges, schools and institutional campuses")

    steps = [
        ("1. UPLOAD", "Upload PDF / document through QR or kiosk interface", PRIMARY),
        ("2. CONFIGURE", "Select exact pages, copies, B/W or colour", ACCENT),
        ("3. PAY", "Pay digitally using UPI (GPay, PhonePe, Paytm)", SUCCESS),
        ("4. PRINT", "Automated high-speed printing starts immediately", PRIMARY),
        ("5. COLLECT", "Student receives the printed document neatly sorted", SUCCESS)
    ]

    card_width = Inches(2.15)
    gap = Inches(0.24)
    start_left = Inches(0.8)

    for i, (stitle, sdesc, scolor) in enumerate(steps):
        s_left = start_left + i * (card_width + gap)
        sc = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, s_left, Inches(2.2), card_width, Inches(3.9))
        sc.fill.solid()
        sc.fill.fore_color.rgb = CARD_BG
        sc.line.color.rgb = scolor
        sc.line.width = Pt(2)

        stf = sc.text_frame
        stf.word_wrap = True
        stf.margin_top = Inches(0.25)
        stf.margin_left = Inches(0.18)
        stf.margin_right = Inches(0.18)

        p = stf.paragraphs[0]
        p.text = f"STEP {i+1}"
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = scolor
        p.space_after = Pt(8)

        p2 = stf.add_paragraph()
        p2.text = stitle
        p2.font.size = Pt(14)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_HEAD
        p2.space_after = Pt(12)

        p3 = stf.add_paragraph()
        p3.text = sdesc
        p3.font.size = Pt(12)
        p3.font.color.rgb = TEXT_BODY

    # Mission Statement bar
    m_box = s6.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(6.3), Inches(11.7), Inches(0.7))
    m_box.fill.solid()
    m_box.fill.fore_color.rgb = CALLOUT_BG
    m_box.line.color.rgb = PRIMARY
    mtf = m_box.text_frame
    mp = mtf.paragraphs[0]
    mp.text = "GOAL: Turn a traditional counter-based printing experience into a self-service digital experience."
    mp.font.size = Pt(13)
    mp.font.bold = True
    mp.font.color.rgb = PRIMARY

    # -------------------------------------------------------------
    # SLIDE 7: Reducing Crowding
    # -------------------------------------------------------------
    s7 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s7)
    add_header(s7, 7, "Why This Can Reduce Crowding", "From One Counter → Multiple Self-Service Points across the campus")

    add_card(s7, Inches(0.8), Inches(2.2), Inches(5.6), Inches(4.7), "Model Comparison", [
        "Traditional Model:",
        "100 students → 1 shop counter → 1 operator → Long Queue",
        "",
        "Print Bro Model:",
        "100 students → Self-service kiosks → Automated processing → Zero Congestion",
        "",
        "Key Operational Impact:",
        "• Eliminates single-counter bottlenecks",
        "• Parallel autonomous processing across campus",
        "• Instant turnover under 45 seconds per student"
    ], "Efficiency Shift", PRIMARY)

    add_card(s7, Inches(6.9), Inches(2.2), Inches(5.6), Inches(4.7), "Multiple Kiosks Deployed At", [
        "• College Academic Blocks & Department Corridors",
        "• Central Library & Reference Sections",
        "• Student Hostels (Boys & Girls for 24/7 access)",
        "• Administrative & Placement Cell Buildings",
        "• Canteen & Student Recreation Areas",
        "• Academic Laboratory Departments",
        "",
        "This creates a distributed printing network instead of concentrating demand at one shop."
    ], "Campus Deployment", SUCCESS, SUCCESS)

    # -------------------------------------------------------------
    # SLIDE 8: Additional Opportunity
    # -------------------------------------------------------------
    s8 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s8)
    add_header(s8, 8, "Additional Opportunity: Printing + Digital Advertising", "This is where your idea becomes especially interesting for CIE: Captive Attention & Dual Revenue")

    add_card(s8, Inches(0.8), Inches(2.2), Inches(5.6), Inches(4.7), "Kiosk Display Screen & Dwell Time", [
        "The kiosk has a dedicated digital display screen.",
        "While students are using the kiosk or waiting for their print:",
        "Screen → Campus & Brand Advertisements",
        "",
        "Potential Advertisers:",
        "• Food & Beverage brands, cafes, delivery apps",
        "• EdTech & Skill-building companies (GATE, Coding)",
        "• Banks / Fintech (Student accounts, cards)",
        "• Local businesses & retailers",
        "• Student-focused products & gadgets",
        "• College clubs, events, and hackathons"
    ], "High-Impact DOOH", ACCENT)

    add_card(s8, Inches(6.9), Inches(2.2), Inches(5.6), Inches(4.7), "Expanded Venture Ecosystem", [
        "So the model isn't only:",
        "Student → Pays → Print",
        "",
        "It becomes a three-sided value engine:",
        "",
        "1. Student → Gets fast, autonomous printing service",
        "",
        "2. Brand → Gets targeted advertising to verified 18-24 college students",
        "",
        "3. College → Gets modern smart campus utility infrastructure at zero capital strain"
    ], "Strategic Synergy", SUCCESS, SUCCESS)

    # -------------------------------------------------------------
    # SLIDE 9: Business Model
    # -------------------------------------------------------------
    s9 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s9)
    add_header(s9, 9, "Business Model: How Print Bro Can Generate Revenue", "Three diversified revenue streams ensuring rapid sustainability and venture scalability")

    add_card(s9, Inches(0.8), Inches(2.2), Inches(3.6), Inches(4.7), "Revenue Stream 1", [
        "Printing Transactions",
        "",
        "Revenue from:",
        "• B/W printing (high daily academic volume)",
        "• Colour printing (diagrams, certificates, project reports)",
        "• Bulk printing & submission packages",
        "",
        "Direct student UPI payment with immediate ledger settlement."
    ], "Printing", PRIMARY)

    add_card(s9, Inches(4.85), Inches(2.2), Inches(3.6), Inches(4.7), "Revenue Stream 2", [
        "Digital Advertising",
        "",
        "Brands pay for advertising displayed on kiosk screens.",
        "",
        "• Sponsored display slots",
        "• Video ad impressions during dwell time",
        "• Brand-subsidized student print discounts",
        "• High gross margin (90%+) software revenue"
    ], "Advertising", ACCENT)

    add_card(s9, Inches(8.9), Inches(2.2), Inches(3.6), Inches(4.7), "Revenue Stream 3", [
        "Institutional SaaS",
        "",
        "Colleges / schools can subscribe to the system for:",
        "• Kiosk fleet management",
        "• Printing analytics & consumption",
        "• Revenue & quota tracking",
        "• Advertisement management",
        "• Usage monitoring & remote alerts"
    ], "Campus SaaS", SUCCESS, SUCCESS)

    # -------------------------------------------------------------
    # SLIDE 10: Long-Term Vision
    # -------------------------------------------------------------
    s10 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s10)
    add_header(s10, 10, "Vision: From Printing Kiosk to Campus Utility Network", "Building a smart self-service network that makes everyday campus services faster and accessible")

    add_card(s10, Inches(0.8), Inches(2.2), Inches(5.6), Inches(4.7), "Service Expansion Path", [
        "Start with:",
        "  Printing",
        "",
        "↓ Then add:",
        "  Scanning (to Email, DigiLocker, Google Drive)",
        "  Document services (ID duplicates, certificates)",
        "  Stationery dispenser (pens, graph sheets, covers)",
        "  Digital forms & administrative submissions",
        "  Campus payments & smart ID integration",
        "  Campus & Brand Advertising",
        "  Other self-service utilities"
    ], "Evolution", PRIMARY)

    add_card(s10, Inches(6.9), Inches(2.2), Inches(5.6), Inches(4.7), "The Ultimate Vision", [
        "Build a network of smart self-service kiosks that make everyday campus services:",
        "  • Faster (< 45 seconds)",
        "  • More accessible (24/7 across campus)",
        "  • Less dependent on manual counters",
        "",
        "Position Print Bro as the essential academic utility infrastructure for colleges, schools, and institutional campuses nationwide."
    ], "Venture Goal", SUCCESS, SUCCESS)

    # -------------------------------------------------------------
    # SLIDE 11: Proposed Pilot at GPREC
    # -------------------------------------------------------------
    s11 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s11)
    add_header(s11, 11, "Proposed Pilot — G. Pulla Reddy Engineering College", "Start with one working prototype at GPREC to validate student adoption and unit economics")

    add_card(s11, Inches(0.8), Inches(2.2), Inches(5.6), Inches(4.7), "Pilot Objectives to Measure", [
        "Start with 1 working prototype kiosk at GPREC.",
        "",
        "Key Pilot Objectives:",
        "  ✓ Test real student usage & daily print volumes",
        "  ✓ Measure average printing time (< 45s target)",
        "  ✓ Measure peak-hour demand & queue reduction",
        "  ✓ Study student adoption & repeat usage",
        "  ✓ Calculate operating cost per page (paper, toner)",
        "  ✓ Test digital payment workflow (UPI reliability)",
        "  ✓ Test advertisement display & engagement",
        "  ✓ Collect direct student & faculty feedback"
    ], "GPREC Trial", PRIMARY)

    add_card(s11, Inches(6.9), Inches(2.2), Inches(5.6), Inches(4.7), "Post-Validation Scale Path", [
        "After successful validation at GPREC:",
        "",
        "1 Kiosk (Prototype validation)",
        "   ↓",
        "Multiple Kiosks (Library, Mech/CSE block, Hostels)",
        "   ↓",
        "Other Engineering Colleges in Kurnool / AP",
        "   ↓",
        "Schools, Degree Colleges & Universities Nationwide",
        "",
        "Transforming regional campus utilities with local manufacturing and scalable cloud management."
    ], "Scale-Up", SUCCESS, SUCCESS)

    # -------------------------------------------------------------
    # SLIDE 12: Final Problem → Solution Summary with LOGO
    # -------------------------------------------------------------
    s12 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(s12)
    add_header(s12, 12, "Final Problem → Solution", "Direct comparison between traditional campus printing and the Print Bro innovation")

    t_shape2 = s12.shapes.add_table(8, 2, Inches(0.8), Inches(1.9), Inches(8.0), Inches(4.2))
    table2 = t_shape2.table
    table2.columns[0].width = Inches(3.6)
    table2.columns[1].width = Inches(4.4)

    headers2 = ["Existing Problem", "Print Bro Solution"]
    for i, h in enumerate(headers2):
        cell = table2.cell(0, i)
        cell.fill.solid()
        cell.fill.fore_color.rgb = HEADER_BG if i == 0 else SUCCESS
        p = cell.text_frame.paragraphs[0]
        p.text = h
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = RGBColor(255, 255, 255)

    comp_data = [
        ("Long queues", "Self-service"),
        ("Manual processing", "Automated workflow"),
        ("Crowded Xerox shops", "Distributed kiosks"),
        ("Operator dependency", "Student-controlled"),
        ("Limited accessibility", "Campus deployment"),
        ("No additional revenue", "Advertising screen"),
        ("No usage visibility", "Central dashboard")
    ]

    for row_idx, (c1, c2) in enumerate(comp_data, start=1):
        cell1 = table2.cell(row_idx, 0)
        cell1.fill.solid()
        cell1.fill.fore_color.rgb = CARD_BG
        p1 = cell1.text_frame.paragraphs[0]
        p1.text = f"❌  {c1}"
        p1.font.size = Pt(12)
        p1.font.bold = True
        p1.font.color.rgb = DANGER

        cell2 = table2.cell(row_idx, 1)
        cell2.fill.solid()
        cell2.fill.fore_color.rgb = CARD_BG
        p2 = cell2.text_frame.paragraphs[0]
        p2.text = f"✅  {c2}"
        p2.font.size = Pt(12)
        p2.font.bold = True
        p2.font.color.rgb = SUCCESS

    # Side logo card on Slide 12
    s12_side = s12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.1), Inches(1.9), Inches(3.4), Inches(4.2))
    s12_side.fill.solid()
    s12_side.fill.fore_color.rgb = CARD_BG
    s12_side.line.color.rgb = PRIMARY
    s12_side.line.width = Pt(1.5)

    if os.path.exists(LOGO_PATH):
        try:
            s12.shapes.add_picture(LOGO_PATH, Inches(9.2), Inches(2.2), width=Inches(3.2))
        except Exception:
            pass

    s12_tf = s12_side.text_frame
    s12_tf.word_wrap = True
    s12_tf.margin_top = Inches(2.8)
    s12_tf.margin_left = Inches(0.2)
    s12_tf.margin_right = Inches(0.2)
    s12_p = s12_tf.paragraphs[0]
    s12_p.text = "Scan. Pay. Print."
    s12_p.font.size = Pt(14)
    s12_p.font.bold = True
    s12_p.font.color.rgb = PRIMARY
    s12_p.alignment = PP_ALIGN.CENTER

    # Call to action footer
    cta = s12.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(6.3), Inches(11.7), Inches(0.7))
    cta.fill.solid()
    cta.fill.fore_color.rgb = CALLOUT_BG
    cta.line.color.rgb = SUCCESS
    ctf = cta.text_frame
    cp = ctf.paragraphs[0]
    cp.text = "PRINT BRO: Smart Campus Printing Kiosks  |  Ready for CIE Pilot & Faculty Discussion  |  Thank You!"
    cp.font.size = Pt(13)
    cp.font.bold = True
    cp.font.color.rgb = SUCCESS

    output_path_light = "c:\\Users\\ADMIN\\Desktop\\XPOS\\presentation\\Print_Bro_CIE_Pitch_Deck_Light.pptx"
    prs.save(output_path_light)
    print(f"Presentation saved successfully with High-Contrast Light Theme & Mascot Logo to: {output_path_light}")

    output_path_main = "c:\\Users\\ADMIN\\Desktop\\XPOS\\presentation\\Print_Bro_CIE_Pitch_Deck.pptx"
    try:
        prs.save(output_path_main)
        print(f"Also updated main file: {output_path_main}")
    except PermissionError:
        print(f"Notice: '{output_path_main}' is currently open in PowerPoint. Please open '{output_path_light}' instead, or close PowerPoint to update the main file.")

if __name__ == "__main__":
    create_presentation()
