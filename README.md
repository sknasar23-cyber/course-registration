# Course Registration — College Project

## Project summary
A simple Course Registration web application built with Node.js, Express and SQLite.
Students can view available courses and register. Backend persists students and registrations in an SQLite database.

## Folder structure
course-registration/
├─ server.js
├─ package.json
├─ database.sqlite
├─ seed/seed.sql
├─ public/
│ ├─ index.html
│ ├─ main.js
│ └─ styles.css
└─ README.md

css
Copy code

## How to run (Windows)
1. Open **Command Prompt** (or VS Code terminal) and go to the project folder:
cd C:\Users<YourUser>\OneDrive\Desktop\course-registration

java
Copy code
2. Install dependencies (only if not already installed):
npm install

markdown
Copy code
3. Start the server:
node server.js

markdown
Copy code
4. Open the web page in your browser:
http://localhost:3000

markdown
Copy code

## API Endpoints (for testing)
- `GET /api/courses` — returns JSON list of courses  
- `POST /api/register` — register a student  
  - body (JSON): `{ "name": "Full Name", "email": "you@example.com", "course_id": 1 }`

## Notes for grading
- The file `database.sqlite` contains the seeded courses and any registrations you made while testing.
- If the grader wants to re-seed the DB, run the SQL inside `seed/seed.sql` or delete `database.sqlite` and restart the server (it will be re-created and seeded).

## Troubleshooting
- If `npm` command fails in PowerShell, use Command Prompt or set execution policy for the session:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

arduino
Copy code
- If port 3000 is in use, stop the other program or change the `PORT` environment variable before running:
set PORT=4000
node server.js

markdown
Copy code

## What I submitted
- A working Node.js backend (`server.js`)
- Frontend files in `public/`
- SQLite DB with seed data (`database.sqlite`)
- SQL seed file (`seed/seed.sql`)