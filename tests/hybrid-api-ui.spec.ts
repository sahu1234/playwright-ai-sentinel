import { test, expect } from '../src/ai/fixtures/aiFixtures';
import { NotesAppPage } from '../src/ai/pages/NotesAppPage';

test.describe('Hybrid REST API Seeding + React UI Verification (@hybrid)', () => {
  test('seeds a note via ExpandTesting Notes REST API and verifies rendering in React Notes UI', async ({
    smartPage,
    request,
  }) => {
    const notesApp = new NotesAppPage(smartPage);

    // 1. Register & authenticate via REST API
    const credentials = await notesApp.registerAndLoginViaApi(request);

    // 2. Seed a structured note via REST API
    const seededNote = await notesApp.createNoteViaApi(request, credentials.token, {
      title: `AI Sentinel Hybrid Note ${Date.now().toString().slice(-4)}`,
      description: 'Seeded directly via /notes/api/notes and verified in React UI with zero UI setup overhead.',
      category: 'Work',
    });

    try {
      // 3. Open the React Notes UI with injected auth token and verify note card appears
      await notesApp.openAuthenticatedNotesUi(credentials);

      const noteCard = notesApp.getNoteCardByTitle(seededNote.title);
      await expect(noteCard.first()).toBeVisible({ timeout: 15_000 });
      await expect(noteCard.first()).toContainText(seededNote.description);
    } finally {
      // 4. Clean up seeded note via REST API
      await notesApp.deleteNoteViaApi(request, credentials.token, seededNote.id);
    }
  });
});
