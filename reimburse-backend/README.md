# Reimbursement Backend API

Node.js/Express backend for the Reimbursement Tracker application with MySQL database and local image storage.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure MySQL database:
   - Install MySQL if not already installed
   - Create a MySQL database (or use existing)
   - Update `.env` with your MySQL credentials:
     ```
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=your-mysql-password
     DB_NAME=reimbursement_db
     DB_PORT=3306
     ```

4. Initialize the database:
```bash
node database/init.js
```

5. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Features

- MySQL database for data storage
- Local image storage in `public/images/` folder
- Automatic image compression to under 1MB
- Multer for file upload handling
- Sharp for image processing

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/lists` - Get all lists
- `GET /api/lists/:id` - Get a specific list with entries
- `POST /api/lists` - Create a new list
- `PUT /api/lists/:id` - Update a list
- `DELETE /api/lists/:id` - Delete a list
- `POST /api/upload-image` - Upload and compress image (multipart/form-data)
- `DELETE /api/entries/:id` - Delete an entry

## Image Upload

Images are uploaded via `multipart/form-data` with field name `image`. The server will:
1. Accept the uploaded image
2. Compress it to under 1MB
3. Save it to `public/images/` folder
4. Return the URL path (e.g., `/images/filename.jpg`)

Images are automatically compressed using Sharp library with:
- Progressive JPEG encoding
- Quality reduction if needed
- Dimension resizing for very large images
- Multiple compression attempts until under 1MB

## Environment Variables

- `DB_HOST` - MySQL host (default: localhost)
- `DB_USER` - MySQL username (default: root)
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name (default: reimbursement_db)
- `DB_PORT` - MySQL port (default: 3306)
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Database Schema

The database includes two tables:
- `lists` - Stores reimbursement lists
- `entries` - Stores individual reimbursement entries

See `database/schema.sql` for full schema details.

