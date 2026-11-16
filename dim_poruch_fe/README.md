# ДімПоруч frontend

React + Vite frontend for the Ukrainian housing rental service.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the backend API URL. For a local backend, use `http://localhost:8080/api/v1`.
3. Start the development server with `npm run dev`.

Run the frontend integration suite with `npm test`.

The app defaults to `http://localhost:8080/api/v1` when no environment value is set. The backend must allow the frontend origin through CORS.

## Implemented areas

- Listing detail pages with photo gallery, owner public profile, amenities, rating, reviews, availability calendar, and protected image loading.
- Registration and login for tenants and landlords, role-based redirects and route guards, persistent access/refresh tokens, shared refresh handling, and logout.
- Tenant bookings, booking cancellation/completion, review creation, notifications, and profile/password/account settings.
- Landlord listing creation/editing, sequential image upload and retry, image deletion/primary selection, listing status controls, booking management, and review replies.
- Admin statistics, paginated listing/review moderation, and user filtering and block/unblock controls.
- Integration coverage for login/token refresh, role guards, listing search, tenant booking creation, landlord booking confirmation, image upload/delete/primary selection, and admin listing moderation.

The backend is the source of truth for authorization and state transitions. API errors are shown in the relevant form or page, and the API URL can be changed without editing individual components.
