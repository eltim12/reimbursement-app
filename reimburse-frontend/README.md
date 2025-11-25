# Reimbursement Frontend

Vue 3 + Vuetify frontend for the Reimbursement Tracker application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

3. Build for production:
```bash
npm run build
```

## Features

- List management (create, load, delete)
- Entry management (add, delete)
- Image upload with compression
- PDF export (English and Chinese)
- Responsive design with Vuetify
- Dark theme

## Configuration

The frontend is configured to proxy API requests to `http://localhost:3000` (backend server). This is configured in `vite.config.js`.

