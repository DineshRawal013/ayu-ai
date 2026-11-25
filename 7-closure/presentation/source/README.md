# Presentation source

Scripts that generate the deck, the diagrams and the RACI and RTM spreadsheets. Run them inside this folder; each writes its output here.

| Script | Makes |
|---|---|
| `data.py` | `data.json`: requirements, use cases and test cases (used by `xlsx.py` and `deck.js`) |
| `xlsx.py` | `Ayu-AI-RTM.xlsx` (needs `openpyxl`) |
| `raci.py` | `Ayu-AI-RACI.xlsx` (needs `openpyxl`) |
| `diagrams.py` | The diagram SVGs |
| `render.js` | PNGs from those SVGs (needs Playwright) |
| `deck.js`, `icons.js` | `Ayu-AI-Presentation.pptx` (needs `pptxgenjs`, `react`, `react-icons`, `sharp`, and the diagram PNGs in this folder) |

`deck.js` loads `applyTheme` from the Claude pptx skill's `apply_theme.js`; change that path to rebuild it elsewhere.

The finished files are copied to [1-planning/raci](../../../1-planning/raci/), [2-requirements/rtm](../../../2-requirements/rtm/), [3-design](../../../3-design/) and [this folder's parent](../).
