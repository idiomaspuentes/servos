# App colours for long reading and writing: light mode, dark mode and a brand colour for Servos

Notes for the report writer. Values marked **[computed]** come from my own calculations in this session, not from a
source. Formulas: WCAG 2.x relative luminance and contrast ratio; APCA 0.0.98G-4g constants (the APCA reference
implementation, https://github.com/Myndex/apca-w3); OKLab/OKLCH (Björn Ottosson, https://bottosson.github.io/posts/oklab/);
colour-vision-deficiency simulation with the Machado, Oliveira & Fernandes 2009 matrices at severity 1.0
(https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html). I did not re-fetch these method
references in this session. "ΔE" below is the OKLab distance × 100. As a rough guide, ~2 is barely noticeable and
below ~5 is easy to confuse at a glance. APCA Lc is negative for light text on a dark ground; only the magnitude
counts. Grounds used for the checks: current light ground #f4efe4 and current dark ground #0f1a20 unless stated.

## 1. Light mode for long reading: white, off-white or sepia, and how much contrast

### Takeaway
Dark text on a light ground (positive polarity) has the best evidence for reading performance in people with normal
vision. The advantage is largest for small text, and readers do not notice it. No good evidence shows that off-white
or sepia is more comfortable than white. Off-white or warm paper is a convention in reading apps, and it cuts the light
the screen emits by about 13 %. Sepia themes deliberately drop contrast to about 7.3–7.5:1 (APCA Lc ~80). That is fine
indoors and weak in the sun. For scripture and long writing, aim for WCAG 10–15:1 and APCA Lc 90–100. Servos already
sits there (#1f2a30 on #f4efe4 = 12.8:1, Lc 92).

### Cited Findings
- Piepenbrock et al. 2013 (*Ergonomics*) tested younger (18–33) and older (60–85) adults with normal or corrected vision. Positive polarity (light mode) won on a visual-acuity task and on proofreading in both age groups. Fatigue showed no significant difference between polarities. — [NN/g, Dark Mode vs. Light Mode](https://www.nngroup.com/articles/dark-mode/)
- Piepenbrock, Mayr & Buchner 2013 (*Human Factors*): the light-mode advantage grew linearly as font size shrank, yet participants reported no difference in readability. — [NN/g](https://www.nngroup.com/articles/dark-mode/)
- Dobres, Chahine & Reimer 2017 (*Applied Ergonomics*): under simulated daytime light, polarity had no significant effect on glanceable reading. At night, light mode did better and small text was much harder to read in dark mode. — [NN/g](https://www.nngroup.com/articles/dark-mode/)
- Aleman, Wang & Schaeffel 2018 (*Scientific Reports*, n = 7): an hour of reading in light mode thinned the choroid, a change linked to myopia. Dark mode thickened it. The sample is tiny, so treat this as tentative. — [NN/g](https://www.nngroup.com/articles/dark-mode/)
- NN/g does not recommend dark mode as the default for a general audience. It says users should be able to switch, that long-form reading apps should offer dark mode, and that the app should use the OS dark-mode setting. NN/g ran no study of its own; this is a literature review. — [NN/g](https://www.nngroup.com/articles/dark-mode/)
- Rello & Bigham 2017 (ASSETS) studied 341 **Spanish native speakers** aged 18–60 (89 with dyslexia, 252 controls). Warm backgrounds (peach, orange, yellow) significantly improved reading performance over cool ones (blue, blue-grey, green), measured by reading time and mouse distance. A secondary summary gives peach as the fastest for readers with dyslexia (14.85 s), but I could not verify that figure against the paper. Some citing papers reverse the finding by mistake. — [Rello & Bigham 2017 PDF](https://www.changedyslexia.org/publications/pdfs/2017-ASSETS-Good%20Background%20Colors.pdf)
- Kindle for PC sepia (2011): background #FBF0D9, text #5F4B32. The source is an old forum post, so current apps may differ. — [MobileRead forum](https://www.mobileread.com/forums/showthread.php?p=1418540)
- Kindle's iOS and macOS apps offer White, Black and Sepia colour modes, which override the book's own CSS background colours. — [MobileRead forum, 2018](https://www.mobileread.com/forums/showthread.php?p=3697324)
- Firefox Reader View themes, from the source code:
  - Light: #fff ground, rgb(21,20,26) text (#15141A), link rgb(0,97,224).
  - Sepia: rgb(244,236,216) ground (#F4ECD8), rgb(91,70,54) text (#5B4636).
  - Dark: rgb(28,27,34) ground (#1C1B22), rgb(251,251,254) text (#FBFBFE).
  - Contrast: #000 ground, #fff text.
  - — [Mozilla searchfox, aboutReader.css](https://searchfox.org/mozilla-central/source/toolkit/themes/shared/aboutReader.css)
- Apple Books has six themes: Original (white ground, black text), Quiet, Paper (a "grayish tan"), Bold, Calm and Focus. Apple publishes no hex values. One developer estimated the Focus ground at #FFFCF4, unconfirmed. — [iPhoneLife](https://iphonelife.com/content/how-to-customize-themes-apple-books-app-iphone); [Apple Developer Forums](https://developer.apple.com/forums/thread/730524)
- Apple HIG asks for at least 4.5:1, and says to "strive for a contrast ratio of 7:1, especially in small text" with custom colours. — [Apple HIG, Dark Mode](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/dark-mode.md)
- APCA: Lc 90 is preferred for fluent body text and Lc 75 is the minimum for columns of body text. Small fonts have no maximum. Lc 90 is a suggested *maximum* only for very large or bold text and large areas of colour. — [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)

### Inferences
- **[computed]** Contrast of reference pairs:

  | Pair | WCAG | APCA |
  |---|---|---|
  | Servos text #1f2a30 on ground #f4efe4 | 12.79:1 | Lc 92 |
  | Servos text on card #fffdf8 | 14.42:1 | Lc 100 |
  | Kindle PC sepia #5f4b32 on #fbf0d9 | 7.31:1 | Lc 80 |
  | Firefox sepia #5b4636 on #f4ecd8 | 7.51:1 | Lc 79 |
  | Firefox light #15141a on #fff | 18.31:1 | Lc 105 |
  | Pure black on pure white | 21:1 | Lc 106 |

- **[computed]** In OKLCH, the current ground #f4efe4 is oklch(0.953 0.016 86) with CIE L* 94.6 and relative luminance 0.866. That is 13 % less emitted light than white. Kindle sepia #fbf0d9 is oklch(0.958 0.032 85), about twice the chroma, so it reads as visibly yellow. Firefox sepia #f4ecd8 is oklch(0.944 0.028 89).
- A practical light-ground band for Servos is OKLCH L 0.95–0.97, C 0.008–0.020, hue 80–90 (warm paper). Cards can sit at L 0.985–0.995. Body text works at L 0.20–0.28 with a slight cool or neutral tint, giving 12–16:1 and Lc 92–102. Sepia (C ≈ 0.03, brown text at ~7.5:1) fits better as an optional reading theme than as the default, because it gives up contrast that matters outdoors (see section 4).
- The Rello & Bigham result was measured on Spanish speakers and favours warm grounds. It weakly supports keeping a warm off-white rather than moving to a cool grey or bluish white. Their tints were stronger than a paper tone, so do not over-extrapolate.
- "Too much contrast causes eye strain" is a common claim, but the sources found here do not support it for body-size text. APCA explicitly sets no maximum for small text. Treat pure black on pure white as acceptable, and warm off-white as a comfort and style choice, not a health requirement.

### Gaps
- No official hex values found for the current Kindle, Google Play Books, Apple Books, YouVersion, Logos, Readwise Reader, iA Writer, Notion or Medium themes. Only Firefox Reader View and a 2011 Kindle value are primary or near-primary.
- No controlled study found that compares white, off-white and sepia for fatigue or comfort in long reading by people with normal vision.

## 2. Dark mode: ground values, text, accents, elevation and real examples

### Takeaway
Use a very dark grey or tinted near-black ground (CIE L*/HCT tone ~5–10, e.g. #121212 or Material 3 tone 6), not pure
#000 by default. Use off-white text around APCA Lc −80 to −95 (WCAG ~12–15:1). Use lighter, less saturated accents
(Material 3 primary = tone 80). Show depth with progressively lighter surfaces (M3 tones 4 → 6 → 10 → 12 → 17 → 22). On
OLED, dark mode saves only 3–9 % of power at typical brightness (39–47 % at 100 %), so battery alone does not justify
pure black. Offer a pure-black variant only as an option, if at all. Servos's current dark ground (#0f1a20, L* 8.5) and
text (#ece6d8, 14.2:1, Lc −91) are already in the right band. The weak points are the accent (#93c0dd reaches only
Lc −64, short of Lc 75 for body-size text) and very small steps between surfaces.

### Cited Findings
- Material Design 2 recommends #121212 as the dark surface colour and states that dark surfaces with 100 % white body text reach at least 15.8:1. Elevation is shown by a semi-transparent white overlay whose opacity rises with elevation. — [Material Design 2, Dark theme](https://m2.material.io/design/color/dark-theme) (direct fetch failed; values confirmed via search snippets and [Flutter docs](https://api.flutter.dev/flutter/material/ThemeData/applyElevationOverlayColor.html))
- The commonly quoted M2 overlay steps (5 % at 1dp up to 16 % at 24dp) and text opacities (87 % / 60 % / 38 %) could not be confirmed on an official page in this session. Treat them as unverified. — [search result summary](https://blog.prototypr.io/how-to-design-a-dark-theme-for-your-android-app-3daeb264637)
- Material Components for Android uses dark grey instead of black, which "increases visibility for shadows and also reduces eye strain for light text". In Material 3, "Surface with elevation overlays has been replaced… with the tonal surface color system." — [material-components-android Dark.md](https://github.com/material-components/material-components-android/blob/master/docs/theming/Dark.md)
- Material 3 tones (HCT tone = CIE L*) from the 2021 colour spec in the official library:
  - Dark surfaces: background/surface 6; surfaceContainerLowest 4; Low 10; Container 12; High 17; Highest 22; surfaceBright 24.
  - Dark foregrounds: onSurface 90; onSurfaceVariant 80; outline 60; outlineVariant 30.
  - Dark primary roles: primary 80; onPrimary 20; primaryContainer 30; onPrimaryContainer 90; error 80.
  - Light surfaces: surface 98; containers 100/96/94/92/90; surfaceDim 87.
  - Light foregrounds and roles: onSurface 10; onSurfaceVariant 30; outline 50; outlineVariant 80; primary 40; onPrimary 100; primaryContainer 90; onPrimaryContainer 30; error 40.
  - — [material-color-utilities, color_spec_2021.ts](https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/typescript/dynamiccolor/color_spec_2021.ts)
- Material 3 contrast curves in the same file, as four values per role: onSurface (4.5, 7, 11, 21); primary (3, 4.5, 7, 7); onSurfaceVariant (3, 4.5, 7, 11); outline (1.5, 3, 4.5, 7); outlineVariant (1, 1, 3, 4.5). By library convention the four values are the minimum WCAG ratios at the low, standard, medium and high contrast levels. The code does not name them, so that mapping is my reading. — [color_spec_2021.ts](https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/typescript/dynamiccolor/color_spec_2021.ts)
- Apple HIG on dark mode colours:
  - The Dark Mode palette has "dimmer background colors and brighter foreground colors", and they are "not necessarily inversions".
  - iOS uses two background sets, *base* (dimmer, recedes) and *elevated* (brighter, advances), for depth.
  - Minimum 4.5:1, aim for 7:1.
  - Darken images that have white backgrounds so they don't glow.
  - — [Apple HIG, Dark Mode](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/dark-mode.md)
- Apple iOS system greys (dark): Gray6 rgb(28,28,30) = #1C1C1E; Gray5 rgb(44,44,46); Gray4 rgb(58,58,60); Gray3 rgb(72,72,74). Increased-contrast variants are brighter. — [Apple HIG, Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md)
- iOS `systemBackground` in Dark Mode is pure black (#000000), and Apple's WWDC19 session describes the primary dark background as pure black. This comes from a forum answer and a session summary; the HIG tables fetched here do not list background hex values. — [Apple Developer Forums](https://developer.apple.com/forums/thread/649770); [WWDC19 session 808](https://developer.apple.com/kr/videos/play/wwdc2019/808/)
- Apple visionOS guidance: avoid a bright object on a very dark or black background, because it can cause visual discomfort when eyes have adapted to darkness. — [Apple HIG, Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md)
- GitHub Primer "dark dimmed" in the current @primer/primitives:
  - Grounds: bgColor-default #212830; muted #262c36; inset #151b23.
  - Text and borders: fgColor-default #d1d7e0; fgColor-muted #9198a1; borderColor-default #3d444d.
  - Accent and status: fgColor-accent #478be6; success #57ab5a; danger #e5534b; attention #c69026.
  - An older value set (#22272e / #adbac7) appears in a third-party gallery and is unverified.
  - — [unpkg @primer/primitives dark-dimmed.css](https://unpkg.com/@primer/primitives/dist/css/functional/themes/dark-dimmed.css); [oppadu gallery](https://www.oppadu.com/tools/design-systems-site/brand/github-primer.html)
- Firefox Reader dark: #1C1B22 ground, #FBFBFE text. — [searchfox aboutReader.css](https://searchfox.org/mozilla-central/source/toolkit/themes/shared/aboutReader.css)
- Purdue 2021 (Dash & Hu): on OLED phones, switching to dark mode cut display power by about 39–47 % at 100 % brightness, but only about 3–9 % at 30–50 % brightness. — [Purdue Research](https://www.purdue.edu/research/features/stories/dark-mode-may-not-save-your-phones-battery-life-as-much-as-you-think-but-there-are-a-few-silver-linings); [Purdue newsroom](https://www.purdue.edu/newsroom/releases/2021/Q3/dark-mode-may-not-save-your-phones-battery-life-as-much-as-you-think,-but-there-are-a-few-silver-linings.html)
- Halation means bright text appears to bleed into a black ground, and is said to be worse with astigmatism or myopia. The common fix is a dark grey ground with off-white text (e.g. #E0E0E0). The evidence here is weak: practitioner articles, with astigmatism prevalence figures (30 % or 50 %) that disagree and trace back to secondary sources. — [UX Collective / Bootcamp](https://bootcamp.uxdesign.cc/why-dark-mode-isnt-a-ux-panacea-1590226e5ba4); [All About Vision](https://allaboutvision.com/conditions/computer-vision-syndrome/digital-eye-strain/is-dark-mode-better-for-eyes)
- Legge et al. 1985: all seven participants with cloudy ocular media (e.g. cataract) read faster in dark mode. The study used CRT displays, which may have biased it. — [NN/g](https://www.nngroup.com/articles/dark-mode/)
- APCA: WCAG 2.x overstates contrast for dark colours, so it "cannot be used to guide dark mode design". — [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)

### Inferences
- **[computed]** Dark grounds compared with the current text colour #ece6d8:

  | Ground | Luminance (Y) | CIE L* | Contrast vs #ece6d8 |
  |---|---|---|---|
  | #000000 | 0 | 0 | 16.9:1, Lc −92 |
  | #121212 (M2) | 0.006 | 5.5 | 15.1:1, Lc −91 |
  | Servos #0f1a20 | 0.009 | 8.5 | 14.2:1, Lc −91 |
  | #1c1c1e (Apple Gray6) | — | 10.3 | 13.7:1, Lc −90 |
  | Servos surface #16232b | — | 12.9 | 12.9:1, Lc −90 |
  | Primer #212830 | — | 15.8 | 12.0:1, Lc −89 |

- **[computed]** M3 tones as neutral grey hex: 4 #0e0e0e, 6 #131313, 10 #1b1b1b, 12 #1f1f1f, 17 #2a2a2a, 22 #353535, 24 #393939, 30 #474747, 60 #919191, 80 #c6c6c6, 90 #e2e2e2. In light mode: 87 #dadada, 90 #e2e2e2, 94 #eeeeee, 96 #f3f3f3, 98 #f9f9f9. Servos's dark ground (L* 8.5) sits between M3 tones 6 and 10; the current surface (L* 12.9) is about tone 12.
- **[computed]** Off-white text on a tinted near-black ground (#0c1316, OKLCH L 0.18):

  | Text OKLCH L | Hex | WCAG | APCA |
  |---|---|---|---|
  | 0.98 | #fcf8f0 | 17.7:1 | Lc −103 |
  | 0.94 | #efebe2 | 15.8:1 | Lc −94 |
  | 0.90 | #e2ded5 | 14.0:1 | Lc −86 |
  | 0.86 | #d4d0c8 | 12.2:1 | Lc −78 |
  | 0.80 | #c1bdb5 | 10.0:1 | Lc −66 |
  | 0.72 | #a8a49c | 7.6:1 | Lc −53 |

  Off-white body text at OKLCH L 0.88–0.93 lands at Lc −82 to −92, the same band as M2 white-87 % (#e1e1e1 on #121212: 14.3:1, Lc −88). Primer dimmed is softer (Lc −79). Secondary text in dark mode needs L ≥ 0.78 to reach Lc 60 (#bbb7ae: 9.4:1, Lc −63).
- **[computed]** The current dark accent #93c0dd (oklch 0.786 0.063 237) reaches 9.1:1 but only Lc −64 on the ground. That is fine for buttons and labels (Lc 60) but short of Lc 75 for body-size link text. For hues blue, teal, green, olive, ochre, terracotta, red, plum and purple, the dark-mode accent reaches Lc −75 (~11:1) at OKLCH L 0.84–0.86 with C ≤ 0.12. This matches M3 putting primary at tone 80 in dark mode: lighter and less saturated than the light-mode accent at tone 40.
- **[computed]** Surface steps in the current palette are tiny: card #16232b vs ground #0f1a20 = 1.10:1, and card #fffdf8 vs ground #f4efe4 = 1.13:1. APCA rounds both to Lc 0. M3's steps (tone 6 → 12 → 17 → 22) are also only about 1.1–1.3:1 each, which is why M3 also has outline (3:1) and outlineVariant roles. Inference: "depth by tone, not shadow" works indoors, but in sun glare the cards will merge with the ground. Pair the tone step with a hairline in an outlineVariant-like role (dark ~L* 30, light ~L* 80–87) wherever a boundary carries meaning.
- Older translators with cataracts may read better in dark mode (Legge). Many will still do better in light mode. Supporting both, following the OS setting with a manual override, is the defensible choice. Apple's HIG says to avoid an app-specific appearance setting on iOS, but a PWA on shared Android phones arguably needs one. The owner should weigh this.

### Gaps
- No verified hex values found for YouVersion, Kindle (current), Slack or Spotify dark themes. Spotify's #121212 is widely repeated but was not verified here.
- The M2 overlay percentages and text-opacity tiers could not be read from an official page in this session.
- No direct evidence found that off-white text (vs pure white) on dark grounds reduces halation; it is a practitioner recommendation.

## 3. Contrast standards: WCAG 2.2, APCA, checking both modes, colour-vision deficiency

### Takeaway
Use WCAG 2.2 AA as the legal floor in both modes: 4.5:1 text, 3:1 large text, 3:1 for UI boundaries and icons. For
reading comfort, target AAA (7:1) for body text. Use APCA as a second check, especially in dark mode where WCAG 2
overstates contrast: Lc ≥ 75 (target 90) for scripture and body text, Lc ≥ 60 for other text, Lc ≥ 45 for large
headings, Lc ≥ 30 for placeholders, Lc ≥ 15 for dividers. Never rely on colour alone. Common green/amber/red status
sets nearly merge under deuteranopia and protanopia. Separate statuses by lightness and hue, and always pair them
with an icon and a word.

### Cited Findings
- WCAG 2.2 Success Criterion 1.4.3, Contrast (Minimum), level AA: 4.5:1 for normal text and 3:1 for large text (≥ 18 pt, or ≥ 14 pt bold). — [W3C Understanding 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- WCAG 2.2 SC 1.4.6, Contrast (Enhanced), level AAA: 7:1 for normal text and 4.5:1 for large text. — [W3C Understanding 1.4.6](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html)
- WCAG 2.2 SC 1.4.11, Non-text Contrast, AA: 3:1 for UI component boundaries, states and meaningful graphics. — [W3C Understanding 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- WCAG 2.2 SC 1.4.1, Use of Color: colour must not be the only visual means of conveying information. — [W3C Understanding 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- APCA levels:
  - Lc 90: preferred for body text (e.g. 18px/300 or 14px/400).
  - Lc 75: minimum for body text columns (18px/400, 14px/700).
  - Lc 60: other content text (24px/400, 16px/700).
  - Lc 45: headlines (36px/400, 24px/700) and fine pictograms.
  - Lc 30: absolute minimum for placeholder or disabled text and large solid icons.
  - Lc 15: minimum for non-text such as dividers; "anything below this level" is effectively invisible.
  - Sizes assume an x-height ratio of 0.52. Fonts with smaller x-heights need larger sizes (e.g. Times needs ~16 % more).
  - — [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)
- APCA Bronze Simple Mode: body text Lc 75 minimum (Lc 90 preferred); other content text Lc 60; large text (> 36px) Lc 45, with a maximum of Lc 90 for large text only. Light-on-dark gives negative values. — [ReadTech APCA Bronze](https://readtech.org/ARC/tests/bronze-simple-mode/)
- Radix Colors 12-step scales: step 11 (low-contrast text) is guaranteed Lc 60 and step 12 (high-contrast text) Lc 90 against step 2 of the same scale. Steps 1–2 are backgrounds, 3–5 component states, 6–8 borders, 9–10 solid fills. — [Radix, Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
- Apple: provide light, dark *and* increased-contrast variants of every custom colour. Its system colours show how much a hue must shift as a foreground on light grounds. Yellow is rgb(255,204,0) by default but rgb(161,106,0) (#A16A00) in increased contrast on light; green goes from (52,199,89) to (0,137,50). — [Apple HIG, Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md)
- Apple: "Avoid relying solely on color… provide the same information in alternative ways… text labels or glyph shapes". — [Apple HIG, Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md)
- Evil Martians, an OKLCH advocate, adds a changelog note that "Just OKLCH is not enough" and that developers should use APCA to detect contrast. — [Evil Martians, OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)

### Inferences
- **[computed]** Current Servos palette:

  | Pair | WCAG | APCA | Verdict |
  |---|---|---|---|
  | Light text #1f2a30 / ground | 12.79:1 | Lc 92 | good |
  | Light accent #17496a / ground | 8.33:1 | Lc 83 | good |
  | White on accent #17496a | 9.56:1 | Lc −96 | good |
  | Ochre #d39a2c as text on ground | 2.17:1 | Lc 39 | fails as text |
  | Dark text #1f2a30 on ochre fill | 5.89:1 | Lc 51 | OK for a highlight fill; weak for small text in APCA |
  | Dark text #ece6d8 / ground | 14.20:1 | Lc −91 | good |
  | Dark accent #93c0dd / ground | 9.10:1 | Lc −64 | OK for labels, short of Lc 75 for body links |
  | Dark ochre / ground | 7.09:1 | Lc −52 | OK for large or bold only |

- **[computed]** CVD simulation of status sets (minimum ΔE across pairs; lower means more confusable):

  | Status set | Normal vision | Protan | Deutan |
  |---|---|---|---|
  | Classic green #2e7d32 / amber #b26a00 / red #c62828 | 13.3 | 2.1 (success vs warning) | 4.3 (success vs danger) |
  | Teal #1f7a6b / ochre #9a6a00 / brick #b3261e | — | 10.0 | 5.5 (warning vs danger) |
  | Okabe–Ito (bluish green #009e73, orange #e69f00, vermillion #d55e00, blue #0072b2) | — | 11.0 | — |

  The classic set is effectively one colour for protan and deutan readers. The teal set is better, but warning and danger stay close under deuteranopia. Okabe–Ito separates well, but most of its colours fail 4.5:1 as text on paper (warning 1.96:1).

- **[computed]** Best status set found that also passes ≥ 4.5:1 as text on warm paper #f7f2e8: success = blue #1f689d (5.34:1) or blue-teal #066d90 (5.23:1); warning = ochre-brown #935f05 (4.85:1); danger = crimson-magenta #990145 (7.70:1). The minimum ΔE under protan and deutan is 11.6. Dark-mode partners: success #86c5fa (Lc −67), warning #fbbd6e (Lc −73), danger #fa89a5 (8.2:1, Lc −57). Lighten danger slightly (OKLCH L ≈ 0.82) to reach Lc 60. A blue or blue-teal "success" is unusual. The conventional green can stay if every status always carries an icon and a word, which WCAG 1.4.1 requires anyway.
- How to check both modes: list every foreground/background token pair (text, secondary text, accent, status, highlight, line) and test it in light, dark and, if offered, high contrast. Use WCAG 2 for the conformance record and APCA for perceptual adequacy, with the APCA polarity-aware calculator ([apcacontrast.com](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html)). Run a CVD simulation (Machado matrices; Chrome DevTools has "emulate vision deficiencies") on status colours, highlight versus accent, and the brand mark against both grounds.

### Gaps
- I did not verify the current status of APCA inside WCAG 3 drafts. APCA is not a W3C standard, so WCAG 2.2 remains the normative target.
- The x-height of Charis SIL and Mulish relative to APCA's 0.52 reference was not checked. It matters for applying APCA size and weight tables.

## 4. Outdoor and sunlight readability on cheap phones

### Takeaway
Sunlight reflected off the screen adds roughly the same luminance to text and ground, so effective contrast collapses
(to about 1.2–3.3:1 on measured phones). One lab study suggests a minimum of 18:1 for outdoor use instead of 7:1.
Polarity matters less than the absolute luminance difference between text and ground. So outdoors: high-contrast near-
black on near-white, heavier text weights, no mid-grey secondary text, no low-contrast sepia. OLED panels did better
than LCD in sunlit tests. Evidence specific to cheap Android phones in 2022–2026 is missing.

### Cited Findings
- Pignoni (2018, IEEE Colour and Visual Computing Symposium, NTNU): the minimum acceptable text contrast rises from office light to simulated outdoor light. W3C's 7:1 "does not guarantee readability for outdoor or mobile use", and the paper proposes **18:1** as the minimum under high illumination. Only the abstract was available, so sample and lux levels are unknown. — [NTNU Open](https://ntnuopen.ntnu.no/ntnu-xmlui/handle/11250/2588645)
- GSMArena's sunlight legibility test measured perceived sunlit contrast at full brightness. Early (2012) results ranged from about 1.2:1 to 3.3:1. The test was discontinued in 2020 because AMOLED displays were universally better than LCDs. — [GSMArena lab tests](https://m.gsmarena.com/gsmarena_lab_tests-review-751p2.php); [GSMArena announcement](https://m.gsmarena.com/gsmarena_labs_announces_sunlit_legibility_display_test-news-4105.php)
- DisplayMate: nearly all smartphone screens act as mirrors in bright light, and there is "very little information (other than anecdotal)" on how they degrade. — [DisplayMate shoot-out](https://displaymate.com/Smartphone_Brightness_ShootOut_1.htm)
- A patent experiment on a 2000s phone found contrast under direct sunlight fell below 1.75:1 ("badly washed out"). — [USPTO 7853288](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7853288)
- Apple: "In bright surroundings, colors look darker and more muted"; test colour schemes under a variety of lighting conditions. — [Apple HIG, Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md)
- Dobres et al. 2017: no significant polarity effect under simulated daytime light. — [NN/g](https://www.nngroup.com/articles/dark-mode/)

### Inferences
- **[computed, illustrative model]** Assumptions: screen white 450–600 cd/m², reflected light added equally to text and ground, LCD black floor 0.45 cd/m². In shade (+30 cd/m² reflected): current light 10.5:1; current dark 11.2:1; pure black on white 15.8:1; Firefox sepia 6.7:1. In sun (≈ 50 000 lux × 1 % diffuse reflectance ≈ 160 cd/m² reflected, 600 cd/m² white): current light 3.9:1; current dark 3.8:1; black on white 4.7:1; Firefox sepia 3.3:1. The model's message: outdoors every scheme collapses. The highest-contrast pair degrades least. Sepia and mid-grey text are first to become unreadable. Light and dark modes end up similar, so polarity is not the lever; luminance difference and brightness are.
- Practical consequences for Servos:
  1. Keep body text at ≥ 12:1 indoors so it survives glare.
  2. Keep secondary text ≥ 7:1 (not 4.5:1).
  3. Offer a "sun / high contrast" option: white or near-white ground, near-black text, no tinted cards, ≥ 18:1, which matches Pignoni. Use Mulish 500–600 for UI labels and a slightly larger scripture size.
  4. Draw boundaries with lines, not only tone steps.
  5. Never rely on the ochre highlight alone (2.2:1 on paper) to show state.
- These measures cost nothing indoors and help the low-vision and older users identified in section 2.

### Gaps
- No 2022–2026 independent study of outdoor legibility on budget Android LCD and OLED phones was found. Typical peak brightness and screen reflectance of the phones the teams use are unknown and would need field measurement.
- Pignoni's experimental details (lux levels, participants) could not be read; only the abstract was available.

## 5. One brand hue for both modes: tonal palettes, OKLCH/HCT steps, accessible accent, brand versus neutrals

### Takeaway
No single tone of any hue reaches 4.5:1 as text on both the warm-paper ground and the ink-dark ground. A mid tone
(OKLCH L ≈ 0.50–0.64) reaches only about 3.9:1 on both. So treat the brand colour as **one hue with several tones**:
- a mid tone (L ≈ 0.55–0.60) for the logo mark and large graphics, which meets 3:1 non-text contrast on both grounds;
- a dark tone (L ≈ 0.42–0.52) as the light-mode accent and filled button;
- a light, less saturated tone (L ≈ 0.80–0.86, C ≤ 0.12) as the dark-mode accent.

Everything else should be a warm, almost-neutral system tinted toward the paper hue (C ≤ 0.02). Build it in OKLCH or HCT
so that lightness steps are perceptually even across hues. Reserve the accent for interaction: one filled button per
screen, links and focus.

### Cited Findings
- OKLCH has perceptually uniform lightness, unlike HSL: oklch(0.8 0.12 100) yellow and oklch(0.8 0.12 225) blue look equally light. Palettes can be generated by changing L while keeping C and H; relative colours such as `oklch(from var(--accent) calc(l + 0.1) c h)` give variants. "All backgrounds with L≥87% have good contrast with black text." Dark mode needs only different custom-property values. P3 colours need manual fallbacks because Chrome and Safari clip out-of-gamut colours. — [Evil Martians, OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- Linear's redesign rebuilt its theme generator in LCH instead of HSL because LCH is "perceptually uniform". It went from 98 variables per theme to three (base colour, accent colour, contrast). The contrast variable automatically yields high-contrast themes. It limited how much blue "chrome" fed into the calculations to "return to a more neutral and timeless appearance", and made text darker in light mode and lighter in dark mode. — [Linear, How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Material 3 derives each role from a tonal palette by tone: light primary 40 / onPrimary 100 / primaryContainer 90; dark primary 80 / onPrimary 20 / primaryContainer 30. Neutral surfaces and text come from low-chroma neutral palettes. Minimum contrast is enforced by contrast curves (primary ≥ 4.5:1 at standard contrast). — [color_spec_2021.ts](https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/typescript/dynamiccolor/color_spec_2021.ts)
- Radix: build each hue as a 12-step scale with fixed jobs per step and separate light and dark scales, mapped through aliases per mode (e.g. AppBg). — [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
- Apple: "in apps with primarily monochromatic content or backgrounds, choosing your brand color as the app accent color can be an effective way to… reflect your company's identity". Apple also says to "avoid using the same color to mean different things": if the brand colour marks interactivity, using it on non-interactive text is confusing. — [Apple HIG, Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md)
- Apple: apply colour sparingly and reserve it for primary actions and status. "Refrain from adding color to the background of multiple controls." This supports Servos's one-filled-button rule. — [Apple HIG, Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md)

### Inferences
- **[computed]** The lightest accent tone per hue that passes both 4.5:1 as text on #f4efe4 and 4.5:1 for a white label on top. All land at OKLCH L ≈ 0.51–0.55 (1–2 points darker gives margin). The matching dark-mode accent reaches Lc −75 on #0f1a20.

  | Hue | Light-mode accent | On paper | White label | Dark-mode accent | On dark ground |
  |---|---|---|---|---|---|
  | blue 250 | #006ebe | 4.61:1 | 5.28:1 | #a8d2fe | 11.2:1 |
  | teal 200 | #02787d | 4.60:1 | — | #54e2e9 | — |
  | green 155 | #007a44 | 4.74:1 | — | #87e2a8 | — |
  | olive 120 | #607204 | 4.69:1 | — | #c4da7d | — |
  | ochre 75 | #906106 | 4.70:1 | — | #fec675 | — |
  | terracotta 40 | #bb4717 | 4.55:1 | — | #ffc0ab | — |
  | red 25 | #bd413f | 4.59:1 | — | #febfb9 | — |
  | plum 350 | #b2417f | 4.63:1 | — | #febad9 | — |
  | purple 305 | #8854bb | 4.54:1 | — | #dec3ff | — |

  Ochre at an accessible text tone is brown (#906106). Ochre can stay a highlight fill but becomes "brown" as an accent, which mirrors Apple's yellow → #A16A00.

- **[computed]** "One tone for both grounds": for every hue, OKLCH L ≈ 0.50–0.64 gives ≥ 3:1 on both #f4efe4 and #0f1a20. Examples: terracotta #bd5833 (3.97:1 / 3.88:1); teal #07858a (3.87 / 3.98); green #08884d (3.95 / 3.90); plum #b95689 (3.85 / 4.00). No hue reaches 4.5:1 on both. This is the natural tone for the logo mark and app icon, which meet WCAG 1.4.11 for graphics in both modes. It cannot be the text or link colour in both.
- **[computed]** Candidate token sets. They share warm-paper neutrals, with the accent hue as the variable. Values have been checked but not tuned visually.

  **Light neutrals**

  | Token | Hex | Contrast |
  |---|---|---|
  | ground | #f7f2e8 (oklch 0.962 0.014 85) | — |
  | card | #fefcf7 | — |
  | sunken / input | #ede7db | — |
  | line | #ddd7ca | — |
  | strong line (inputs) | #868073 | 3.52:1, meets 1.4.11 |
  | text | #182125 | 14.7:1 on ground, Lc 96 |
  | secondary text | #4b545a | 6.9:1, Lc 79; darken slightly to reach ≥ 7:1 |
  | highlight fill | #f2cf8f | text on it 11.0:1, Lc 78 |

  **Dark neutrals**

  | Token | Hex | Contrast |
  |---|---|---|
  | ground | #0c1316 (oklch 0.18) | — |
  | card | #151c20 | — |
  | raised | #1f262b | — |
  | sunken | #070c0f | — |
  | line | #2c3439 | — |
  | strong line | #616b70 | 3.43:1 |
  | text | #e9e4da | 14.8:1, Lc −90 |
  | secondary text | #bbb7ae (L 0.78) | 9.4:1, Lc −63 |
  | highlight fill | #61481b | off-white text on it 6.8:1, Lc −77 |

  **Accent options** (light-mode accent / white label on it / dark-mode accent):

  | Option | Light accent | On paper | White label | Dark accent | On dark ground |
  |---|---|---|---|---|---|
  | Terracotta/barro (H 40) | #9f3d15 | 5.97:1 | 6.66:1 | #ffa383 | 9.7:1, Lc −65 |
  | Teal/verde azulado (H 200) | #066e73 | 5.40:1 | 6.02:1 | #64d1d7 | 10.4:1, Lc −69 |
  | Moss/verde musgo (H 140) | #3b6f30 | 5.37:1 | 6.00:1 | #98cf8b | 10.4:1, Lc −69 |
  | Plum/ciruela (H 350) | #943c6b | 6.04:1 | 6.74:1 | #f89dc9 | 9.5:1, Lc −64 |
  | Lighter ink blue (H 245) | #09659f | 5.58:1 | 6.22:1 | #80c5ff | 10.1:1, Lc −67 |

  For body-size link text in dark mode, lighten the accent to L ≈ 0.85 to reach Lc 75.

- **[computed]** Each brand hue collides with one status colour, so plan the statuses around the brand:
  - **Terracotta:** under deuteranopia it nearly matches danger (ΔE 3.4) and warning (3.6). Danger must move to crimson-magenta and always carry an icon.
  - **Teal:** identical to a teal success (ΔE 1.2). Success must then be blue or green-yellow.
  - **Moss green:** close to danger under deuteranopia (2.1) and to warning under protanopia (2.5).
  - **Plum:** close to a teal success under deuteranopia (1.6).
  - **Ink blue:** separates well from all statuses for protan and deutan readers (≥ 8.9), and collides only under the rare tritanopia (1.8 vs teal success).
- The current accent #17496a is oklch(0.389 0.077 242), CIE L* 29. Its hue (242) is almost the same as the text and dark-ground hue (232–233), and its lightness is close to the body text (L* 16). It therefore reads as "darker text" rather than as an accent, and the whole palette reads as one blue-grey. This may explain why it feels heavy or corporate. Any new accent should differ from the text in both hue and lightness: L ≈ 0.45–0.52 in light mode, not 0.39.
- Brand versus system: the evidence (Apple, Linear) points to a mostly neutral, warm system with one accent hue used sparingly. The brand lives in the mark, the app icon and the single filled button, not in tinted backgrounds. The highlight (ochre) is a second hue with its own job (marking text), so it must not double as the accent.

### Gaps
- I could not read the Material 3 neutral-palette chroma values for the TonalSpot scheme (the variant code was not in the fetched file). The exact tint M3 gives to neutral surfaces is unverified.
- The candidate sets have not been looked at on real devices. Hue choice needs visual review with the owner and users.

## 6. Colour psychology and cultural meaning for Latin American and Andean audiences

### Takeaway
Colour-emotion research finds broad cross-national patterns (similarity r = .88 across 30 nations), plus real local
variation. Claims like "blue = trust" are weakly supported, and the field calls itself nascent. Culturally specific
signals that matter for this audience:
- Purple/violet means penitence and mourning in Catholic Latin America (Advent, Lent, funerals).
- White and gold are festive or sacred (Christmas, Easter).
- Green means ordinary time, growth and nature.
- Red means Passion, martyrs and Pentecost, as well as danger.
- In the Andes, the seven-colour wiphala is a strong and politically charged identity symbol, best not echoed.
- Andean weaving offers a fitting local idea for a tonal palette: allqa (bold contrast) mediated by k'isa (graded tones).

### Cited Findings
- Jonauskaite et al. 2020 (*Psychological Science* 31(10)) tested 4,598 participants from 30 nations speaking 22 languages, linking 20 emotions to 12 colour terms. It found universal colour-emotion associations (average similarity r = .88). Local differences also appeared, and nation predicted associations beyond the universal pattern. Similarity was greater between linguistically or geographically close nations. — [search summary of the paper](https://www.psychologicalscience.org/journals/psychological-science/0956797620948810/); [White Rose record](https://eprints.whiterose.ac.uk/169496/)
- Elliot (2015, *Frontiers in Psychology*): research on colour and psychological functioning is "at a nascent stage of development"; it advises caution about real-world application. Secondary accounts of Elliot & Maier 2014 say many pre-2000 colour studies failed to control hue, lightness and chroma. — [Elliot 2015, Frontiers](https://www.frontiersin.org/articles/10.3389/fpsyg.2015.00368/full)
- Apple HIG: "Consider how the colors you use might be perceived in other countries and cultures… red communicates danger in some cultures, but has positive connotations in other cultures." — [Apple HIG, Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md)
- A UK Trade & Investment exporter guide says purple "in Latin America and Brazil is associated with sorrow and mourning". A design blog says yellow is linked to mourning in parts of Latin America. Both are weak, non-academic sources; Aslam's cross-cultural review exists but its full text was not accessible. — [UKTI blog](https://ukti.blog.gov.uk/2015/09/15/choosing-your-colours-what-exporters-need-to-know); [Aslam, UOW repository](https://ro.uow.edu.au/commpapers/1043)
- Catholic liturgical colours (General Instruction of the Roman Missal 346):
  - White: Christmas and Easter seasons, feasts of the Lord, Mary and saints.
  - Red: Palm Sunday, Good Friday, Pentecost, Apostles and martyrs.
  - Green: Ordinary Time.
  - Violet/purple: Advent and Lent, and may be used for the dead.
  - Rose: two Sundays. Black: Masses for the dead. Gold or silver: solemn occasions (US).
  - — [USCCB, Understanding the Liturgical Colors](https://www.usccb.org/prayer-and-worship/liturgical-year-and-calendar/understanding-the-liturgical-colors)
  - In Spanish: [Opus Dei, significado de los colores litúrgicos](https://opusdei.org/es/article/significado-colores-ano-liturgico-misa/)
- Wiphala colour meanings (popular sources, which differ in detail):
  - Red: the Earth.
  - Orange: society and culture.
  - Yellow: energy and strength.
  - White: time and transformation.
  - Green: economy, production and natural wealth.
  - Blue: cosmic space.
  - Violet: politics and community ideology.
  - Its origin legends are unproven.
  - — [Billiken](https://billiken.lat/saber-mas/wiphala-que-significan-los-siete-colores-del-simbolo-ancestral/); [La Capital](https://www.lacapital.com.ar/informacion-general/whipala-simbolo-pueblos-originarios-cual-es-su-significado-y-que-representa-cada-color-n10094763.html/amp); [Los Tiempos](https://www.lostiempos.com/node/477868)
- The wiphala has been a national symbol of Bolivia since the 2009 constitution (art. 6.II, dual flag). It was torn down and burned during the 2019 crisis, police later held an act of apology, and a 2021 Santa Cruz dispute led to accusations of racism. It is politically charged. — [Morning Star](https://morningstaronline.co.uk/article/w/bolivians-rally-indigenous-wiphala-flag-after-racist-attack); [Los Tiempos, desagravio](https://www.lostiempos.com/node/477925); [Los Tiempos, "Liberen a la wiphala"](https://www.lostiempos.com/actualidad/opinion/20210928/columna/liberen-wiphala); [Wikipedia, Wiphala](https://en.wikipedia.com/wiki/Wiphala)
- Andean textiles:
  - Cereceda (*Chungara* 2010) describes *allqa* as contrasting coloured bands. *Qallus*, *k'utus* and *k'isas* are narrow mediating borders. The successive contrast forces perception of tonal difference, and k'isa gradations soften the meeting point. — [Redalyc, Cereceda](https://www.redalyc.org/pdf/326/32618797029.pdf)
  - Crickmay's thesis (St Andrews 1992) treats Andean woven designs as a symbolic language that balances opposing forces, including the significance of colour. — [St Andrews repository](https://research-repository.st-andrews.ac.uk/handle/10023/2876)
  - A Penn State exhibit text (not peer-reviewed): in Apurímac, red signifies the male principle or dry season, green the female principle, fertility or wet season, and yellow mediates between them. — [PSU Matson Museum PDF](https://matson.psu.edu/wp-content/uploads/sites/19/2022/08/Recording-Quechua-Worldview-in-Textiles.pdf)
  - An Emory Carlos Museum essay links bichrome designs to *ayni* (duality) and to the Quechua pair *samí* (light, bright) and *hucha* (dark, heavy), whose balance the paired colours express. — [Threads of Time, Emory](https://threads-of-time.carlos.emory.edu/exhibits/show/essays/dialoguesinthread)

### Inferences
Read each colour as "few red flags", not "proven positive effect".

- **Purple/plum:** risky as the main brand colour for a Latin American scripture tool. It reads as Lent, penitence and mourning in Catholic contexts, and the UKTI source independently reports mourning. It also overlaps with the wiphala's "politics" stripe.
- **Terracotta/brick red:** reads as earth and clay, which matches the Andean "red = Earth" meaning. But red also carries Passion, danger and, in some countries, party-political associations (not researched here). It also collides with danger states (section 5).
- **Teal/green-blue and moss green:** green carries growth, nature, ordinary time and abundance (wiphala "natural wealth"; Apurímac fertility) with few negative flags found. Green is also strongly coded as "success/OK" in UI, which constrains statuses.
- **Ochre/gold:** gold is sacred and festive in liturgy and fits as the "highlight" colour. Its fill must not be confused with warning.
- **Blue:** carries no negative flags in these sources, but it is the colour the owner rejects. The corporate feel is probably a lightness and hue issue (section 5) rather than a meaning issue.
- Using the allqa/k'isa idea (contrast mediated by graded tones) as the design story for a tonal palette is culturally grounded and avoids copying sacred or political symbols. Validate it with Andean team members before using it publicly.

### Gaps
- The full text of Jonauskaite et al. 2020 could not be retrieved (403 / DNS errors). Whether Latin American nations were in the 30 and their specific associations are unverified.
- No academic source found on colour meaning specifically among Kichwa (Ecuador) or Amazonian communities, or among evangelical Protestant (vs Catholic) users, who may make up much of the translator base.
- Country-by-country party-political colour associations in Latin America were not researched.

## 7. What looks dated or corporate versus fresh and crafted in 2024–2026

### Takeaway
The trend signal, mostly opinion-grade, points away from saturated "corporate" blue chrome and cold pure greys. It
points toward warm or tinted neutrals, low-chroma surfaces, one distinctive accent used sparingly, and perceptually
uniform (LCH/OKLCH) ramps. Pantone chose a brown (2025) and, for the first time, a white (2026). Linear deliberately
removed blue to look "neutral and timeless". Treat this as taste guidance, not evidence.

### Cited Findings
- Linear's redesign reduced blue in its UI chrome to "return to a more neutral and timeless appearance", rebuilt themes in LCH from three inputs, and increased text contrast. — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Pantone Color of the Year 2025 was Mocha Mousse, the first brown. The 2026 pick, Cloud Dancer (PANTONE 11-4201), is the first white since the programme began in 1999, described as a calming, focus-enhancing "structural" neutral. — [Smithsonian Magazine](https://www.smithsonianmag.com/smart-news/pantones-color-of-the-year-for-2026-is-a-blank-canvas-called-cloud-dancer-or-in-other-words-white-180987805/); [Creative Review](https://www.creativereview.co.uk/pantone-colour-of-the-year-2026-cloud-dancer/)
- Design-trend blogs describe 2025 palettes moving to earthy and natural tones (browns, greens, ochres) and "honeyed neutrals" instead of cool palettes. Other blogs still list classic blue. These are low-quality, generic sources. — [CareerFoundry](https://careerfoundry.com/en/blog/ui-design/color-palette-trends/); [ThemeWagon](https://themewagon.com/?p=145473)
- Apple (2025) tells apps to apply colour sparingly, reserve it for primary actions and status, prefer monochromatic chrome, and avoid colouring several controls. — [Apple HIG, Color](https://developer.apple.com/tutorials/data/design/human-interface-guidelines/color.md)

### Inferences
- **Signals that read as dated or corporate** (opinion): a saturated mid-blue as the only colour, used for headers, icons, links and buttons at once; pure neutral greys (#f5f5f5, #333) with no temperature; many filled buttons; gradients, glows and glass; drop shadows on dark grounds; status colours at full saturation.
- **Signals that read as fresh or crafted** (opinion): warm or tinted neutrals at very low chroma (C ≈ 0.005–0.02); a slightly unexpected but muted accent (clay, moss, deep teal) at a disciplined lightness; serif type for content; depth by tone; one accent action per screen; dark mode tinted (not grey-black) and coherent with the light mode's hue.
- Servos's existing rules (no gradients, no glass, tone-based depth, one filled button) already match the "crafted" side. The palette change mainly needs a new accent hue at a lighter tone than #17496a, and neutrals whose hue does not repeat the accent.

### Gaps
- No rigorous study found on perceived "datedness" of UI palettes; all evidence here is trend commentary or company design notes.
