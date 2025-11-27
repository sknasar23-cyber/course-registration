// main.js - SPA logic for Deccan College (uses /api endpoints)
// Includes admin UI for add/edit/delete courses

const API_BASE = '/api';
const app = document.getElementById('app');
const main = document.getElementById('main');
const navlinks = document.getElementById('navlinks');

// ---------------- auth helpers ----------------
function saveAuth({ token, user }) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function getToken(){ return localStorage.getItem('token'); }
function getUser(){ try { return JSON.parse(localStorage.getItem('user')); } catch(e){ return null; } }
function logout(){
  localStorage.removeItem('token'); localStorage.removeItem('user');
  renderNav();
  routeTo('login');
}
async function api(path, opts = {}) {
  const headers = opts.headers || {};
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (!opts.body || typeof opts.body === 'string') headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  const res = await fetch(API_BASE + path, { ...opts, headers });
  const txt = await res.text();
  let json;
  try { json = txt ? JSON.parse(txt) : null } catch(e){ json = { message: txt } }
  if (!res.ok) throw { status: res.status, body: json };
  return json;
}

// ---------------- render navigation ----------------
function renderNav(){
  const user = getUser();
  navlinks.innerHTML = '';
  const a = (label, onclick) => {
    const el = document.createElement('a');
    el.href = '#';
    el.textContent = label;
    el.addEventListener('click', (e)=>{ e.preventDefault(); onclick(); });
    return el;
  };
  navlinks.appendChild(a('Courses', ()=>routeTo('courses')));
  navlinks.appendChild(a('My Courses', ()=>routeTo('mycourses')));
  if (!user){
    navlinks.appendChild(a('Sign in', ()=>routeTo('login')));
    navlinks.appendChild(a('Sign up', ()=>routeTo('signup')));
  } else {
    const span = document.createElement('span');
    span.className = 'small';
    span.textContent = `${user.name || user.email} (${user.role})`;
    navlinks.appendChild(span);

    // If admin, add admin panel shortcut
    if (user.role === 'admin') {
      navlinks.appendChild(a('Admin', ()=>routeTo('admin')));
    }

    const btn = document.createElement('button');
    btn.className = 'btn-ghost';
    btn.textContent = 'Logout';
    btn.addEventListener('click', logout);
    navlinks.appendChild(btn);
  }
}
renderNav();

// ---------------- small UI helpers ----------------
function showMessage(container, text, type='error'){
  const el = document.createElement('div');
  el.className = `msg ${type==='success'?'success':'error'}`;
  el.textContent = text;
  container.prepend(el);
  setTimeout(()=> el.remove(), 3500);
}

// ---------------- routing ----------------
function clearMain(){ main.innerHTML = ''; }
function routeTo(page){
  if (page === 'courses') return showCourses();
  if (page === 'mycourses') return showMyCourses();
  if (page === 'login') return showLogin();
  if (page === 'signup') return showSignup();
  if (page === 'admin') return showAdmin();
  // default
  showCourses();
}

// ---------------- LOGIN ----------------
function showLogin(){
  clearMain();
  const c = document.createElement('div'); c.className='card';
  c.innerHTML = `
    <h2 class="h2">Sign in</h2>
    <form id="loginForm" class="form">
      <label>Email</label>
      <input id="loginEmail" type="email" required />
      <label>Password</label>
      <input id="loginPass" type="password" required />
      <div style="margin-top:10px">
        <button class="primary" type="submit">Sign in</button>
      </div>
    </form>
    <p class="small">Use admin@example.com / pass1234  or student@example.com / student123</p>
  `;
  main.appendChild(c);

  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value.trim();
    try {
      const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      saveAuth(res);
      renderNav();
      routeTo('courses');
    } catch (err) {
      showMessage(c, err?.body?.message || 'Login failed');
    }
  });
}

// ---------------- SIGNUP ----------------
function showSignup(){
  clearMain();
  const c = document.createElement('div'); c.className='card';
  c.innerHTML = `
    <h2 class="h2">Create account</h2>
    <form id="signupForm" class="form">
      <label>Name</label><input id="suName" type="text" required />
      <label>Email</label><input id="suEmail" type="email" required />
      <label>Password</label><input id="suPass" type="password" required />
      <div style="margin-top:10px"><button class="primary" type="submit">Sign up</button></div>
    </form>
  `;
  main.appendChild(c);

  const form = document.getElementById('signupForm');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name = document.getElementById('suName').value.trim();
    const email = document.getElementById('suEmail').value.trim();
    const password = document.getElementById('suPass').value.trim();
    try {
      const res = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      saveAuth(res);
      renderNav();
      routeTo('courses');
    } catch (err) {
      showMessage(c, err?.body?.message || 'Signup failed');
    }
  });
}

// ---------------- COURSES LIST ----------------
async function showCourses(){
  clearMain();
  const c = document.createElement('div'); c.className='card';
  c.innerHTML = `<h2 class="h2">Available Courses</h2><div id="coursesWrap" class="grid"></div>`;
  main.appendChild(c);
  const wrap = document.getElementById('coursesWrap');

  try {
    const courses = await api('/courses', { method: 'GET' });
    if (!courses || courses.length === 0) {
      wrap.innerHTML = '<p class="small">No courses available yet.</p>';
      return;
    }
    courses.forEach(course => {
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `
        <h3 style="margin:0">${course.code} — ${course.title}</h3>
        <p class="meta">${course.instructorEmail ? `Instructor: ${course.instructorEmail}` : 'Instructor: TBA' } • Seats: ${course.seats || '—'}</p>
        <p>${course.description || ''}</p>
        <div class="center"><button data-id="${course.id}" class="primary">Register</button></div>
      `;
      wrap.appendChild(card);
      const btn = card.querySelector('button');
      btn.addEventListener('click', async ()=>{
        const user = getUser();
        if (!user) { showMessage(card, 'Please sign in to register'); return; }
        if (user.role !== 'student') { showMessage(card, 'Only students can register'); return; }
        try {
          await api(`/register/${course.id}`, { method: 'POST' });
          showMessage(card, 'Registered successfully', 'success');
        } catch (err) {
          showMessage(card, err?.body?.message || 'Registration failed');
        }
      });
    });
  } catch (err) {
    wrap.innerHTML = '<p class="small">Error loading courses</p>';
  }
}

// ---------------- MY COURSES ----------------
async function showMyCourses(){
  clearMain();
  const c = document.createElement('div'); c.className='card';
  c.innerHTML = `<h2 class="h2">My Registered Courses</h2><div id="myWrap" class="grid"></div>`;
  main.appendChild(c);
  const wrap = document.getElementById('myWrap');

  try {
    const regs = await api('/registration/my', { method: 'GET' });
    if (!regs || regs.length === 0) {
      wrap.innerHTML = '<p class="small">No registered courses yet.</p>';
      return;
    }
    regs.forEach(r => {
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `
        <h3 style="margin:0">${r.code || r.courseId} — ${r.title || r.title}</h3>
        <p class="meta">${r.instructorEmail ? `Instructor: ${r.instructorEmail}` : ''}</p>
        <p>${r.description || ''}</p>
        <small class="small">Registered on: ${new Date(r.registeredAt || r.createdAt || r.registeredAt).toLocaleString()}</small>
      `;
      wrap.appendChild(card);
    });
  } catch (err) {
    wrap.innerHTML = '<p class="small">Error loading registrations</p>';
  }
}

// ---------------- ADMIN PANEL (Add / Edit / Delete) ----------------
async function showAdmin(){
  const user = getUser();
  if (!user || user.role !== 'admin') {
    routeTo('login');
    return;
  }

  clearMain();
  const container = document.createElement('div'); container.className='';

  container.innerHTML = `
    <h2 class="h2">Admin — Manage Courses</h2>
    <div class="admin-area">
      <div class="admin-form card">
        <h3 style="margin-top:0">Add / Edit Course</h3>
        <form id="courseForm" class="form">
          <label>Course Code</label><input id="c_code" type="text" required />
          <label>Title</label><input id="c_title" type="text" required />
          <label>Description</label><textarea id="c_desc" rows="4"></textarea>
          <div class="row">
            <div class="col"><label>Seats</label><input id="c_seats" type="number" min="0" value="30" /></div>
            <div class="col"><label>Instructor Email</label><input id="c_instr" type="email" /></div>
          </div>
          <div style="margin-top:10px">
            <button class="primary" type="submit">Save Course</button>
            <button id="cancelEdit" type="button" class="btn-ghost">Cancel Edit</button>
          </div>
        </form>
      </div>

      <div class="admin-list card">
        <h3 style="margin-top:0">Courses</h3>
        <div id="adminCourses" class="grid"></div>
      </div>
    </div>
  `;
  main.appendChild(container);

  const form = document.getElementById('courseForm');
  const cancel = document.getElementById('cancelEdit');
  let editingId = null;

  cancel.addEventListener('click', ()=>{
    editingId = null;
    form.reset();
  });

  async function loadCourses(){
    const wrap = document.getElementById('adminCourses');
    wrap.innerHTML = '';
    try {
      const courses = await api('/courses', { method: 'GET' });
      courses.forEach(c => {
        const card = document.createElement('div'); card.className='card';
        card.innerHTML = `
          <h4 style="margin:0">${c.code} — ${c.title}</h4>
          <p class="meta">${c.instructorEmail ? `Instructor: ${c.instructorEmail}` : 'Instructor: TBA'} • Seats: ${c.seats || '—'}</p>
          <p>${c.description || ''}</p>
          <div style="margin-top:8px">
            <button data-id="${c.id}" class="editBtn">Edit</button>
            <button data-id="${c.id}" class="delBtn danger">Delete</button>
          </div>
        `;
        wrap.appendChild(card);

        card.querySelector('.editBtn').addEventListener('click', ()=>{
          editingId = c.id;
          document.getElementById('c_code').value = c.code || '';
          document.getElementById('c_title').value = c.title || '';
          document.getElementById('c_desc').value = c.description || '';
          document.getElementById('c_seats').value = c.seats || 30;
          document.getElementById('c_instr').value = c.instructorEmail || '';
        });

        card.querySelector('.delBtn').addEventListener('click', async ()=>{
          if (!confirm('Delete this course?')) return;
          try {
            await api(`/courses/${c.id}`, { method: 'DELETE' });
            showMessage(container, 'Deleted', 'success');
            loadCourses();
          } catch (err) {
            showMessage(container, err?.body?.message || 'Delete failed');
          }
        });
      });
    } catch (err) {
      showMessage(container, 'Could not load courses');
    }
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const code = document.getElementById('c_code').value.trim();
    const title = document.getElementById('c_title').value.trim();
    const description = document.getElementById('c_desc').value.trim();
    const seats = parseInt(document.getElementById('c_seats').value || '0', 10);
    const instructorEmail = document.getElementById('c_instr').value.trim();

    try {
      if (!editingId) {
        // add
        await api('/courses', { method: 'POST', body: JSON.stringify({ code, title, description, seats, instructorEmail }) });
        showMessage(container, 'Course added', 'success');
        form.reset();
      } else {
        // edit
        await api(`/courses/${editingId}`, { method: 'PUT', body: JSON.stringify({ code, title, description, seats, instructorEmail }) });
        showMessage(container, 'Course updated', 'success');
        editingId = null;
        form.reset();
      }
      loadCourses();
    } catch (err) {
      showMessage(container, err?.body?.message || 'Save failed');
    }
  });

  // initial load
  loadCourses();
}

// ---------------- initial route ----------------
function init(){
  renderNav();
  // simple hash routing
  function handleRoute(){
    const h = location.hash.replace('#','') || 'courses';
    if (h === 'login') routeTo('login');
    else if (h === 'signup') routeTo('signup');
    else if (h === 'admin') routeTo('admin');
    else if (h === 'my') routeTo('mycourses');
    else routeTo('courses');
  }
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

init();
