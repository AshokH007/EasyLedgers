# TALLY Lite - GST Billing & Inventory Management System

A modern, responsive, fast, and easy-to-use GST Billing and Inventory Management System suitable for small businesses, retail stores, distributors, and shops. 

It replicates the ultra-fast workflows of Tally but features a modern Light/Dark dashboard user interface that requires zero training.

---

## Technical Architecture

* **Frontend:** React.js (Vite) + Tailwind CSS v4 + Lucide Icons + Recharts
* **Backend:** Node.js + Express + Multer (Logo Uploads)
* **Database:** Sequelize ORM (SQLite for instant out-of-the-box run, easily swappable to MySQL or PostgreSQL)
* **PDF Export:** jsPDF + jsPDF-AutoTable
* **Print API:** Native Browser Printing with custom print media stylesheet rules for A4, Half-A4, and 58mm/80mm Thermal paper scaling.

---

## Default Login Credentials

Upon first startup, the database is automatically created and populated with demo accounts:

* **Admin User:**
  * **Email/Username:** `admin` or `admin@gstbiller.com`
  * **Password:** `admin123`
  * *Access:* Complete administration, catalog CRUD, margins/profit reports, backup exports, and team user management.
* **Staff User:**
  * **Email/Username:** `staff` or `staff@gstbiller.com`
  * **Password:** `staff123`
  * *Access:* Product/customer lookups, create bills, basic sales list reviews (restricted from settings, profit reports, backups, and user management).

---

## Getting Started

Follow these steps to start the application locally.

### 1. Start the Backend API
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Start the server (this automatically performs Sequelize schema synchronization and inserts bootstrap mock records):
   ```bash
   npm start
   ```
   The backend server runs on port **5000**.

### 2. Start the React Frontend
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Start the development server (pre-configured with `/api` and `/uploads` proxies to port 5000):
   ```bash
   npm run dev
   ```
   Open your browser and navigate to the printed URL (typically `http://localhost:5173`).

---

## Database Configuration (Switching to MySQL or PostgreSQL)

By default, the application runs using **SQLite** (`backend/database.sqlite`) which requires no external database server installations. 

To swap the backend database to **MySQL** or **PostgreSQL**, simply update the environment parameters in `backend/.env`:

```env
# Change database dialect ('mysql' or 'postgres')
DB_DIALECT=mysql

# Database Connection Details
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=gst_biller
```

*Note: Install the database connector driver in the backend folder: `npm install mysql2` for MySQL, or `npm install pg pg-hstore` for PostgreSQL.*

---

## Billing Keyboard Shortcuts

For high-speed shop operations, the Billing page supports standard keyboard shortcuts:

* <kbd>F2</kbd>: Open Quick Customer Creation Modal (or focus select)
* <kbd>F4</kbd>: Insert new item row inside the billing grid
* <kbd>F8</kbd>: Save invoice as **Cash Sale** (Status: Paid) and redirect to Print Preview
* <kbd>F9</kbd>: Save invoice as **Credit Sale** (Status: Unpaid/Outstanding Ledger) and redirect to Print Preview
* <kbd>Escape</kbd>: Close modal dialogues or dropdown selections

---

## Invoice Templates & Design Themes

The system features **5 professionally designed templates** you can swap with one click in the print preview screen:

1. **Classic GST Invoice:** Traditional layout with firm borders, HSN columns, bank details, terms, and receiver signature blocks.
2. **Modern Business:** Navy/emerald accents, spacing-focused grids, clean header blocks, and clear payment metadata labels.
3. **ThermalPOS Receipt:** Compact 58mm/80mm layout with item name truncate rules, dash borders, and POS headers/footers.
4. **Distributor Style:** Specialized columns including packed unit weight, batch codes, delivery challan details, and buyer seals.
5. **Minimal Premium:** Spacious margins, light borders, subtle card containers, elegant header structures, and modern fonts.

---

## Data Backup and Recovery

Admins can download full database dumps directly from **Settings > Backup & Restore**. 
* The backup downloads as a structured portable `.json` file containing all schemas (users, company profiles, products, customers, and invoice ledger rows).
* This backup can be uploaded using **Restore** to migrate the application database between machines, Dialects (SQLite to MySQL/Postgres), or restore to clean states.
