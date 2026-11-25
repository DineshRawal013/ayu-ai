# UI design: high-fidelity mockups

High-fidelity mockups of every Ayu AI screen, on desktop (1440 px wide) and on a phone (iPhone 14, 390 px wide). They show the real frontend in [4-implementation/frontend](../../4-implementation/frontend/) with one sample reading: born 13 May 2002, 10:00, in Pokhara, Nepal; male, 172 cm, 78 kg, waist 88 cm, light activity, 6 h sleep, never smoked, 4 drinks a week.

The numbers come from the real health-svc and kundali-svc. The AI texts ("AI's guess" and "Ayu's read") are written samples in the style of the model's output, because the model was not running when the mockups were made.

## Screens

| # | Screen | Shows | Desktop | Mobile |
|---|---|---|---|---|
| 1 | Home | Header, headline and the start of the form | [01-home](desktop/01-home.png) | [01-home](mobile/01-home.png) |
| 2 | Input form | About you (birth date, time, place search), your body, your habits | [02-input-form](desktop/02-input-form.png) | [02-input-form](mobile/02-input-form.png) |
| 3 | Results: age and Lifeline | Exact age, live seconds counter, totals, next birthday; the **calculated** lifespan estimate with each factor | [03-results-age-lifeline](desktop/03-results-age-lifeline.png) | [03-results-age-lifeline](mobile/03-results-age-lifeline.png) |
| 4 | AI's guess and Ayu's read | The AI's **own** lifespan guess, shown as a separate section from the calculated Lifeline, then the AI insight that explains the numbers | [04-ai-guess-and-insight](desktop/04-ai-guess-and-insight.png) | [04-ai-guess-and-insight](mobile/04-ai-guess-and-insight.png) |
| 5 | Health | BMI, BMR, TDEE, water, reference weight, waist-to-height; alerts; habit radar and 12-week weight projection | [05-health](desktop/05-health.png) | [05-health](mobile/05-health.png) |
| 6 | Kundali: birth chart | Summary, North Indian chart and the planet table | [06-kundali-chart](desktop/06-kundali-chart.png) | [06-kundali-chart](mobile/06-kundali-chart.png) |
| 7 | Kundali: planet wheel | The animated sky in live mode (today's positions, birth positions as faint rings) | [07-planet-wheel](desktop/07-planet-wheel.png) | [07-planet-wheel](mobile/07-planet-wheel.png) |
| 8 | Kundali: dasha and periods | Vimshottari dasha timeline and the traditionally challenging periods | [08-dasha-and-periods](desktop/08-dasha-and-periods.png) | [08-dasha-and-periods](mobile/08-dasha-and-periods.png) |
| 9 | Shared reading | A saved reading opened from a share link (`/?r=<id>`) on a phone | | [09-shared-reading](mobile/09-shared-reading.png) |

## Design notes

- **Colours:** light green-grey page for age and health, dark night-blue section for the kundali, saffron for highlights and warnings, teal for good values.
- **Fonts:** Bricolage Grotesque for headings and numbers, Atkinson Hyperlegible for body text (chosen for readability).
- **Layout:** a single page that scrolls from input to results. Cards and grids fold into one column on phones.
- **Calculated vs. AI:** the calculated Lifeline and the AI's guess are separate, clearly labelled sections, so the AI value is never presented as the calculated result.
- **Disclaimers** sit next to each estimate: Lifeline is "just for fun", the kundali is "for cultural interest", and the health figures are screening estimates.
