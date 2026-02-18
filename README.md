# Meeting Scope & RAID Planner

A browser-based project management assistant that can:

- Listen to meetings using the Web Speech API.
- Parse transcript text to identify action items.
- Detect mentions that may impact project scope.
- Build a lightweight RAID register (Risk, Assumption, Issue, Dependency).
- Suggest delegations based on inferred owners.
- Export a PowerPoint project plan with summary, RAID table, and actions.

## Run locally

Because this is a static app, you can open `index.html` directly, or serve it:

```bash
python3 -m http.server 8000
```

Then browse to `http://localhost:8000`.

## Notes

- Live listening support depends on browser support for `SpeechRecognition` / `webkitSpeechRecognition`.
- PPT export uses PptxGenJS loaded from jsDelivr CDN.
