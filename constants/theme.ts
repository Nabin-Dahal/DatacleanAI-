// constants/theme.ts
// This is the single source of truth for all colors in the app.
// Every screen will import from here — change once, updates everywhere.

const theme = {

  // ─── Brand Colors (from your logo) ───────────────────────
  mint: '#7FDEB4',      // Primary green accent — from  logo
  mintDark: '#3DB87A',  // Darker green — used in light mode
  mintSoft: '#7FDEB422',// Green with transparency — for backgrounds
  navy: '#091C3C',      // Deep navy — from your logo

  // ─── Dark Mode Colors ─────────────────────────────────────
  dark: {
    background: '#091C3C', // Main background — deep navy
    surface:    '#0D2447', // Slightly lighter — for cards
    card:       '#112B52', // Card background
    border:     '#1A3A5C', // Lines and dividers
    textPrimary:'#F0F6FF', // Main text — almost white
    textMuted:  '#7B96B8', // Secondary text — grey blue
    textDim:    '#2E4A6B', // Hint text — very faded
    accent:     '#7FDEB4', // Mint green accent
    accentSoft: '#7FDEB422',// Mint with transparency
    error:      '#FF6B6B', // Red — for errors and delete
  },

  // ─── Light Mode Colors ────────────────────────────────────
  light: {
    background: '#F5FAF7', // Main background — soft white green
    surface:    '#FFFFFF', // Cards and surfaces — pure white
    card:       '#EAF5EF', // Card background — light mint
    border:     '#D0E8DC', // Lines and dividers — soft green
    textPrimary:'#091C3C', // Main text — deep navy
    textMuted:  '#4A6B8A', // Secondary text — muted blue
    textDim:    '#8AAABB', // Hint text — very faded
    accent:     '#3DB87A', // Darker mint — pops on white
    accentSoft: '#3DB87A22',// Mint with transparency
    error:      '#FF6B6B', // Red — for errors and delete
  },

  // ─── Spacing ──────────────────────────────────────────────
  // Use these instead of random numbers — keeps layout consistent
  spacing: {
    xs:  4,   // Extra small — tiny gaps
    sm:  8,   // Small — between related items
    md:  16,  // Medium — standard padding
    lg:  24,  // Large — section gaps
    xl:  32,  // Extra large — big sections
    xxl: 48,  // Huge — hero sections
  },

  // ─── Border Radius ────────────────────────────────────────
  // Rounded corners — keeps buttons and cards consistent
  radius: {
    sm:   8,   // Slightly rounded — small buttons
    md:   12,  // Medium — input fields
    lg:   16,  // Large — cards
    xl:   24,  // Extra large — bottom sheets
    full: 999, // Pill shape — tags and badges
  },

  // ─── Font Sizes ───────────────────────────────────────────
  fontSize: {
    xs:    11, // Tiny labels
    sm:    13, // Small text
    md:    15, // Body text
    lg:    18, // Subheadings
    xl:    22, // Headings
    xxl:   28, // Large headings
    xxxl:  36, // Hero text
  },

};

// This line makes the theme available to every other file
export default theme;