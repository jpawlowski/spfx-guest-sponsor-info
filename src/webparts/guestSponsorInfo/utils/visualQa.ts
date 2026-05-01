// SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
// SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

import type { ISponsor } from '../services/ISponsor';

export type MockSimulatedHint =
  | 'none'
  | 'teamsAccessPending'
  | 'versionMismatch'
  | 'sponsorUnavailable'
  | 'noSponsors';

export type WindowWidthClass = 'compact' | 'medium' | 'expanded' | 'large' | 'extra-large';
export type WindowHeightClass = 'compact' | 'medium' | 'expanded';

export interface IVisualQaViewport {
  isTouch: boolean;
  widthClass: WindowWidthClass;
  heightClass: WindowHeightClass;
}

export interface IVisualQaOverrides {
  forceMockMode: boolean;
  mockSponsorCount?: number;
  mockSimulatedHint?: MockSimulatedHint;
  longMockContent: boolean;
  viewport?: IVisualQaViewport;
}

const VALID_HINTS: ReadonlyArray<MockSimulatedHint> = [
  'none',
  'teamsAccessPending',
  'versionMismatch',
  'sponsorUnavailable',
  'noSponsors',
];

const VIEWPORT_PRESETS: Readonly<Record<string, IVisualQaViewport>> = {
  phone: {
    isTouch: true,
    widthClass: 'compact',
    heightClass: 'expanded',
  },
  'phone-landscape': {
    isTouch: true,
    widthClass: 'expanded',
    heightClass: 'compact',
  },
  tablet: {
    isTouch: true,
    widthClass: 'medium',
    heightClass: 'expanded',
  },
  'desktop-touch': {
    isTouch: true,
    widthClass: 'extra-large',
    heightClass: 'expanded',
  },
};

function canUseVisualQaOverrides(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function isLocalQaHost(hostname: string): boolean {
  const normalized = hostname.trim().replace(/^\[|\]$/g, '').toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function hasLocalDebugManifest(url: URL): boolean {
  const manifestUrlRaw = url.searchParams.get('debugManifestsFile');
  if (!manifestUrlRaw) return false;

  try {
    const manifestUrl = new URL(manifestUrlRaw);
    return isLocalQaHost(manifestUrl.hostname) && manifestUrl.pathname === '/temp/build/manifests.js';
  } catch {
    return false;
  }
}

function isHostedWorkbenchPath(pathname: string): boolean {
  return pathname.trim().toLowerCase().endsWith('/_layouts/15/workbench.aspx');
}

function canUseVisualQaLocation(url: URL): boolean {
  if (isLocalQaHost(url.hostname)) return true;
  return isHostedWorkbenchPath(url.pathname) && hasLocalDebugManifest(url);
}

function resolveVisualQaLocation(search?: string, href?: string): URL | undefined {
  if (typeof href === 'string') {
    return new URL(href, 'http://localhost');
  }

  if (typeof window !== 'undefined') {
    return new URL(window.location.href);
  }

  if (typeof search === 'string') {
    return new URL(search.startsWith('?') ? `http://localhost/${search}` : `http://localhost/?${search}`);
  }

  return undefined;
}

function getSearchParams(search?: string, href?: string): URLSearchParams | undefined {
  if (!canUseVisualQaOverrides()) return undefined;

  const location = resolveVisualQaLocation(search, href);
  if (!location || !canUseVisualQaLocation(location)) {
    return undefined;
  }

  return new URLSearchParams(search ?? location.search);
}

function isTruthyFlag(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseSponsorCount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return undefined;
  return Math.min(5, Math.max(1, parsed));
}

function parseMockHint(value: string | undefined): MockSimulatedHint | undefined {
  if (!value) return undefined;
  return VALID_HINTS.indexOf(value as MockSimulatedHint) >= 0 ? value as MockSimulatedHint : undefined;
}

function parseViewport(value: string | undefined): IVisualQaViewport | undefined {
  if (!value) return undefined;
  return VIEWPORT_PRESETS[value];
}

export function getVisualQaOverrides(search?: string, href?: string): IVisualQaOverrides {
  const params = getSearchParams(search, href);
  if (!params) {
    return {
      forceMockMode: false,
      longMockContent: false,
    };
  }

  const mockSponsorCount = parseSponsorCount(params.get('gsi-qa-count') ?? undefined);
  const mockSimulatedHint = parseMockHint(params.get('gsi-qa-hint') ?? undefined);
  const longMockContent = isTruthyFlag(params.get('gsi-qa-long') ?? undefined);
  const forceMockMode =
    isTruthyFlag(params.get('gsi-qa-mock') ?? undefined) ||
    mockSponsorCount !== undefined ||
    mockSimulatedHint !== undefined ||
    longMockContent;

  return {
    forceMockMode,
    mockSponsorCount,
    mockSimulatedHint,
    longMockContent,
    viewport: parseViewport(params.get('gsi-qa-viewport') ?? undefined),
  };
}

export function applyVisualQaMockContent(sponsors: ISponsor[], longMockContent: boolean): ISponsor[] {
  if (!longMockContent) return sponsors;

  return sponsors.map((sponsor, index) => {
    if (index !== 0) return sponsor;

    return {
      ...sponsor,
      jobTitle: 'Senior Program Manager for Cross-Tenant Collaboration and Employee Experience',
      department: 'Digital Workplace Transformation and Employee Experience Operations',
      officeLocation: 'HQ Campus North / Building C / Floor 12 / Collaboration Studio 12-041 / Visitor Reception',
      streetAddress: 'Example Boulevard 123, Entrance 4, East Wing',
      city: 'Dusseldorf Metropolitan Region',
      state: 'North Rhine-Westphalia',
      managerJobTitle: 'Director of Strategic Operations and Employee Experience',
      managerDepartment: 'Corporate Services and Transformation Office',
    };
  });
}
