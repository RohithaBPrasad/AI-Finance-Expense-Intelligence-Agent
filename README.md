# AI Finance & Expense Intelligence Agent

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-Local_LLM-000000)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector_DB-555555)
![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?logo=scikitlearn&logoColor=white)
![Tesseract](https://img.shields.io/badge/Tesseract-OCR-4B8BBE)

An intelligent financial assistant that analyzes **real** expenses, invoices, budgets, and transactions, with no mock or demo data baked in. Upload your own scanned invoices and receipts and/or CSV bank exports, and the platform runs the full analysis pipeline for you:

```
Document Processing (OCR) → Transaction Analysis (categorization + SQL)
  → Anomaly Detection (Isolation Forest + z-score) → Budget Analysis → Report
```

It also includes a RAG-grounded AI assistant chat that answers questions using your actual data.

**Stack:** FastAPI (Python) backend and a plain HTML/CSS/JS web dashboard. The LLM and embeddings run locally through **Ollama** (`llama3` for reasoning, `nomic-embed-text` for embeddings), with SQLite for transactional SQL analytics, ChromaDB as the vector store, scikit-learn for anomaly detection, and Tesseract for OCR.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites-windows)
2. [Setup](#2-setup)
3. [Run](#3-run)
4. [Using It with Real Data](#4-using-it-with-real-data)
5. [Project Structure](#5-project-structure)
6. [The Agent Architecture](#6-the-agent-architecture)
7. [Extending the Project](#7-extending-the-project)

---

## 1. Prerequisites (Windows)

**1. Python 3.10+**

**2. Tesseract OCR** (reads invoices and receipts)

```powershell
winget install --id UB-Mannheim.TesseractOCR
```

After installing, note the path (usually `C:\Program Files\Tesseract-OCR\tesseract.exe`) and add it to your PATH, or set it explicitly at the top of `backend/ocr_processor.py`:

```python
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
```

**3. Poppler** (only needed for PDF invoices, not for images)

```powershell
winget install --id oschwartz10612.Poppler
```

Add its `Library\bin` folder to PATH so `pdf2image` can find `pdftoppm`.

**4. Ollama** (running locally)

Make sure the following models are pulled:

```powershell
ollama pull llama3
ollama pull nomic-embed-text
```

> **Note:** The app also works without Ollama running. OCR, SQL analytics, anomaly detection, and budget analysis all work standalone. Only the chat assistant and the report's executive summary need Ollama, and both degrade gracefully (you still get the raw data and report) if it is not reachable.

---

## 2. Setup

Open this folder in VS Code, then run the following in the integrated PowerShell terminal:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks the activation script, run this once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 3. Run

```powershell
uvicorn backend.main:app --reload --port 8000
```

Open **http://localhost:8000** in your browser to access the web interface, which has six tabs: Dashboard, Upload Data, Transactions, Budgets, AI Assistant, and Report.

---

## 4. Using It with Real Data

| Tab | Action | What it does |
|---|---|---|
| **Upload Data** | Upload Invoice/Receipt | Upload a real photo, scan, or PDF of an invoice or receipt. It is OCR'd, fields are extracted, it is auto-categorized, and it is stored. |
| **Upload Data** | Import CSV | Export a real transaction history from your bank, card, or ERP as CSV and import it directly. Column names (date, amount, vendor/merchant/description) are auto-detected. See `sample_data/csv_format_template.csv` for the expected shape, not sample content. |
| **Budgets** | Set monthly budgets | Set a real monthly budget per category. Use the categories in `backend/transaction_parser.py`'s `CATEGORY_KEYWORDS`, or any custom text; budgets are matched by exact category name. |
| **Transactions** | Run Anomaly Detection | Re-scores every transaction using Isolation Forest plus a per-category z-score and flags outliers. |
| **AI Assistant** | Ask questions | Ask things like *"What's unusual about this month's spend?"* or *"How much did we spend on Procurement?"* The assistant routes to SQL, anomaly, and budget tools and retrieves relevant real transactions via RAG before answering. |
| **Report** | Generate report | Produces a full markdown report (executive summary, category breakdown, top anomalies, budget status, and a computed risk score) from whatever real data is currently in the database, downloadable as `.md`. |

> **No demo data:** There is no seeded or demo data. The database starts empty, and everything you see is built from what you actually upload.

---

## 5. Project Structure

```
ai-finance-agent/
├── backend/
│   ├── main.py                # FastAPI app & all REST endpoints
│   ├── database.py            # SQLAlchemy models (Transaction, Budget, Document)
│   ├── ocr_processor.py       # OCR + field extraction (Document Processing)
│   ├── transaction_parser.py  # Categorization + CSV import (Transaction Analysis)
│   ├── anomaly_detector.py    # Isolation Forest + z-score (Anomaly Detection)
│   ├── budget_analyzer.py     # Budget vs actual (Budget Analysis)
│   ├── rag_engine.py          # Ollama embeddings + ChromaDB (RAG)
│   ├── llm_agent.py           # Tool-routing agent + Ollama chat (Agents/LLM)
│   └── report_generator.py    # Risk score + markdown report (Report)
├── frontend/
│   ├── index.html             # Web dashboard (6 tabs)
│   ├── style.css
│   └── app.js                 # Fetch calls, Chart.js charts, chat UI
├── data/                      # SQLite DB, ChromaDB store, uploaded files (created at runtime)
├── sample_data/csv_format_template.csv
└── requirements.txt
```

---

## 6. The Agent Architecture

`backend/llm_agent.py` implements a small, explicit tool-routing agent with no LangChain dependency. It examines the question, decides which of the SQL, anomaly, budget, and RAG tools are relevant, pulls their real output, and passes that to the local Ollama model as grounded context for the final natural-language answer.

To add more tools (for example, a vendor-lookup tool or a monthly-comparison tool), extend `_route()` and add new `_*_tool()` functions.

---

## 7. Extending the Project

- **Database:** Swap SQLite for Postgres by changing `DB_PATH` / the engine URL in `database.py`. This is a drop-in change if you want a production-grade setup.
- **OCR accuracy:** Field extraction in `ocr_processor.py` is regex/heuristic-based. If you process invoices from a small set of known vendors, tailoring the regex patterns to their specific layouts will improve accuracy.
- **Risk scoring:** The risk score formula in `report_generator.py` is intentionally simple (`60% anomaly ratio + 40% over-budget ratio`). Tune the weights once you have enough real historical data to calibrate against.
