// frontend/script.js
const API_BASE = "http://127.0.0.1:8000";

let currentNotebookId = null;
let currentNotebookName = "";

// Quill 实例（新建表单）
let quillObjective;
let quillMaterials;
let quillProcedure;
let quillResults;
let quillNotes;

// Quill 实例（编辑弹窗）
let quillEditObjective;
let quillEditMaterials;
let quillEditProcedure;
let quillEditResults;
let quillEditNotes;

// Quill 配置：统一的工具栏（包含上下角标）
const quillOptions = {
  theme: "snow",
  modules: {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline"],
      [{ script: "sub" }, { script: "super" }], // 下标 / 上标
      [{ list: "ordered" }, { list: "bullet" }],
      ["link"],
      ["clean"],
    ],
  },
};

// 当前正在编辑的实验
let currentEditingId = null;
let currentEditingExperiment = null;

// 工具：从 Quill 取内容，如果纯空行则返回 ""
function getQuillHtmlOrEmpty(quill) {
  if (!quill) return "";
  const text = quill.getText().trim();
  if (!text) return "";
  return quill.root.innerHTML;
}

// 工具：上传反应式图片，返回完整 URL
async function uploadReactionImage(file) {
  if (!file) return null;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload-reaction-image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "反应式图片上传失败");
  }

  const data = await res.json();
  // 后端返回 "/static/reactions/xxx.png"
  return API_BASE + data.url;
}

// ---------------- 课题（Notebook）相关 ----------------

async function loadNotebooks() {
  const listEl = document.getElementById("notebook-list");
  listEl.innerHTML = "加载中…";

  try {
    const res = await fetch(`${API_BASE}/notebooks`);
    const notebooks = await res.json();

    listEl.innerHTML = "";

    if (notebooks.length === 0) {
      listEl.innerHTML = "<li>还没有课题，请先创建一个。</li>";
      currentNotebookId = null;
      currentNotebookName = "";
      updateCurrentNotebookLabel();
      document.getElementById("experiment-list").innerHTML = "";
      return;
    }

    // 当前课题是否还存在
    const stillExists = notebooks.some((nb) => nb.id === currentNotebookId);
    if (!stillExists) {
      currentNotebookId = notebooks[0].id;
      currentNotebookName = notebooks[0].name;
    }

    notebooks.forEach((nb) => {
      const li = document.createElement("li");
      li.dataset.id = nb.id;

      li.innerHTML = `
        <span class="nb-name">${nb.name}</span>
        <button class="nb-delete" title="删除此课题">×</button>
      `;

      const nameSpan = li.querySelector(".nb-name");
      const delBtn = li.querySelector(".nb-delete");

      if (nb.id === currentNotebookId) {
        li.classList.add("active");
      }

      // 点击名称 = 选择课题
      nameSpan.addEventListener("click", () => {
        currentNotebookId = nb.id;
        currentNotebookName = nb.name;

        document
          .querySelectorAll("#notebook-list li")
          .forEach((li2) => li2.classList.remove("active"));
        li.classList.add("active");

        updateCurrentNotebookLabel();
        loadExperiments(getFilterOptions());
      });

      // 点击 × = 删除课题
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteNotebook(nb.id);
      });

      listEl.appendChild(li);
    });

    updateCurrentNotebookLabel();
    loadExperiments(getFilterOptions());
  } catch (err) {
    console.error(err);
    listEl.innerHTML = "<li>加载课题失败。</li>";
  }
}

function updateCurrentNotebookLabel() {
  const el = document.getElementById("current-notebook-name");
  if (currentNotebookId === null) {
    el.textContent = "（尚未选择）";
  } else {
    el.textContent = currentNotebookName + `（ID: ${currentNotebookId}）`;
  }
}

async function handleCreateNotebook(e) {
  e.preventDefault();
  const input = document.getElementById("notebook-name");
  const name = input.value.trim();
  if (!name) return;

  try {
    const res = await fetch(`${API_BASE}/notebooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "创建失败");
    }

    input.value = "";
    await loadNotebooks();
  } catch (err) {
    alert("创建课题失败：" + err.message);
  }
}

async function deleteNotebook(id) {
  if (!confirm("删除课题将同时删除其中所有实验记录，确定要继续吗？")) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/notebooks/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "删除失败");
    }

    await loadNotebooks();
  } catch (err) {
    alert("删除课题失败：" + err.message);
  }
}

// ---------------- 筛选相关 ----------------

function getFilterOptions() {
  const date = document.getElementById("filter-date")?.value || "";
  const start = document.getElementById("filter-start")?.value || "";
  const end = document.getElementById("filter-end")?.value || "";
  const title = document.getElementById("filter-title")?.value.trim() || "";

  const options = {};

  if (date) {
    options.date = date;
  } else {
    if (start) options.start_date = start;
    if (end) options.end_date = end;
  }

  if (title) {
    options.title = title;
  }

  return options;
}

function clearFilters() {
  const dateEl = document.getElementById("filter-date");
  const startEl = document.getElementById("filter-start");
  const endEl = document.getElementById("filter-end");
  const titleEl = document.getElementById("filter-title");

  if (dateEl) dateEl.value = "";
  if (startEl) startEl.value = "";
  if (endEl) endEl.value = "";
  if (titleEl) titleEl.value = "";
}

// ---------------- 实验列表 / 删除 / 打开编辑 ----------------

async function loadExperiments(options = {}) {
  const listDiv = document.getElementById("experiment-list");

  if (currentNotebookId === null) {
    listDiv.innerHTML = "请先在左侧选择一个课题。";
    return;
  }

  listDiv.innerHTML = "加载实验记录中……";

  try {
    const params = new URLSearchParams();
    params.append("notebook_id", currentNotebookId);

    if (options.date) params.append("date", options.date);
    if (options.start_date) params.append("start_date", options.start_date);
    if (options.end_date) params.append("end_date", options.end_date);
    if (options.title) params.append("title", options.title);

    const res = await fetch(`${API_BASE}/experiments?${params.toString()}`);
    const data = await res.json();

    listDiv.innerHTML = "";

    if (data.length === 0) {
      listDiv.textContent = "没有符合条件的实验记录。";
      return;
    }

    data.forEach((exp) => {
      const card = document.createElement("div");
      card.className = "experiment-card";

      let html = `
        <div class="experiment-card-header">
          <h3>${exp.title}</h3>
          <div>
            <button class="edit-btn" data-id="${exp.id}">编辑</button>
            <button class="delete-btn" data-id="${exp.id}">删除</button>
          </div>
        </div>
        <p><b>日期：</b> ${exp.date}</p>
      `;

      if (exp.objective) {
        html += `
          <div>
            <b>实验人：</b>
            <div class="rich-display">${exp.objective}</div>
          </div>
        `;
      }
      if (exp.materials) {
        html += `
          <div>
            <b>实验时间：</b>
            <div class="rich-display">${exp.materials}</div>
          </div>
        `;
      }

      if (exp.reaction_image) {
        html += `
          <div>
            <b>反应式：</b>
            <div>
              <img src="${exp.reaction_image}" class="reaction-img" />
            </div>
          </div>
        `;
      }

      if (exp.procedure) {
        html += `
          <div>
            <b>步骤：</b>
            <div class="rich-display">${exp.procedure}</div>
          </div>
        `;
      }
      if (exp.results) {
        html += `
          <div>
            <b>产物：</b>
            <div class="rich-display">${exp.results}</div>
          </div>
        `;
      }
      if (exp.notes) {
        html += `
          <div>
            <b>备注：</b>
            <div class="rich-display">${exp.notes}</div>
          </div>
        `;
      }

      html += `<p style="font-size:12px;color:gray;">创建时间: ${exp.created_at}</p>`;

      card.innerHTML = html;
      listDiv.appendChild(card);

      // 点击卡片空白区域 = 打开编辑弹窗
      card.addEventListener("click", (e) => {
        if (e.target.closest(".delete-btn") || e.target.closest(".edit-btn")) {
          return;
        }
        openExperimentModal(exp);
      });

      // 编辑按钮
      const editBtn = card.querySelector(".edit-btn");
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openExperimentModal(exp);
      });

      // 删除按钮
      const deleteBtn = card.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = e.target.getAttribute("data-id");
        await deleteExperiment(id);
      });
    });
  } catch (err) {
    console.error(err);
    listDiv.textContent = "加载失败：" + err.message;
  }
}

async function deleteExperiment(id) {
  if (!confirm("确定要删除这条实验记录吗？")) return;

  try {
    const res = await fetch(`${API_BASE}/experiments/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "删除失败");
    }

    loadExperiments(getFilterOptions());
  } catch (err) {
    alert("删除失败：" + err.message);
  }
}

// ---------------- 新建实验（使用 Quill + 反应式图片） ----------------

async function handleCreateExperiment(e) {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const date = document.getElementById("date").value;
  const msg = document.getElementById("msg");

  const objective = getQuillHtmlOrEmpty(quillObjective);
  const materials = getQuillHtmlOrEmpty(quillMaterials);
  const procedure = getQuillHtmlOrEmpty(quillProcedure);
  const results = getQuillHtmlOrEmpty(quillResults);
  const notes = getQuillHtmlOrEmpty(quillNotes);

  if (currentNotebookId === null) {
    msg.textContent = "请先在左侧创建/选择一个课题。";
    msg.style.color = "red";
    return;
  }

  if (!title || !date) {
    msg.textContent = "实验编号和日期不能为空。";
    msg.style.color = "red";
    return;
  }

  try {
    const reactionFileInput = document.getElementById("reaction-file");
    let reactionImageUrl = null;

    if (reactionFileInput && reactionFileInput.files[0]) {
      reactionImageUrl = await uploadReactionImage(reactionFileInput.files[0]);
    }

    const res = await fetch(`${API_BASE}/experiments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notebook_id: currentNotebookId,
        title,
        date,
        objective,
        materials,
        procedure,
        results,
        notes,
        reaction_image: reactionImageUrl,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "保存失败");
    }

    msg.textContent = "保存成功！";
    msg.style.color = "green";

    // 重置表单和 Quill 内容
    document.getElementById("create-form").reset();
    [quillObjective, quillMaterials, quillProcedure, quillResults, quillNotes].forEach(
      (q) => {
        if (q) {
          q.setContents([]);
        }
      }
    );
    if (reactionFileInput) reactionFileInput.value = "";

    loadExperiments(getFilterOptions());
  } catch (err) {
    msg.textContent = "错误：" + err.message;
    msg.style.color = "red";
  }
}

// ---------------- 弹窗：查看 / 编辑实验（与 Quill + 图片 同步） ----------------

function openExperimentModal(exp) {
  currentEditingId = exp.id;
  currentEditingExperiment = exp;

  document.getElementById("edit-id").value = exp.id;
  document.getElementById("edit-title").value = exp.title;
  document.getElementById("edit-date").value = exp.date;
  document.getElementById("edit-msg").textContent = "";

  // Quill 填充 HTML 内容
  if (quillEditObjective) {
    quillEditObjective.setContents([]);
    quillEditObjective.clipboard.dangerouslyPasteHTML(exp.objective || "");
  }
  if (quillEditMaterials) {
    quillEditMaterials.setContents([]);
    quillEditMaterials.clipboard.dangerouslyPasteHTML(exp.materials || "");
  }
  if (quillEditProcedure) {
    quillEditProcedure.setContents([]);
    quillEditProcedure.clipboard.dangerouslyPasteHTML(exp.procedure || "");
  }
  if (quillEditResults) {
    quillEditResults.setContents([]);
    quillEditResults.clipboard.dangerouslyPasteHTML(exp.results || "");
  }
  if (quillEditNotes) {
    quillEditNotes.setContents([]);
    quillEditNotes.clipboard.dangerouslyPasteHTML(exp.notes || "");
  }

  // 反应式预览
  const previewImg = document.getElementById("edit-reaction-preview");
  if (previewImg) {
    if (exp.reaction_image) {
      previewImg.src = exp.reaction_image;
      previewImg.style.display = "block";
    } else {
      previewImg.src = "";
      previewImg.style.display = "none";
    }
  }
  const editFileInput = document.getElementById("edit-reaction-file");
  if (editFileInput) {
    editFileInput.value = "";
  }

  const modal = document.getElementById("experiment-modal");
  modal.classList.remove("hidden");
}

function closeExperimentModal() {
  const modal = document.getElementById("experiment-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  currentEditingId = null;
  currentEditingExperiment = null;
  const msgEl = document.getElementById("edit-msg");
  if (msgEl) msgEl.textContent = "";
}

// 让 HTML 里的 onclick 能调用
window.closeExperimentModal = closeExperimentModal;

async function handleUpdateExperiment(e) {
  e.preventDefault();

  if (!currentEditingId) {
    return;
  }

  const title = document.getElementById("edit-title").value.trim();
  const date = document.getElementById("edit-date").value;
  const msg = document.getElementById("edit-msg");

  const objective = getQuillHtmlOrEmpty(quillEditObjective);
  const materials = getQuillHtmlOrEmpty(quillEditMaterials);
  const procedure = getQuillHtmlOrEmpty(quillEditProcedure);
  const results = getQuillHtmlOrEmpty(quillEditResults);
  const notes = getQuillHtmlOrEmpty(quillEditNotes);

  if (!title || !date) {
    msg.textContent = "实验编号和日期不能为空。";
    msg.style.color = "red";
    return;
  }

  try {
    const editFileInput = document.getElementById("edit-reaction-file");
    // 默认用原来的 URL
    let reactionImageUrl = currentEditingExperiment?.reaction_image || null;

    // 如果用户选择了新图片，则覆盖
    if (editFileInput && editFileInput.files[0]) {
      reactionImageUrl = await uploadReactionImage(editFileInput.files[0]);
    }

    const res = await fetch(`${API_BASE}/experiments/${currentEditingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        date,
        objective,
        materials,
        procedure,
        results,
        notes,
        reaction_image: reactionImageUrl,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "更新失败");
    }

    msg.textContent = "已保存修改。";
    msg.style.color = "green";

    await loadExperiments(getFilterOptions());
    closeExperimentModal();
  } catch (err) {
    msg.textContent = "错误：" + err.message;
    msg.style.color = "red";
  }
}

// ---------------- 初始化 ----------------

function init() {
  // 初始化 Quill（新建）
  quillObjective = new Quill("#objective-editor", quillOptions);
  quillMaterials = new Quill("#materials-editor", quillOptions);
  quillProcedure = new Quill("#procedure-editor", quillOptions);
  quillResults = new Quill("#results-editor", quillOptions);
  quillNotes = new Quill("#notes-editor", quillOptions);

  // 初始化 Quill（编辑弹窗）
  quillEditObjective = new Quill("#edit-objective-editor", quillOptions);
  quillEditMaterials = new Quill("#edit-materials-editor", quillOptions);
  quillEditProcedure = new Quill("#edit-procedure-editor", quillOptions);
  quillEditResults = new Quill("#edit-results-editor", quillOptions);
  quillEditNotes = new Quill("#edit-notes-editor", quillOptions);

  const notebookForm = document.getElementById("notebook-form");
  if (notebookForm) {
    notebookForm.addEventListener("submit", handleCreateNotebook);
  }

  const createForm = document.getElementById("create-form");
  if (createForm) {
    createForm.addEventListener("submit", handleCreateExperiment);
  }

  const applyBtn = document.getElementById("filter-apply");
  const resetBtn = document.getElementById("filter-reset");

  if (applyBtn) {
    applyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loadExperiments(getFilterOptions());
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearFilters();
      loadExperiments();
    });
  }

  const editForm = document.getElementById("edit-form");
  if (editForm) {
    editForm.addEventListener("submit", handleUpdateExperiment);
  }

  const cancelBtn = document.getElementById("edit-cancel");
  if (cancelBtn) {
    cancelBtn.onclick = (e) => {
      e.preventDefault();
      closeExperimentModal();
    };
  }

  loadNotebooks();
}

// 脚本在页面底部引入，DOM 元素已经存在，直接初始化
init();
window.closeExperimentModal = closeExperimentModal;