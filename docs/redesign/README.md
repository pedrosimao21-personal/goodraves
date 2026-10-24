# Goodraves redesign: "Flyer, not dashboard"

Reference for the visual redesign, exported from the design canvas on 21 October 2026.
The live canvas (with pan/zoom and clickable prototypes) is at
https://claude.ai/artifact/7kxBLW8RMUHmGnyyxWuWjo. This folder is a snapshot of it; if
the two disagree, check which one changed last.

**Key principle:** colour marks state and action, never decoration. Lime has two jobs:
what is *yours* (picked, rated, followed, attended) and the one primary action per
screen. Everything else is black, white and grey.

## What's in `boards/`

One `*.dc.html` file per artboard, plus `canvas.json` (board titles, sizes, which page
of the canvas each one sits on). The files are the canvas's own source format, so they
don't render on their own: they need the canvas runtime (`support.js`), which isn't
included. Read them as source instead:

- Styling is in the `<helmet><style>` block (shared classes like `.btn`, `.chip`, `.m`)
  and in inline `style` attributes.
- `{{holes}}` are filled from the `renderVals()` script at the bottom of each file. That
  script holds the mock data for the screen.
- `<sc-for>` is a loop, `<sc-if>` a conditional, `<dc-import name="X">` embeds `X.dc.html`
  (used for the nav and tab bar).

To see a board rendered, open the canvas link above.

## Tokens

### Dark (default)

| Token | Value | Use |
|---|---|---|
| Ground | `#0B0B0C` | Page background |
| Surface | `#141416` | Cards, panels, inputs |
| Raised | `#1C1C1F` | Avatars, timetable blocks |
| Empty | `#2C2C31` | Unlit rating bars, skeletons |
| Text | `#F2F0EA` | Body text, active tab underline |
| Text 2 | `#BAB8B0` | Secondary text |
| Text 3 | `#94928A` | Meta, labels |
| Line | `rgba(242,240,234,.10)` | Hairlines |
| Line 2 | `rgba(242,240,234,.22)` | Borders on controls |
| Acid | `#D4FF3F` | Yours + primary action |
| Lilac | `#B2A6FF` | Going |
| Signal | `#FF9A52` | Clash, warnings |
| Error | `#FF7A7A` | Admin only (cron errors, destructive admin actions) |
| Off | `#77756E` | Notches on the rating fader's rail |

### Light

Lime fails contrast on paper, so in light mode it is only a fill behind black text.
Where dark mode draws lime as a line or text, light mode uses olive.

| Token | Value |
|---|---|
| Paper | `#F4F2EC` |
| Surface | `#FFFFFF` |
| Raised | `#EAE7DF` |
| Empty | `#D6D3CA` |
| Text / 2 / 3 | `#0B0B0C` / `#4A4842` / `#6B6962` |
| Olive (lines, ratings, following) | `#4F6B00` |
| Going | `#5B4BD6` |
| Clash | `#B4470C` |

Primary button in light mode: black background, lime text.

### Type

- **Display:** Archivo, width 68%, weight 800, uppercase, line-height 0.9. All festival and
  artist names, uppercase, artists included.
- **Body:** Archivo 100%, 400, 15px / 1.5.
- **Mono:** JetBrains Mono 500, 11px, uppercase, 0.08em tracking. Every date, set time,
  count and label.
- Nothing below 11px. Page titles are 56px desktop / 40px mobile; display sizes above that
  are only for festival and artist names (and the Discover headline).
- Long names step down a size; subtitles (e.g. "Day 2 · Area V") drop to body type.

### Shape

- Radius 2px everywhere. No gradients, no glow, no shadows, no emoji icons (inline
  stroke SVGs instead).
- Touch targets at least 44px.

## Component rules

- **Going toggle:** outline "+ Going" when off, lilac outline with a check when on.
  Always `aria-pressed`.
- **Follow:** one control everywhere. The label is always "Follow" (so the button keeps
  its width); outline heart = not following, filled lime button with a filled heart =
  following; icon-only in dense lists.
- **Rating:** a volume meter of ten ascending bars, one per half point (0.5 to 5; the
  festival "vibe" rating stays whole numbers). Lit bars take their colour from their
  position, green through yellow and orange to red; unlit bars are grey. Input = the
  fader: the meter with a cap on a rail below. Tap to set the nearest half point (tapping
  the current value clears it) or drag sideways; vertical swipes still scroll, so it is
  safe in lineup grids. A hollow cap parked at the left means unrated. Tapping on a past
  festival also marks the set as seen. Display = the same meter without the fader; an
  average such as 4.6 lights the nearest half point.
- **Tabs and segmented controls:** active tab is a white underline (black in light);
  segmented "on" is a white fill. Tabs use `role="tab"` + `aria-selected`; filters and
  sorts are toggle groups with `aria-pressed`.
- **"Near you":** neutral chip with a pin icon, not lime.
- **Flyer images:** cards crop square from the top, so the bottom of a portrait flyer is
  cut. Cards always repeat date and venue as text. The festival page shows the full flyer.
- **Clashes:** overlapping picks are grouped in one orange box with the overlap time.
- **B2B sets:** one slot, one set rating, split avatar, `B2B` tag in the timetable,
  names joined with "&" (three or more: "BLEEK + 2"). See `B2B.dc.html`.

## Boards by route

| Route | Boards |
|---|---|
| Design language | `Main`, `ThemeLight`, `DiscoverMobileLight`, `NavDesktop`, `TabBar`, `B2B`, `AccountMenu` |
| `/` Discover | `Discover`, `DiscoverMobile`, `States`, `StatesMobile` |
| `/festival/[id]` | `Festival`, `FestivalMobile`, `FestivalAttendedMobile`, `FestivalLiveMobile` |
| `/artist/[id]/[name]` | `Artist`, `ArtistMobile` |
| `/dashboard` My festivals | `MyFestivals`, `MyFestivalsMobile` |
| `/following` | `Following`, `FollowingMobile` |
| `/top-djs`, `/insights` (one "Stats" section) | `TopDJs`, `TopDJsMobile`, `Insights`, `InsightsMobile` |
| `/friends` | `Friends`, `FriendsMobile` |
| `/profile` | `Profile`, `ProfileMobile` |
| First-run empty states | `MyFestivalsEmpty`, `MyFestivalsEmptyMobile`, `FollowingEmptyMobile`, `FriendsEmptyMobile` |
| `/admin`, `/admin/duplicates` | `Admin`, `AdminDuplicates`, `AdminSheetMobile` |
| `/login`, `/register` | `Login`, `LoginMobile` |

## Decisions that change behaviour (not only looks)

These need code or data work beyond restyling, so they're worth scoping separately:

1. **Navigation:** five sections instead of six. Top DJs and Insights merge into "Stats"
   with two tabs. Profile, theme, admin and sign-out move into an account menu behind the
   avatar.
2. **Festival page, "Your schedule":** picks per day in time order, free gaps, clashes
   grouped. Mobile defaults to this view ("My schedule / By stage / A–Z").
3. **Timetable hour range** comes from each day's first and last slot instead of a fixed
   range.
4. **Live mode:** while a festival you're going to is running, the mobile page opens with
   Now / Next / "just finished, rate it". Rating during the festival means marking a set as
   seen before the festival is over, which the app doesn't allow today. No walking times:
   we have no stage-distance data.
5. **Discover social:** cards show friends going ("anna + 2 going"), a "Friends going"
   filter, and on mobile a "Your next festival" strip and a "Friends are going" row.
6. **Artist page, Upcoming:** RA upcoming shows are merged into our saved upcoming events
   (deduped by date and venue), with a source label per row. No separate RA section.
7. **Artist page, "Your sets":** your history with that artist and your rating per set.
8. **Attended state:** a status row instead of a big toggle; removing the festival moves to
   a "⋯" menu.
9. **Empty states** use two lists that need queries: "Popular near you" and "Most followed
   on Goodraves".

## Not designed yet

Timeline tab, the modals (ratings list, DJ history, custom event form), register (same as
log in), not-found and error pages, and light-mode versions of most screens beyond the
token board and Discover mobile.
