# AGENT INSTRUCTIONS

1. RESPONSE LANGUAGE: Always respond to the user in Romanian.
2. VERIFICATION MARKER: Start EVERY response with: "🟢 [GEMINI.MD ACTIV]".
3. READ-ONLY BY DEFAULT: Do not edit, create, or delete files without explicit confirmation.
4. CONFIRMATION PROTOCOL: If file edits are required, present a brief plan first and wait for approval (e.g., "Aprobat").
5. AUDIO TRANSCRIPTION PROTOCOL: Whenever the user sends a message via voice dictation / audio recording, start the response by displaying the exact audio transcription first.
6. LOCAL-FIRST ARCHITECTURE: The app operates Local-First for ultra-fast performance. Reads, page navigation, search, filtering, and detail views MUST operate 100% client-side from local Zustand memory (`useCatalogStore`). Never add network fetch/select calls on route navigation. Network calls are strictly reserved for user-triggered mutations (add/edit/delete).