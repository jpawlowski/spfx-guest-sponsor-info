import { MSGraphClientV3 } from '@microsoft/sp-http';
import { ResponseType } from '@microsoft/microsoft-graph-client';
import { ISponsor } from './ISponsor';

/** Result returned by getSponsors. */
export interface ISponsorsResult {
  /** Sponsor accounts whose directory object still exists in Entra. */
  activeSponsors: ISponsor[];
  /**
   * Number of sponsor entries that were excluded because their directory object
   * could no longer be found (HTTP 404 – hard-deleted or past the soft-delete
   * recycle-bin period).  Accounts that are merely disabled (accountEnabled ===
   * false) still appear in activeSponsors because reading that property requires
   * User.Read.All, which exceeds the declared permission scope.
   */
  unavailableCount: number;
}

/**
 * Returns true when the SPFx login name belongs to a Microsoft Entra guest account.
 * Guest UPNs always contain the "#EXT#" marker introduced by Entra external identity.
 */
export function isGuestUser(loginName: string): boolean {
  return loginName.indexOf('#EXT#') !== -1;
}

/**
 * Converts an ArrayBuffer containing JPEG bytes into a base64-encoded data URL.
 * Avoids Blob-URL leaks because data URLs do not require explicit cleanup.
 */
function arrayBufferToDataUrl(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

/**
 * Checks whether a user object still exists in the directory.
 *
 * Returns false only on an explicit HTTP 404.  Any other error (throttling,
 * transient network failure) is treated as "still exists" so that a temporary
 * Graph outage does not incorrectly hide a sponsor card.
 *
 * Note: a *disabled* account (accountEnabled === false) still returns 200 here
 * because reading that flag on other users' objects requires User.Read.All, which
 * we intentionally do not request (least-privilege).
 */
async function userExists(client: MSGraphClientV3, userId: string): Promise<boolean> {
  try {
    await client.api(`/users/${userId}`).select('id').get();
    return true;
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) return false;
    return true;
  }
}

/**
 * Fetches the sponsors of the signed-in user via Microsoft Graph.
 * For each sponsor the function concurrently:
 *   1. Verifies the user object still exists (404 → unavailable).
 *   2. Fetches the profile photo (silent fallback to initials on any error).
 *
 * Required delegated permissions (declared in package-solution.json):
 *   - User.Read          – read the signed-in user's own /me/sponsors relationship.
 *   - User.ReadBasic.All – read existence and profile photos of the sponsor users.
 *                          This is the narrowest permission that covers reading
 *                          another user's directory object.  "ReadBasic" exposes
 *                          only: displayName, givenName, surname, mail, photo.
 *                          It does NOT expose accountEnabled (which requires
 *                          User.Read.All and is therefore out of scope).
 */
export async function getSponsors(client: MSGraphClientV3): Promise<ISponsorsResult> {
  const response = await client
    .api('/me/sponsors')
    .select('id,displayName,mail,jobTitle,department,officeLocation,businessPhones,mobilePhone')
    .get();

  if (!response?.value) return { activeSponsors: [], unavailableCount: 0 };

  const items = response.value as Record<string, unknown>[];
  const candidates: ISponsor[] = items.map(item => ({
    id: item.id as string,
    displayName: (item.displayName as string) || '',
    mail: (item.mail as string) || undefined,
    jobTitle: (item.jobTitle as string) || undefined,
    department: (item.department as string) || undefined,
    officeLocation: (item.officeLocation as string) || undefined,
    businessPhones: (item.businessPhones as string[]) || [],
    mobilePhone: (item.mobilePhone as string) || undefined,
  }));

  // For each sponsor, run the existence check and photo fetch concurrently.
  // All sponsors are also processed in parallel with each other.
  const results = await Promise.all(
    candidates.map(async sponsor => {
      const [exists, photoUrl] = await Promise.all([
        userExists(client, sponsor.id),
        (async (): Promise<string | undefined> => {
          try {
            const buffer: ArrayBuffer = await client
              .api(`/users/${sponsor.id}/photo/$value`)
              .responseType(ResponseType.ARRAYBUFFER)
              .get();
            return arrayBufferToDataUrl(buffer);
          } catch {
            // No photo available – initials fallback will be used.
            return undefined;
          }
        })(),
      ]);
      return { sponsor: { ...sponsor, photoUrl }, exists };
    })
  );

  const activeSponsors = results.filter(r => r.exists).map(r => r.sponsor);
  const unavailableCount = results.filter(r => !r.exists).length;
  return { activeSponsors, unavailableCount };
}
