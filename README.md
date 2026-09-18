# Team Elite Stats Mobile App

Mobile app foundation for Team Elite Stats.

The app is designed to reuse the existing Team Elite Stats web application and backend while providing a dedicated mobile experience.

## Architecture
- Existing Next.js website remains unchanged.
- Mobile client will reuse the existing API/backend and production data.
- Capacitor will be used for the Android/iOS native shell.
- Native capabilities such as push notifications can be added without creating a second database.

## Planned structure
- `mobile-app/` — mobile-specific configuration and native project files.
- Existing `app/api/` — shared backend API.
- Existing MongoDB/Cloudinary setup — shared production data and media.

This directory is the initial mobile-app foundation; native platform projects are generated locally/CI from the approved Capacitor configuration.
