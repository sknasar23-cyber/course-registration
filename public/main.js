// main.js - polished
async function fetchCourses() {
  const elCourses = document.getElementById('courses');
  const select = document.querySelector('select[name="course_id"]');
  elCourses.textContent = 'Loading...';
  select.innerHTML = '';

  try {
    const res = await fetch('/api/courses');
    if (!res.ok) throw new Error('Failed to fetch courses');
    const courses = await res.json();
    if (!courses.length) {
      elCourses.innerHTML = '<p>No courses available.</p>';
      return;
    }

    elCourses.innerHTML = '<ul>' + courses.map(c => `<li>${c.code} — ${c.title} (capacity: ${c.capacity})</li>`).join('') + '</ul>';
    courses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.code} - ${c.title}`;
      select.appendChild(opt);
    });
    updateStatusWidget();
  } catch (err) {
    elCourses.innerHTML = `<p class="error">Error loading courses: ${err.message}</p>`;
  }
}

document.getElementById('regForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('message');
  msg.textContent = '';
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Registering...';

  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Registration failed');
    msg.className = 'message success';
    msg.textContent = 'Registered successfully! ID: ' + result.registration_id;
    e.target.reset();
    await fetchCourses();
  } catch (err) {
    msg.className = 'message error';
    msg.textContent = 'Error: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Register';
  }
});

// tiny helper to show total registration count (calls the optional endpoint /api/registrations-count)
async function updateStatusWidget() {
  const box = document.getElementById('statusBox');
  if (!box) return;
  try {
    const res = await fetch('/api/registrations-count');
    if (!res.ok) throw new Error('no status');
    const data = await res.json();
    box.textContent = `${data.count} registrations`;
  } catch (e) {
    // silently fallback to static text
    box.textContent = 'Demo';
  }
}

fetchCourses();
