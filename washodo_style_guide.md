# Washodo Ecosystem Style Guide

Based on analysis of `washodo.tv`, `puddotv.com`, and `somewatson.com`, this guide defines the visual language to be used for the Streamer Status page to ensure brand consistency.

## 1. Color Palette
The ecosystem uses a mix of "Modern Clean" (white/gray/sky-blue) and "Dark Mode" (deep grays/purples). For the status page, we will lean into the **Dark Mode** aesthetic to maintain a "dashboard" feel while incorporating brand accents.

| Element | Color | Hex/CSS | Note |
| :--- | :--- | :--- | :--- |
| **Primary Background** | Deep Dark | `#1a1a1a` or `#121212` | Common base for dark themes |
| **Card Background** | Dark Gray | `#2a2a2a` $\rightarrow$ `#333333` | Slight lift from background |
| **Accent Color** | Washodo Purple | `#a970ff` | Primary brand identifier |
| **Secondary Accent** | Sky Blue | `#38bdf8` | Used for links and underlines (`decoration-sky-400`) |
| **Text Primary** | Off-White | `#eee` or `#f3f4f6` | High readability |
| **Text Secondary** | Muted Gray | `#aaa` or `#9ca3af` | For descriptions and meta-data |
| **Live Status** | Alert Red | `#ff4b4b` | Standard "Live" indicator |

## 2. Typography
The sites favor clean, modern sans-serif fonts with occasional serif accents for a "studio" feel.

- **Primary Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `Helvetica`, `Arial`, `sans-serif`.
- **Font Weights**:
    - **Bold (600/700)**: Usernames, Section Titles.
    - **Regular (400)**: Stream titles, descriptions.
- **Styling**: Use of `italic` and `font-serif` for specific brand callouts (e.g., "Wasshoi").

## 3. Component Design (The "Card" Language)
The "creator-card" from `washodo.tv` is the primary reference:

- **Corners**: Consistent use of `border-radius: 8px` to `12px` (rounded but not fully pill-shaped).
- **Borders**: Thin, muted borders (`1px solid #444`) that glow or change color on hover (`border-color: #a970ff`).
- **Avatars**: Circular profile pictures (`border-radius: 50%`) with small status indicators overlaid.
- **Interactions**: 
    - **Hover**: Slight lift effect (`transform: translateY(-3px)`).
    - **Links**: Underlined accents with `underline-offset` and color transitions (Sky Blue $\rightarrow$ Purple).

## 4. Layout Principles
- **Grid**: Responsive grid using `repeat(auto-fill, minmax(..., 1fr))` to handle various screen sizes.
- **Hierarchy**: 
    - Tier Titles $\rightarrow$ Streamer Cards $\rightarrow$ User Meta $\rightarrow$ Status.
- **Spacing**: Generous padding (`15px` to `20px`) and gap (`15px`) to prevent clutter.

## 5. Elements to Incorporate
- **The "Live" Badge**: A small, high-contrast badge with a pulsating red indicator.
- **The Link Style**: `text-decoration: none` on cards, but `underline decoration-sky-400` on specific text links.
- **Thumbnail Aspect Ratio**: 16:9 ratio for stream previews.
