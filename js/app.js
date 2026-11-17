// State Management
let questionsData = [];
let syllabusData = null;
let currentQuestionId = "U1-Q1";
let activeFilter = "ALL"; // ALL, UNIT_I, UNIT_II, UNIT_III, UNIT_IV, UNIT_V, 2MARKS, BOOKMARKS, COMPLETED
let activeTab = "exam"; // exam, eli3
let bookmarks = JSON.parse(localStorage.getItem("dis_bookmarks") || "[]");
let completed = JSON.parse(localStorage.getItem("dis_completed") || "[]");

// DOM Elements
const questionsListContainer = document.getElementById("questionsList");
const questionDetailContainer = document.getElementById("questionDetail");
const searchInput = document.getElementById("searchInput");
const progressText = document.getElementById("progressText");
const progressBarFill = document.getElementById("progressBarFill");
const unitsGrid = document.getElementById("unitsGrid");
const filterButtons = document.querySelectorAll(".filter-btn");

// Initialization
async function initApp() {
  try {
    // Attempt fetch first (for HTTP/HTTPS / Live Server)
    const [qRes, sRes] = await Promise.all([
      fetch("data/all_questions.json"),
      fetch("data/syllabus.json")
    ]);
    
    questionsData = await qRes.json();
    syllabusData = await sRes.json();
  } catch (err) {
    console.warn("fetch() failed (likely due to file:// protocol CORS restrictions). Falling back to window embedded data:", err);
    // Fallback to window object injected via js/data.js (works seamlessly via double-click file://)
    if (window.QUESTIONS_DATA && window.SYLLABUS_DATA) {
      questionsData = window.QUESTIONS_DATA;
      syllabusData = window.SYLLABUS_DATA;
    } else {
      console.error("Neither fetch nor embedded data available.");
      questionDetailContainer.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #ef4444;">
          <h3>Failed to load questions data</h3>
          <p>Ensure local JSON files exist in the /data folder or js/data.js is loaded.</p>
        </div>
      `;
      return;
    }
  }

  renderUnitsGrid();
  renderQuestionsList();
  renderQuestionDetail(currentQuestionId);
  updateGlobalProgress();
  setupEventListeners();
}

// Render Dashboard Unit Cards
function renderUnitsGrid() {
  if (!syllabusData || !unitsGrid) return;
  
  unitsGrid.innerHTML = syllabusData.units.map((u, idx) => {
    const unitTag = `UNIT ${["I", "II", "III", "IV", "V"][idx]}`;
    const unitQuestions = questionsData.filter(q => q.unit === unitTag);
    const unitDone = unitQuestions.filter(q => completed.includes(q.id)).length;
    const percent = unitQuestions.length > 0 ? Math.round((unitDone / unitQuestions.length) * 100) : 0;
    
    return `
      <div class="unit-card" onclick="selectUnitFilter('${unitTag}')">
        <div>
          <div class="unit-card-badge">${u.unit}</div>
          <div class="unit-card-title">${u.title}</div>
          <div class="unit-card-topics">
            ${u.topics.slice(0, 3).join(", ")}...
          </div>
        </div>
        <div class="unit-card-footer">
          <span>${u.textbook_chapter.split("(")[0]}</span>
          <span class="unit-count-pill">${unitDone}/${unitQuestions.length} Done (${percent}%)</span>
        </div>
      </div>
    `;
  }).join("");
}

// Filter and Search Logic
function getFilteredQuestions() {
  const query = (searchInput.value || "").trim().toLowerCase();
  
  return questionsData.filter(q => {
    // Filter by category
    let matchesFilter = true;
    if (activeFilter.startsWith("UNIT")) {
      matchesFilter = q.unit === activeFilter;
    } else if (activeFilter === "2MARKS") {
      matchesFilter = q.type === "2-Mark Question";
    } else if (activeFilter === "BOOKMARKS") {
      matchesFilter = bookmarks.includes(q.id);
    } else if (activeFilter === "COMPLETED") {
      matchesFilter = completed.includes(q.id);
    }
    
    // Filter by query
    let matchesQuery = true;
    if (query) {
      const qText = (q.question || "").toLowerCase();
      const kText = (q.keywords || []).join(" ").toLowerCase();
      const uText = (q.unit_title || "").toLowerCase();
      matchesQuery = qText.includes(query) || kText.includes(query) || uText.includes(query);
    }
    
    return matchesFilter && matchesQuery;
  });
}

// Render Question List Sidebar
function renderQuestionsList() {
  const filtered = getFilteredQuestions();
  
  if (filtered.length === 0) {
    questionsListContainer.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-dim); font-size: 0.9rem;">
        No questions matched your search or filter.
      </div>
    `;
    return;
  }
  
  questionsListContainer.innerHTML = filtered.map(q => {
    const isAct = q.id === currentQuestionId;
    const isBookmarked = bookmarks.includes(q.id);
    const isCompleted = completed.includes(q.id);
    
    return `
      <div class="question-item ${isAct ? 'active' : ''}" onclick="selectQuestion('${q.id}')">
        <div class="question-item-top">
          <span class="item-id">${q.id}</span>
          <span class="item-marks">${q.marks}</span>
        </div>
        <div class="question-item-title">${q.question}</div>
        <div class="question-item-status">
          <span>${q.unit}</span>
          ${isBookmarked ? '<span class="status-badge bookmarked">★ Bookmarked</span>' : ''}
          ${isCompleted ? '<span class="status-badge completed">✓ Completed</span>' : ''}
        </div>
      </div>
    `;
  }).join("");
}

// Select Question
function selectQuestion(id) {
  currentQuestionId = id;
  renderQuestionsList();
  renderQuestionDetail(id);
}

// Switch Question Detail
function renderQuestionDetail(id) {
  const q = questionsData.find(item => item.id === id);
  if (!q) return;
  
  const isBookmarked = bookmarks.includes(q.id);
  const isCompleted = completed.includes(q.id);
  
  // Build Exam Answer HTML
  let examHTML = "";
  if (q.type === "2-Mark Question") {
    examHTML = `
      <div class="exam-section">
        <h4>📌 Direct Anna University Definition</h4>
        <p>${q.exam_answer.definition || ""}</p>
      </div>
      ${q.exam_answer.core_objective ? `
        <div class="exam-section">
          <h4>🎯 Core Objective</h4>
          <p>${q.exam_answer.core_objective}</p>
        </div>
      ` : ""}
      ${q.exam_answer.components ? `
        <div class="exam-section">
          <h4>📋 Essential Components</h4>
          <ul>
            ${q.exam_answer.components.map(c => `<li><strong>${c}</strong></li>`).join("")}
          </ul>
        </div>
      ` : ""}
      ${q.exam_answer.definitions ? `
        <div class="exam-section">
          <h4>🔍 Key Distinctions</h4>
          <ul>
            ${q.exam_answer.definitions.map(d => `<li>${d}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      ${q.exam_answer.sub_protocols ? `
        <div class="exam-section">
          <h4>⚙️ Sub-Protocols</h4>
          <ul>
            ${q.exam_answer.sub_protocols.map(s => `<li>${s}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
      ${q.exam_answer.comparison ? `
        <div class="exam-section">
          <h4>⚖️ Comparison</h4>
          <ul>
            ${q.exam_answer.comparison.map(c => `<li>${c}</li>`).join("")}
          </ul>
        </div>
      ` : ""}
    `;
  } else {
    // 13/16 Mark Question
    const a = q.exam_answer;
    examHTML = `
      <div class="exam-section">
        <h4>1. Overview & Conceptual Introduction</h4>
        <p>${a.introduction || ""}</p>
      </div>
      
      ${a.ascii_diagram ? `
        <div class="diagram-box">
          <div class="diagram-header">📐 Architecture / Technical Schematic</div>
          <pre>${a.ascii_diagram}</pre>
        </div>
      ` : ""}

      ${a.characteristics ? `
        <div class="exam-section">
          <h4>2. Detailed Analysis of Characteristics</h4>
          ${a.characteristics.map(c => `
            <div class="exam-sub-item">
              <h5>${c.name}</h5>
              <p>${c.description}</p>
              <p style="color: var(--accent-cyan); font-size: 0.82rem;"><strong>Key Mechanisms:</strong> ${c.key_aspects}</p>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.dimensions ? `
        <div class="exam-section">
          <h4>2. Structural Dimensions of McCumber Cube</h4>
          ${a.dimensions.map(d => `
            <div class="exam-sub-item">
              <h5>${d.dimension_name}</h5>
              <ul>${d.details.map(i => `<li>${i}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.components_and_security ? `
        <div class="exam-section">
          <h4>2. System Components & Protective Controls</h4>
          ${a.components_and_security.map(cs => `
            <div class="exam-sub-item">
              <h5>${cs.component}</h5>
              <p>${cs.description}</p>
              <ul>${cs.security_methods.map(m => `<li>${m}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.phases ? `
        <div class="exam-section">
          <h4>2. Step-by-Step Security SDLC Phases</h4>
          ${a.phases.map(p => `
            <div class="exam-sub-item">
              <h5>${p.phase_number}</h5>
              <p><strong>SDLC Baseline:</strong> ${p.sdlc_focus}</p>
              <ul>${p.security_focus.map(sf => `<li>${sf}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.the_four_vital_business_needs ? `
        <div class="exam-section">
          <h4>2. The Four Vital Business Imperatives</h4>
          ${a.the_four_vital_business_needs.map(n => `
            <div class="exam-sub-item">
              <h5>${n.need}</h5>
              <p>${n.description}</p>
              <ul>${n.key_aspects.map(ka => `<li>${ka}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.major_threat_categories ? `
        <div class="exam-section">
          <h4>2. Comprehensive Threat Taxonomy</h4>
          ${a.major_threat_categories.map(t => `
            <div class="exam-sub-item">
              <h5>${t.category}</h5>
              <ul>${t.details.map(d => `<li>${d}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.sections ? `
        <div class="exam-section">
          <h4>2. Legal, Ethical and Professional Facets</h4>
          ${a.sections.map(s => `
            <div class="exam-sub-item">
              <h5>${s.section_title}</h5>
              <ul>${s.points.map(p => `<li>${p}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.acm_fundamentals ? `
        <div class="exam-section">
          <h4>2. Access Control Matrix Mechanics</h4>
          <ul>${a.acm_fundamentals.definitions.map(d => `<li>${d}</li>`).join("")}</ul>
          <div class="diagram-box">
            <div class="diagram-header">Access Control Matrix Table M[S, O]</div>
            <pre>${a.acm_fundamentals.matrix_diagram}</pre>
          </div>
          <p><strong>Decomposition Implementations:</strong></p>
          <ul>${a.acm_fundamentals.implementations.map(imp => `<li>${imp}</li>`).join("")}</ul>
        </div>
      ` : ""}

      ${a.security_policies_taxonomy ? `
        <div class="exam-section">
          <h4>3. Security Policy Models</h4>
          ${a.security_policies_taxonomy.map(sp => `
            <div class="exam-sub-item">
              <h5>${sp.policy_type}</h5>
              <p>${sp.purpose}</p>
              ${sp.axioms ? `<ul>${sp.axioms.map(ax => `<li>${ax}</li>`).join("")}</ul>` : ""}
              ${sp.biba_model ? `<ul>${sp.biba_model.map(b => `<li>${b}</li>`).join("")}</ul>` : ""}
              ${sp.mechanism ? `<ul>${sp.mechanism.map(m => `<li>${m}</li>`).join("")}</ul>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.digital_signature_variants ? `
        <div class="exam-section">
          <h4>2. Digital Signature Variants</h4>
          ${a.digital_signature_variants.map(v => `
            <div class="exam-sub-item">
              <h5>${v.variant_name}</h5>
              <p>${v.concept}</p>
              ${v.operation ? `<ul>${v.operation.map(o => `<li>${o}</li>`).join("")}</ul>` : ""}
              ${v.mathematical_steps ? `<ul>${v.mathematical_steps.map(ms => `<li><code>${ms}</code></li>`).join("")}</ul>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.dsa_algorithm_details ? `
        <div class="exam-section">
          <h4>2. Digital Signature Algorithm (DSA) Specifications</h4>
          ${a.dsa_algorithm_details.map(d => `
            <div class="exam-sub-item">
              <h5>${d.step}</h5>
              <ul>${d.math.map(m => `<li><code>${m}</code></li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.protocol_categories ? `
        <div class="exam-section">
          <h4>2. Protocol Architectures</h4>
          ${a.protocol_categories.map(pc => `
            <div class="exam-sub-item">
              <h5>${pc.category}</h5>
              <p>${pc.description}</p>
              ${pc.steps ? `<ul>${pc.steps.map(st => `<li><code>${st}</code></li>`).join("")}</ul>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.kerberos_architecture ? `
        <div class="exam-section">
          <h4>2. Kerberos Protocol Dialogue</h4>
          <p><strong>Entities:</strong></p>
          <ul>${a.kerberos_architecture.key_entities.map(e => `<li>${e}</li>`).join("")}</ul>
          <p style="margin-top:0.75rem;"><strong>6-Step Ticket Flow:</strong></p>
          <ul>${a.kerberos_architecture.authentication_dialogue_steps.map(st => `<li><code>${st}</code></li>`).join("")}</ul>
        </div>
      ` : ""}

      ${a.the_five_operational_services ? `
        <div class="exam-section">
          <h4>2. The Five PGP Operational Services</h4>
          ${a.the_five_operational_services.map(s => `
            <div class="exam-sub-item">
              <h5>${s.service}</h5>
              ${s.steps ? `<ul>${s.steps.map(st => `<li>${st}</li>`).join("")}</ul>` : ""}
              ${s.details ? `<ul>${s.details.map(dt => `<li>${dt}</li>`).join("")}</ul>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.smime_content_types ? `
        <div class="exam-section">
          <h4>2. S/MIME Content Types</h4>
          ${a.smime_content_types.map(sc => `
            <div class="exam-sub-item">
              <h5>${sc.type}</h5>
              <p>${sc.description}</p>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.ah_protocol && a.esp_protocol ? `
        <div class="exam-section">
          <h4>2. Detailed AH and ESP Specifications</h4>
          <div class="exam-sub-item">
            <h5>${a.ah_protocol.name}</h5>
            <p>${a.ah_protocol.purpose}</p>
            <ul>${a.ah_protocol.fields.map(f => `<li>${f}</li>`).join("")}</ul>
          </div>
          <div class="exam-sub-item">
            <h5>${a.esp_protocol.name}</h5>
            <p>${a.esp_protocol.purpose}</p>
            <ul>${a.esp_protocol.fields.map(f => `<li>${f}</li>`).join("")}</ul>
          </div>
        </div>
      ` : ""}

      ${a.ipsec_modes ? `
        <div class="exam-section">
          <h4>2. IPSec Operational Modes</h4>
          ${a.ipsec_modes.map(m => `
            <div class="exam-sub-item">
              <h5>${m.mode}</h5>
              <p>${m.description}</p>
              <p><code>Structure: ${m.packet_structure}</code></p>
              <p style="color: var(--accent-cyan); font-size: 0.85rem;"><strong>Primary Application:</strong> ${m.use_case}</p>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.ssl_protocol_stack_layers ? `
        <div class="exam-section">
          <h4>2. SSL Protocol Stack Layers</h4>
          ${a.ssl_protocol_stack_layers.map(l => `
            <div class="exam-sub-item">
              <h5>${l.layer}</h5>
              <ul>${l.details.map(d => `<li>${d}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.the_four_handshake_phases ? `
        <div class="exam-section">
          <h4>2. Four Phases of SSL Handshake</h4>
          ${a.the_four_handshake_phases.map(hp => `
            <div class="exam-sub-item">
              <h5>${hp.phase}</h5>
              <ul>${hp.details.map(d => `<li>${d}</li>`).join("")}</ul>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${a.working_of_modern_tls ? `
        <div class="exam-section">
          <h4>2. TLS Mechanics & Fast Handshakes</h4>
          <div class="exam-sub-item">
            <h5>TLS 1.2 vs. TLS 1.3 Latency Optimization</h5>
            <ul>${a.working_of_modern_tls.tls12_vs_tls13_handshake.map(h => `<li>${h}</li>`).join("")}</ul>
          </div>
        </div>
      ` : ""}

      ${a.dual_signature_concept ? `
        <div class="exam-section">
          <h4>2. Dual Signature Mechanics</h4>
          <p>${a.dual_signature_concept.purpose}</p>
          <div class="exam-sub-item">
            <h5>Generation Mathematical Steps</h5>
            <ul>${a.dual_signature_concept.generation_steps.map(g => `<li><code>${g}</code></li>`).join("")}</ul>
          </div>
        </div>
      ` : ""}

      ${a.conclusion ? `
        <div class="exam-section">
          <h4>3. Concluding Examination Summary</h4>
          <p>${a.conclusion}</p>
        </div>
      ` : ""}
    `;
  }

  // Build ELI3 HTML
  let eli3HTML = "";
  if (q.simple_explanation.story || q.simple_explanation.analogy_title) {
    const se = q.simple_explanation;
    eli3HTML = `
      <div class="eli3-container">
        <div class="eli3-story-box">
          <div class="eli3-story-title">🧸 ${se.analogy_title}</div>
          <div class="eli3-story-text">${se.analogy_story}</div>
        </div>

        <div>
          ${se.points.map((p, idx) => `
            <div class="eli3-point">
              <div class="eli3-icon">${idx + 1}</div>
              <div class="eli3-point-body">
                <h5>${p.feature}</h5>
                <p>${p.meaning}</p>
              </div>
            </div>
          `).join("")}
        </div>

        <div class="eli3-takeaway">
          <span style="font-size: 1.5rem;">💡</span>
          <div class="eli3-takeaway-text"><strong>Key Memory Anchor:</strong> ${se.takeaway}</div>
        </div>
      </div>
    `;
  } else {
    // 2-mark simple explanation
    eli3HTML = `
      <div class="eli3-container">
        <div class="eli3-story-box">
          <div class="eli3-story-title">🧸 Super Simple Picture</div>
          <p style="font-size: 1.05rem; line-height: 1.7; color: #f8fafc; margin-top: 0.5rem;">
            ${q.simple_explanation.meaning}
          </p>
        </div>
      </div>
    `;
  }

  questionDetailContainer.innerHTML = `
    <div class="detail-header">
      <div class="detail-tags">
        <span class="tag-badge unit">${q.unit}</span>
        <span class="tag-badge">${q.unit_title}</span>
        <span class="tag-badge" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald);">${q.marks}</span>
        <span class="tag-badge" style="background: rgba(6, 182, 212, 0.2); color: var(--accent-cyan);">${q.syllabus_ref}</span>
      </div>

      <h2 class="detail-question-text">${q.question}</h2>

      <div class="detail-meta-row">
        <span>Source: <strong>Anna University Bagad & Dhotre Prescribed Syllabus</strong></span>
        
        <div class="action-buttons">
          <button class="btn-action ${isBookmarked ? 'active-bookmark' : ''}" onclick="toggleBookmark('${q.id}')">
            <span>${isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}</span>
          </button>
          
          <button class="btn-action ${isCompleted ? 'active-completed' : ''}" onclick="toggleCompleted('${q.id}')">
            <span>${isCompleted ? '✓ Completed' : '○ Mark as Read'}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="answer-tabs">
      <button class="tab-btn ${activeTab === 'exam' ? 'active' : ''}" onclick="switchTab('exam')">
        <span>📝 Anna University Exam Answer</span>
      </button>
      <button class="tab-btn eli3-tab ${activeTab === 'eli3' ? 'active' : ''}" onclick="switchTab('eli3')">
        <span>🧸 Explain Like I'm 3</span>
      </button>
    </div>

    <div id="examTab" class="tab-content ${activeTab === 'exam' ? 'active' : ''}">
      ${examHTML}
    </div>

    <div id="eli3Tab" class="tab-content ${activeTab === 'eli3' ? 'active' : ''}">
      ${eli3HTML}
    </div>

    ${q.keywords && q.keywords.length > 0 ? `
      <div class="keywords-container">
        <span style="font-size: 0.75rem; color: var(--text-dim); margin-right: 0.4rem; align-self: center;">Key Exam Keywords:</span>
        ${q.keywords.map(kw => `<span class="keyword-badge">#${kw}</span>`).join("")}
      </div>
    ` : ""}
  `;
}

// Tab Switching
function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
  
  if (tabName === "exam") {
    document.querySelectorAll(".tab-btn")[0]?.classList.add("active");
    document.getElementById("examTab")?.classList.add("active");
  } else {
    document.querySelectorAll(".tab-btn")[1]?.classList.add("active");
    document.getElementById("eli3Tab")?.classList.add("active");
  }
}

// User Actions: Bookmarks & Completed
function toggleBookmark(id) {
  if (bookmarks.includes(id)) {
    bookmarks = bookmarks.filter(b => b !== id);
  } else {
    bookmarks.push(id);
  }
  localStorage.setItem("dis_bookmarks", JSON.stringify(bookmarks));
  renderQuestionsList();
  renderQuestionDetail(id);
}

function toggleCompleted(id) {
  if (completed.includes(id)) {
    completed = completed.filter(c => c !== id);
  } else {
    completed.push(id);
  }
  localStorage.setItem("dis_completed", JSON.stringify(completed));
  renderUnitsGrid();
  renderQuestionsList();
  renderQuestionDetail(id);
  updateGlobalProgress();
}

function updateGlobalProgress() {
  if (questionsData.length === 0) return;
  const count = completed.length;
  const total = questionsData.length;
  const pct = Math.round((count / total) * 100);
  
  if (progressText) progressText.innerText = `${count}/${total} Done (${pct}%)`;
  if (progressBarFill) progressBarFill.style.width = `${pct}%`;
}

// Select Unit Filter from Cards or Buttons
function selectUnitFilter(filterKey) {
  activeFilter = filterKey;
  filterButtons.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === filterKey);
  });
  
  // Select first question of this unit if available
  const filtered = getFilteredQuestions();
  if (filtered.length > 0) {
    currentQuestionId = filtered[0].id;
  }
  
  renderQuestionsList();
  if (filtered.length > 0) {
    renderQuestionDetail(currentQuestionId);
  }
}

// Event Listeners
function setupEventListeners() {
  searchInput.addEventListener("input", () => {
    renderQuestionsList();
  });

  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const filter = btn.getAttribute("data-filter");
      selectUnitFilter(filter);
    });
  });
}

// Syllabus Modal Toggles
function openSyllabusModal() {
  const modal = document.getElementById("syllabusModal");
  if (!modal || !syllabusData) return;
  
  const modalBody = document.getElementById("syllabusModalBody");
  modalBody.innerHTML = syllabusData.units.map(u => `
    <div class="modal-unit-block">
      <h4>${u.unit} - ${u.title}</h4>
      <p style="font-size: 0.8rem; color: var(--accent-cyan); margin-bottom: 0.4rem;">${u.textbook_chapter}</p>
      <ul>
        ${u.topics.map(t => `<li>${t}</li>`).join("")}
      </ul>
    </div>
  `).join("");
  
  modal.classList.add("active");
}

function closeSyllabusModal() {
  document.getElementById("syllabusModal")?.classList.remove("active");
}

// Run on page load
window.addEventListener("DOMContentLoaded", initApp);
