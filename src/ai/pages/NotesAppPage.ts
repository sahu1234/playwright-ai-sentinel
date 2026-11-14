import { APIRequestContext, expect, Locator } from '@playwright/test';
import { SmartPage } from '../fixtures/aiFixtures';

export interface SeededUserCredentials {
    name: string;
    email: string;
    password: string;
    token: string;
}

export interface CreatedNoteRecord {
    id: string;
    title: string;
    description: string;
    category: 'Home' | 'Work' | 'Personal';
}

export class NotesAppPage {
    private readonly smartPage: SmartPage;
    private readonly apiBaseUrl: string;

    constructor(smartPage: SmartPage) {
        this.smartPage = smartPage;
        const practiceOrigin = (
            process.env.PRACTICE_ORIGIN || 'https://practice.expandtesting.com'
        ).replace(/\/$/, '');
        this.apiBaseUrl = `${practiceOrigin}/notes/api`;
    }



    /**
     * Registers a disposable test user and authenticates via the ExpandTesting Notes REST API,
     * returning a valid `x-auth-token` for fast backend test data seeding.
     */
    async registerAndLoginViaApi(request: APIRequestContext): Promise<SeededUserCredentials> {
        const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        const name = `SentinelSDET${uniqueSuffix.slice(-5)}`;
        const email = `sentinel.sdet.${uniqueSuffix}@example.com`;
        const password = `SentinelPass#${uniqueSuffix.slice(-4)}`;

        // In registerAndLoginViaApi:
        const registerRes = await request.post(`${this.apiBaseUrl}/users/register`, {
            data: { name, email, password },
        });
        expect(registerRes.status(), 'Expected Notes API user registration to succeed').toBe(201);
        expect(registerRes.status(), 'Expected Notes API user registration to succeed').toBe(201);

        const loginRes = await request.post(`${this.apiBaseUrl}/users/login`, {
            form: {
                email,
                password,
            },
        });
        expect(loginRes.status(), 'Expected Notes API user login to return 200').toBe(200);

        const loginJson = (await loginRes.json()) as { data?: { token?: string } };
        const token = loginJson.data?.token;
        if (!token) {
            throw new Error('Failed to retrieve x-auth-token from Notes REST API /users/login');
        }

        return { name, email, password, token };
    }

    /**
     * Seeds a note directly via `POST /notes/api/notes` using the user's `x-auth-token`.
     */
    async createNoteViaApi(
        request: APIRequestContext,
        token: string,
        note: Omit<CreatedNoteRecord, 'id'>
    ): Promise<CreatedNoteRecord> {
        const createRes = await request.post(`${this.apiBaseUrl}/notes`, {
            headers: {
                'x-auth-token': token,
            },
            form: {
                title: note.title,
                description: note.description,
                category: note.category,
            },
        });

        expect(createRes.status(), 'Expected POST /notes/api/notes to return 200').toBe(200);
        const body = (await createRes.json()) as { data: { id: string; title: string; description: string; category: 'Home' | 'Work' | 'Personal' } };

        return {
            id: body.data.id,
            title: body.data.title,
            description: body.data.description,
            category: body.data.category,
        };
    }

    /**
     * Deletes a note via `DELETE /notes/api/notes/:id` for clean teardown.
     */
    async deleteNoteViaApi(request: APIRequestContext, token: string, noteId: string): Promise<void> {
        await request.delete(`${this.apiBaseUrl}/notes/${noteId}`, {
            headers: {
                'x-auth-token': token,
            },
        });
    }

    /**
     * Injects the API `token` into `localStorage` and opens the React Notes App dashboard,
     * falling back to UI login if the app clears token state on first load.
     */
    async openAuthenticatedNotesUi(credentials: SeededUserCredentials): Promise<void> {
        const page = this.smartPage.page;

        await page.addInitScript((token: string) => {
            window.localStorage.setItem('token', token);
        }, credentials.token);

        await this.smartPage.gotoPractice('/notes/app');

        // If the landing view still prompts for login, authenticate through the login form
        const loginLink = page.locator('a[href="/notes/app/login"], a:has-text("Login")');
        if ((await loginLink.count()) > 0 && (await loginLink.first().isVisible())) {
            await loginLink.first().click();
            await page.locator('input[name="email"], input[data-testid="login-email"]').fill(credentials.email);
            await page.locator('input[name="password"], input[data-testid="login-password"]').fill(credentials.password);
            await page.locator('button[type="submit"], button[data-testid="login-submit"]').click();
        }
    }

    getNoteCardByTitle(title: string): Locator {
        return this.smartPage.page.locator('[data-testid="note-card"], .card', {
            hasText: title,
        });
    }
}
