
CHEMBASE – Lightweight Electronic Lab Notebook (Signals Lite)

Chembase is a lightweight, fast, and easy-to-deploy Electronic Lab Notebook (ELN) designed for chemistry-related experiment documentation.
It provides structured experiment recording, project organization, rich-text editing, reaction-image upload, and advanced filtering.
Ideal for students, small labs, or anyone who needs a minimal, functional lab-recording system without complex backend infrastructure.

⸻

📌 Features

🔹 Project (Topic) Management
	•	Create and delete project folders (“Topics”)
	•	Each topic maintains its own experiment list
	•	Works like independent notebooks for different research directions

🔹 Structured Experiment Records

Each experiment supports the following fields:
	•	Experiment ID
	•	Date
	•	Experimenter
	•	Experiment Time
	•	Reaction Scheme (image upload, e.g., ChemDraw PNG)
	•	Procedure
	•	Product
	•	Notes

🔹 Rich Text Editing (Quill Editor)

Supports:
	•	Bold / Italic / Underline
	•	Subscript / Superscript (H₂O, SO₄²⁻, etc.)
	•	Lists
	•	Chemical-friendly formatting

🔹 Flexible Experiment Filtering

Search experiments by:
	•	Single date
	•	Date range
	•	Experiment ID keyword

🔹 Detail View & Editing Modal
	•	Click an experiment card to view details
	•	Edit any field in a modal dialog
	•	Upload or replace reaction scheme images
	•	Instant refresh after saving

🔹 Reaction Scheme Upload
	•	PNG/JPG supported
	•	Files stored in:

/backend/static/reactions/


	•	Database stores only the file path

⸻

📁 Project Structure

chembase/
│
├── backend/
│   ├── main.py                 # FastAPI backend
│   ├── experiments.db          # SQLite database (auto-created)
│   └── static/reactions/       # Reaction scheme images
│
├── frontend/
│   ├── index.html              # Main UI
│   ├── script.js               # Frontend logic
│   └── style.css               # Page styling
│
├── README.md
└── .gitignore


⸻

🚀 How to Run

1. Clone the Repository

git clone https://github.com/chain-dream/chembase.git
cd chembase


⸻

2. Install Backend Dependencies

Requires Python 3.9+

pip install fastapi uvicorn python-multipart


⸻

3. Start the Backend Server

cd backend
uvicorn main:app --reload

Backend will run at:

http://127.0.0.1:8000


⸻

4. Start the Frontend

In a separate terminal:

cd frontend
python3 -m http.server 8001

Frontend will be available at:

http://127.0.0.1:8001


⸻

🧪 Tech Stack
	•	Frontend: HTML, CSS, JavaScript
	•	Editor: Quill.js
	•	Backend Framework: FastAPI
	•	Database: SQLite (zero configuration)
	•	Static Storage: Local folder for reaction images

⸻

🔮 Future Enhancements (Suggested Extensions)

1. User Accounts & Permissions
	•	Multi-user login
	•	Role-based access (Admin, Researcher, Viewer)
	•	Sharing topics among team members

2. Data Export
	•	Export experiment as PDF
	•	Export entire project as ZIP/Word
	•	Printable summary pages

3. Advanced Chemical Support
	•	MathJax/KaTeX for chemical expressions
	•	Built-in reaction drawing (e.g., ChemDoodle Web Components)
	•	Auto-parsing of chemical formulas

4. Versioning & History
	•	Track changes to each experiment
	•	Restore previous versions
	•	Audit log system

5. Cloud Deployment
	•	Deploy to Render / Railway / HuggingFace Spaces
	•	Multi-user online collaboration

6. Backup & Restore Tools
	•	Auto-backup of SQLite database
	•	Backup static files
	•	Simple JSON import/export

7. Extended API
	•	REST API for lab instruments
	•	Integration with LIMS-like systems

