# backend/main.py
import os
import sqlite3
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from uuid import uuid4

DB_PATH = "experiments.db"


# ---------- DB 工具 ----------
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    # 课题表（原来的 notebook）
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS notebooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    # 实验表
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS experiments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notebook_id INTEGER NOT NULL,
            title TEXT NOT NULL,   -- 实验编号
            date TEXT NOT NULL,
            objective TEXT,        -- 实验人
            materials TEXT,        -- 实验时间
            procedure TEXT,
            results TEXT,          -- 产物 / 结果
            notes TEXT,
            created_at TEXT NOT NULL
        )
        """
    )

    # 如果没有 reaction_image 字段就加上
    cur.execute("PRAGMA table_info(experiments)")
    cols = [row[1] for row in cur.fetchall()]
    if "reaction_image" not in cols:
        cur.execute("ALTER TABLE experiments ADD COLUMN reaction_image TEXT")

    conn.commit()
    conn.close()


# ---------- Pydantic 模型 ----------
class NotebookCreate(BaseModel):
    name: str


class NotebookOut(BaseModel):
    id: int
    name: str
    created_at: str


class ExperimentBase(BaseModel):
    notebook_id: int
    title: str
    date: str
    objective: Optional[str] = None
    materials: Optional[str] = None
    procedure: Optional[str] = None
    results: Optional[str] = None
    notes: Optional[str] = None
    reaction_image: Optional[str] = None


class ExperimentCreate(ExperimentBase):
    pass


class ExperimentUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    objective: Optional[str] = None
    materials: Optional[str] = None
    procedure: Optional[str] = None
    results: Optional[str] = None
    notes: Optional[str] = None
    reaction_image: Optional[str] = None


class ExperimentOut(BaseModel):
    id: int
    notebook_id: int
    title: str
    date: str
    objective: Optional[str]
    materials: Optional[str]
    procedure: Optional[str]
    results: Optional[str]
    notes: Optional[str]
    reaction_image: Optional[str]
    created_at: str


# ---------- FastAPI app ----------
app = FastAPI(title="Signals Lite Backend")

# 静态目录，用来存放反应式图片
os.makedirs("static/reactions", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS
origins = [
    "http://127.0.0.1:8001",
    "http://localhost:8001",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.on_event("startup")
def on_startup():
    init_db()


# ---------- 课题（notebooks） ----------
@app.get("/notebooks", response_model=List[NotebookOut])
def list_notebooks():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM notebooks ORDER BY id ASC")
    rows = cur.fetchall()
    conn.close()
    return [NotebookOut(**dict(r)) for r in rows]


@app.post("/notebooks", response_model=NotebookOut)
def create_notebook(nb: NotebookCreate):
    conn = get_conn()
    cur = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    cur.execute(
        "INSERT INTO notebooks (name, created_at) VALUES (?, ?)",
        (nb.name, created_at),
    )
    conn.commit()
    new_id = cur.lastrowid
    cur.execute("SELECT * FROM notebooks WHERE id = ?", (new_id,))
    row = cur.fetchone()
    conn.close()
    return NotebookOut(**dict(row))


@app.delete("/notebooks/{notebook_id}")
def delete_notebook(notebook_id: int):
    conn = get_conn()
    cur = conn.cursor()

    # 同时删除该课题下的所有实验
    cur.execute("DELETE FROM experiments WHERE notebook_id = ?", (notebook_id,))
    cur.execute("DELETE FROM notebooks WHERE id = ?", (notebook_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ---------- 实验 ----------
@app.get("/experiments", response_model=List[ExperimentOut])
def list_experiments(
    notebook_id: int = Query(...),
    date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    title: Optional[str] = None,
):
    conn = get_conn()
    cur = conn.cursor()

    sql = "SELECT * FROM experiments WHERE notebook_id = ?"
    params: list = [notebook_id]

    if date:
        sql += " AND date = ?"
        params.append(date)
    else:
        if start_date:
            sql += " AND date >= ?"
            params.append(start_date)
        if end_date:
            sql += " AND date <= ?"
            params.append(end_date)

    if title:
        sql += " AND title LIKE ?"
        params.append(f"%{title}%")

    sql += " ORDER BY date ASC, id ASC"

    cur.execute(sql, params)
    rows = cur.fetchall()
    conn.close()
    return [ExperimentOut(**dict(r)) for r in rows]


@app.post("/experiments", response_model=ExperimentOut)
def create_experiment(data: ExperimentCreate):
    conn = get_conn()
    cur = conn.cursor()

    created_at = datetime.utcnow().isoformat()

    cur.execute(
        """
        INSERT INTO experiments (
            notebook_id, title, date,
            objective, materials, procedure,
            results, notes, reaction_image,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data.notebook_id,
            data.title,
            data.date,
            data.objective,
            data.materials,
            data.procedure,
            data.results,
            data.notes,
            data.reaction_image,
            created_at,
        ),
    )
    conn.commit()
    new_id = cur.lastrowid

    cur.execute("SELECT * FROM experiments WHERE id = ?", (new_id,))
    row = cur.fetchone()
    conn.close()
    return ExperimentOut(**dict(row))


@app.put("/experiments/{exp_id}", response_model=ExperimentOut)
def update_experiment(exp_id: int, data: ExperimentUpdate):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT * FROM experiments WHERE id = ?", (exp_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="实验不存在")

    current = dict(row)

    # 用新的字段覆盖旧值
    updated = {
        "title": data.title if data.title is not None else current["title"],
        "date": data.date if data.date is not None else current["date"],
        "objective": data.objective if data.objective is not None else current["objective"],
        "materials": data.materials if data.materials is not None else current["materials"],
        "procedure": data.procedure if data.procedure is not None else current["procedure"],
        "results": data.results if data.results is not None else current["results"],
        "notes": data.notes if data.notes is not None else current["notes"],
        "reaction_image": (
            data.reaction_image if data.reaction_image is not None else current.get("reaction_image")
        ),
    }

    cur.execute(
        """
        UPDATE experiments
        SET title = ?, date = ?, objective = ?, materials = ?,
            procedure = ?, results = ?, notes = ?, reaction_image = ?
        WHERE id = ?
        """,
        (
            updated["title"],
            updated["date"],
            updated["objective"],
            updated["materials"],
            updated["procedure"],
            updated["results"],
            updated["notes"],
            updated["reaction_image"],
            exp_id,
        ),
    )
    conn.commit()

    cur.execute("SELECT * FROM experiments WHERE id = ?", (exp_id,))
    row2 = cur.fetchone()
    conn.close()
    return ExperimentOut(**dict(row2))


@app.delete("/experiments/{exp_id}")
def delete_experiment(exp_id: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM experiments WHERE id = ?", (exp_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ---------- 反应式图片上传 ----------
@app.post("/upload-reaction-image")
async def upload_reaction_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        return JSONResponse(
            status_code=400,
            content={"detail": "只支持图片文件（PNG/JPG 等）。"},
        )

    ext = os.path.splitext(file.filename)[1] or ".png"
    filename = f"{uuid4().hex}{ext}"
    save_path = os.path.join("static", "reactions", filename)

    with open(save_path, "wb") as f:
        f.write(await file.read())

    # 返回相对路径，前端用 API_BASE 拼成完整 URL
    return {"url": f"/static/reactions/{filename}"}