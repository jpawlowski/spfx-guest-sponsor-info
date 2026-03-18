/**
 * Unit tests for SponsorService.getSponsors().
 *
 * The Microsoft Graph client is replaced by a lightweight hand-rolled mock that
 * reproduces the fluent API chain used by the service:
 *
 *   client.api(path).select(fields).get()
 *   client.api(path).responseType(type).get()
 *
 * No real network calls are made.  For integration tests against a live
 * Microsoft 365 tenant (e.g. the Microsoft 365 Developer Program sandbox at
 * https://developer.microsoft.com/microsoft-365/dev-program), store the tenant
 * credentials as GitHub Actions secrets and add a separate workflow job that
 * runs only on protected branches.
 */
import { getSponsors, ISponsorsResult } from '../SponsorService';

// ─── Mock Graph client ─────────────────────────────────────────────────────────
// Each API path is routed to a dedicated handler function so tests can control
// responses per path without setting up complex URL-matching logic.

interface PathHandlers {
  /** Handler for GET /me/sponsors */
  sponsors: () => Promise<unknown>;
  /** Handler for GET /users/{id} (existence probe) */
  userExists: (id: string) => () => Promise<unknown>;
  /** Handler for GET /users/{id}/photo/$value */
  photo: (id: string) => () => Promise<unknown>;
}

function buildClient(handlers: PathHandlers): unknown {
  return {
    api: jest.fn((path: string) => {
      let getImpl: () => Promise<unknown>;

      if (path === '/me/sponsors') {
        getImpl = handlers.sponsors;
      } else if (/^\/users\/[^/]+\/photo\/\$value$/.test(path)) {
        const id = path.split('/')[2];
        getImpl = handlers.photo(id);
      } else if (/^\/users\/[^/]+$/.test(path)) {
        const id = path.split('/')[2];
        getImpl = handlers.userExists(id);
      } else {
        getImpl = () => Promise.resolve(null);
      }

      return {
        select: jest.fn().mockReturnThis(),
        responseType: jest.fn().mockReturnThis(),
        get: jest.fn().mockImplementation(getImpl),
      };
    }),
  };
}

/** Builds an error that matches the statusCode shape thrown by the Graph client. */
function graphError(statusCode: number): Error {
  const err = new Error(`Graph error ${statusCode}`) as Error & { statusCode: number };
  (err as { statusCode: number }).statusCode = statusCode;
  return err;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const SPONSOR_A = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  displayName: 'Alice Smith',
  mail: 'alice@contoso.com',
  jobTitle: 'Project Manager',
  department: 'Engineering',
  officeLocation: 'Berlin',
  businessPhones: ['+49 30 12345678'],
  mobilePhone: null,
};

const SPONSOR_B = {
  id: 'bbbbbbbb-0000-0000-0000-000000000002',
  displayName: 'Bob Jones',
  mail: 'bob@contoso.com',
  jobTitle: null,
  department: null,
  officeLocation: null,
  businessPhones: [],
  mobilePhone: '+1 555 0100',
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('getSponsors', () => {
  it('returns an empty result when /me/sponsors has no value property', async () => {
    const client = buildClient({
      sponsors: () => Promise.resolve(null),
      userExists: () => () => Promise.resolve({ id: 'x' }),
      photo: () => () => Promise.reject(new Error('no photo')),
    });

    const result: ISponsorsResult = await getSponsors(client as never);

    expect(result.activeSponsors).toHaveLength(0);
    expect(result.unavailableCount).toBe(0);
  });

  it('returns an empty result when the sponsor list is an empty array', async () => {
    const client = buildClient({
      sponsors: () => Promise.resolve({ value: [] }),
      userExists: () => () => Promise.resolve({}),
      photo: () => () => Promise.reject(new Error('no photo')),
    });

    const result = await getSponsors(client as never);

    expect(result.activeSponsors).toHaveLength(0);
    expect(result.unavailableCount).toBe(0);
  });

  it('maps all profile fields of an active sponsor', async () => {
    const fakePhotoBuffer = new ArrayBuffer(4);
    const client = buildClient({
      sponsors: () => Promise.resolve({ value: [SPONSOR_A] }),
      userExists: () => () => Promise.resolve({ id: SPONSOR_A.id }),
      photo: () => () => Promise.resolve(fakePhotoBuffer),
    });

    const result = await getSponsors(client as never);

    expect(result.unavailableCount).toBe(0);
    expect(result.activeSponsors).toHaveLength(1);

    const s = result.activeSponsors[0];
    expect(s.id).toBe(SPONSOR_A.id);
    expect(s.displayName).toBe('Alice Smith');
    expect(s.mail).toBe('alice@contoso.com');
    expect(s.jobTitle).toBe('Project Manager');
    expect(s.department).toBe('Engineering');
    expect(s.officeLocation).toBe('Berlin');
    expect(s.businessPhones).toEqual(['+49 30 12345678']);
    // The ArrayBuffer should have been encoded as a base64 data URL.
    expect(s.photoUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('excludes a sponsor whose directory object returns HTTP 404 (hard-deleted account)', async () => {
    const client = buildClient({
      sponsors: () => Promise.resolve({ value: [SPONSOR_A] }),
      userExists: () => () => Promise.reject(graphError(404)),
      photo: () => () => Promise.reject(new Error('no photo')),
    });

    const result = await getSponsors(client as never);

    expect(result.activeSponsors).toHaveLength(0);
    expect(result.unavailableCount).toBe(1);
  });

  it('keeps a sponsor when the existence probe fails with a non-404 error (transient outage)', async () => {
    // A service-unavailable error must not incorrectly hide an active sponsor.
    const client = buildClient({
      sponsors: () => Promise.resolve({ value: [SPONSOR_A] }),
      userExists: () => () => Promise.reject(graphError(503)),
      photo: () => () => Promise.reject(new Error('no photo')),
    });

    const result = await getSponsors(client as never);

    expect(result.activeSponsors).toHaveLength(1);
    expect(result.unavailableCount).toBe(0);
  });

  it('sets photoUrl to undefined and still shows the card when the photo request fails', async () => {
    const client = buildClient({
      sponsors: () => Promise.resolve({ value: [SPONSOR_A] }),
      userExists: () => () => Promise.resolve({ id: SPONSOR_A.id }),
      photo: () => () => Promise.reject(new Error('forbidden')),
    });

    const result = await getSponsors(client as never);

    expect(result.activeSponsors).toHaveLength(1);
    expect(result.activeSponsors[0].photoUrl).toBeUndefined();
  });

  it('handles multiple sponsors independently: one active, one deleted', async () => {
    const client = buildClient({
      sponsors: () => Promise.resolve({ value: [SPONSOR_A, SPONSOR_B] }),
      userExists: (id) => () => {
        if (id === SPONSOR_B.id) return Promise.reject(graphError(404));
        return Promise.resolve({ id });
      },
      photo: () => () => Promise.reject(new Error('no photo')),
    });

    const result = await getSponsors(client as never);

    expect(result.activeSponsors).toHaveLength(1);
    expect(result.activeSponsors[0].id).toBe(SPONSOR_A.id);
    expect(result.unavailableCount).toBe(1);
  });

  it('marks all sponsors as unavailable when all existence probes return 404', async () => {
    const client = buildClient({
      sponsors: () => Promise.resolve({ value: [SPONSOR_A, SPONSOR_B] }),
      userExists: () => () => Promise.reject(graphError(404)),
      photo: () => () => Promise.reject(new Error('no photo')),
    });

    const result = await getSponsors(client as never);

    expect(result.activeSponsors).toHaveLength(0);
    expect(result.unavailableCount).toBe(2);
  });

  it('passes mobilePhone through correctly when businessPhones is empty', async () => {
    const client = buildClient({
      sponsors: () => Promise.resolve({ value: [SPONSOR_B] }),
      userExists: () => () => Promise.resolve({ id: SPONSOR_B.id }),
      photo: () => () => Promise.reject(new Error('no photo')),
    });

    const result = await getSponsors(client as never);

    expect(result.activeSponsors[0].mobilePhone).toBe('+1 555 0100');
    expect(result.activeSponsors[0].businessPhones).toEqual([]);
  });
});
