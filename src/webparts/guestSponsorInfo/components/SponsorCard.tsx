// SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
// SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

import * as React from 'react';
import {
  Avatar,
  Button,
  FluentProvider,
  OverlayDrawer,
  DrawerBody,
  Persona,
  Popover,
  PopoverSurface,
  Link,
  Tooltip,
  makeStyles,
  tokens,
  mergeClasses,
} from '@fluentui/react-components';
import type { PresenceBadgeStatus, Theme } from '@fluentui/react-components';
import { RendererProvider } from '@griffel/react';
import { griffelRenderer } from '../griffelRenderer';
import {
  bundleIcon,
  ChatRegular,
  ChatFilled,
  MailRegular,
  MailFilled,
  CallRegular,
  CallFilled,
  CopyRegular,
  CopyFilled,
  CheckmarkRegular,
  CheckmarkFilled,
  PhoneRegular,
  BuildingRegular,
  LocationRegular,
  DismissRegular,
} from '@fluentui/react-icons';

const ChatIcon = bundleIcon(ChatFilled, ChatRegular);
const MailIcon = bundleIcon(MailFilled, MailRegular);
const CallIcon = bundleIcon(CallFilled, CallRegular);
const CopyIcon = bundleIcon(CopyFilled, CopyRegular);
const CheckmarkIcon = bundleIcon(CheckmarkFilled, CheckmarkRegular);
import * as strings from 'GuestSponsorInfoWebPartStrings';
import { ISponsor } from '../services/ISponsor';
import { buildExternalMapLink } from '../utils/mapProviderUtils';
import { getVisualQaOverrides, type WindowHeightClass, type WindowWidthClass } from '../utils/visualQa';

/**
 * Returns "givenName surname" when either part is non-empty, otherwise falls
 * back to displayName. Mirrors how Microsoft renders names in Teams/Outlook.
 */
function resolvePersonName(
  givenName: string | undefined,
  surname: string | undefined,
  displayName: string | undefined
): string {
  const first = givenName?.trim() ?? '';
  const last = surname?.trim() ?? '';
  if (first || last) return [first, last].filter(Boolean).join(' ');
  return displayName?.trim() ?? '';
}

type AddressDisplayPattern = 'postal-code-before-city' | 'city-state-postal-code';

interface IAddressComponents {
  streetAddress?: string;
  postalCode?: string;
  city?: string;
  stateOrProvince?: string;
  country?: string;
}

// Most postal systems display postal code before locality. Only a relatively
// small group of countries needs a dedicated city/state/postal override.
// Common aliases and ISO codes are included so Graph values such as "US" or
// "United States" resolve to the same exception pattern.
const CITY_STATE_POSTAL_CODE_COUNTRIES = new Set([
  'au', 'australia',
  'ca', 'canada',
  'gb', 'great britain', 'uk', 'united kingdom',
  'ie', 'eire', 'ireland',
  'us', 'usa', 'united states', 'united states of america',
]);

const CITY_LEVEL_MAP_ENTITY_TYPES = new Set(['Municipality', 'MunicipalitySubdivision', 'Neighbourhood', 'PostalCodeArea']);

function normalizeAddressToken(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readAddressValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function joinNonEmpty(parts: Array<string | undefined>, separator: string): string {
  return parts
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(separator);
}

function getAddressDisplayPattern(countryOrRegion: string | undefined): AddressDisplayPattern {
  const normalizedCountry = normalizeAddressToken(countryOrRegion);
  if (CITY_STATE_POSTAL_CODE_COUNTRIES.has(normalizedCountry)) {
    return 'city-state-postal-code';
  }
  return 'postal-code-before-city';
}

function formatDisplayAddress(
  components: IAddressComponents,
  countryOrRegionForPattern: string | undefined
): string {
  const pattern = getAddressDisplayPattern(countryOrRegionForPattern);
  const postalCodeAndCity = joinNonEmpty([components.postalCode, components.city], ' ');

  switch (pattern) {
    case 'postal-code-before-city': {
      const locality = postalCodeAndCity || components.stateOrProvince;
      return joinNonEmpty([components.streetAddress, locality, components.country], ', ');
    }
    case 'city-state-postal-code': {
      const locality = joinNonEmpty(
        [components.city, components.stateOrProvince, components.postalCode],
        ' '
      ) || components.stateOrProvince;
      return joinNonEmpty([components.streetAddress, locality, components.country], ', ');
    }
    default: {
      const locality = postalCodeAndCity || components.stateOrProvince;
      return joinNonEmpty([components.streetAddress, locality, components.country], ', ');
    }
  }
}

function formatMapsQueryAddress(components: IAddressComponents): string {
  const postalCodeAndCity = joinNonEmpty([components.postalCode, components.city], ' ');
  return joinNonEmpty(
    [components.streetAddress, postalCodeAndCity, components.stateOrProvince, components.country],
    ', '
  );
}



/**
 * Maps Graph presence availability and activity tokens → localised label.
 * Activity tokens (InAMeeting, InACall, …) take priority over the base availability token,
 * matching Microsoft's profile card display behaviour.
 */
/**
 * Returns a map of Graph presence tokens to localised labels.
 * Evaluated lazily (called at render time, not at module load time) so that
 * the SPFx AMD string bundle is guaranteed to be loaded before access.
 */
function getPresenceLabels(): Record<string, string> {
  return {
    // availability tokens
    Available:       strings.PresenceAvailable,
    AvailableIdle:   strings.PresenceAvailableIdle,
    Away:            strings.PresenceAway,
    BeRightBack:     strings.PresenceBeRightBack,
    Busy:            strings.PresenceBusy,
    BusyIdle:        strings.PresenceBusyIdle,
    DoNotDisturb:    strings.PresenceDoNotDisturb,
    Offline:         strings.PresenceOffline,
    PresenceUnknown: '',
    // activity-specific tokens (refine the base availability label)
    Focusing:        strings.PresenceFocusing,
    InACall:         strings.PresenceInACall,
    InAMeeting:      strings.PresenceInAMeeting,
    OffWork:         strings.PresenceOffline,
    OutOfOffice:     strings.PresenceOutOfOffice,
    Presenting:      strings.PresencePresenting,
  };
}

/**
 * Converts a Graph presence activity token (PascalCase, e.g. InAMeeting) into a
 * localised, human-readable label matching Microsoft's profile card behaviour.
 * All documented tokens are resolved via getPresenceLabels(); unknown tokens fall back
 * to a generic PascalCase word-splitter (English only).
 */
function formatPresenceActivity(activity: string): string {
  const normalized = activity.trim();
  if (!normalized || normalized === 'PresenceUnknown') return '';

  // Use the typed map for all documented tokens (also covers availability mirrors).
  const typed = getPresenceLabels()[normalized];
  if (typed !== undefined) return typed;

  // Fallback for undocumented activity tokens: split PascalCase into words.
  const words = normalized
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return '';

  const lowercaseJoiners = new Set([
    'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with',
  ]);

  return words
    .map((w, index) => {
      const lower = w.toLowerCase();
      if (index > 0 && lowercaseJoiners.has(lower)) return lower;
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

/**
 * Maps Graph presence availability and activity tokens to Fluent UI v9
 * PresenceBadge status. Focusing maps to do-not-disturb (closest v9 equivalent).
 */
function graphPresenceToPresenceBadge(
  availability: string | undefined,
  activity: string | undefined
): { status: PresenceBadgeStatus; isOutOfOffice: boolean } {
  if (activity === 'OutOfOffice') {
    return { status: 'out-of-office', isOutOfOffice: true };
  }
  if (activity === 'Focusing') {
    return { status: 'do-not-disturb', isOutOfOffice: false };
  }
  switch (availability) {
    case 'Available':
    case 'AvailableIdle':
      return { status: 'available', isOutOfOffice: false };
    case 'Away':
    case 'BeRightBack':
      return { status: 'away', isOutOfOffice: false };
    case 'Busy':
    case 'BusyIdle':
      return { status: 'busy', isOutOfOffice: false };
    case 'DoNotDisturb':
      return { status: 'do-not-disturb', isOutOfOffice: false };
    case 'Offline':
      return { status: 'offline', isOutOfOffice: false };
    default:
      return { status: 'unknown', isOutOfOffice: false };
  }
}

/**
 * Griffel styles for the card thumbnail tiles visible in the sponsor grid.
 * Covers both the default vertical layout (136px tiles) and the compact
 * horizontal row variant used in narrow SharePoint columns.
 */
const useCardTileStyles = makeStyles({
  card: {
    position: 'relative' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
    minHeight: '122px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    outline: 'none',
    backgroundColor: 'transparent',
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${tokens.colorStrokeFocus2}`,
    },
  },
  cardReadOnly: {
    cursor: 'default',
  },
  cardCompact: {
    position: 'relative' as const,
    display: 'inline-flex',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: tokens.spacingHorizontalMNudge,
    padding: tokens.spacingVerticalSNudge,
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    outline: 'none',
    backgroundColor: 'transparent',
    maxWidth: '100%',
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${tokens.colorStrokeFocus2}`,
    },
  },
  avatarWrapper: {
    position: 'relative' as const,
    display: 'inline-flex',
  },
  avatarWrapperCompact: {
    position: 'relative' as const,
    display: 'inline-flex',
    flexShrink: 0,
  },
  cardName: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    textAlign: 'center' as const,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase300,
    maxWidth: '100%',
    display: '-webkit-box' as 'flex',
    WebkitLineClamp: '3',
    WebkitBoxOrient: 'vertical' as 'horizontal',
    overflow: 'hidden',
  },
  cardNameCompact: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase300,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
});

/**
 * Griffel styles for the rich contact card (the detail popup / drawer).
 *
 * Cross-class hover effects (e.g. hovering a row reveals the copy button)
 * use CSS custom properties set by the parent row and read by children.
 * This avoids Griffel's limitation of not being able to reference one
 * atomic class from another's descendant selector.
 */
const useRichCardStyles = makeStyles({
  richCard: {
    width: '360px',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    overflow: 'hidden',
    boxShadow: tokens.shadow16,
    animationName: {
      from: { opacity: 0, transform: 'translateY(-6px) scale(0.98)' },
      to: { opacity: 1, transform: 'translateY(0) scale(1)' },
    },
    animationDuration: '180ms',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    animationFillMode: 'both',
    '@media (prefers-reduced-motion: reduce)': {
      animationName: 'none',
      animationDuration: '0s',
    },
  },
  richCardHeaderPanel: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
    zIndex: 2,
    flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  richCardBody: {
    overflowY: 'auto' as const,
    maxHeight: '0',
    opacity: 0,
    position: 'relative' as const,
    zIndex: 1,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderTop: 'none',
    borderRadius: `0 0 ${tokens.borderRadiusLarge} ${tokens.borderRadiusLarge}`,
    marginTop: '-8px',
    paddingTop: tokens.spacingVerticalS,
    transitionProperty: 'max-height, opacity',
    transitionDuration: `${tokens.durationSlower}, ${tokens.durationNormal}`,
    transitionTimingFunction: `${tokens.curveEasyEase}, ease-in-out`,
  },
  richCardBodyDrawer: {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box' as const,
    display: 'block',
    paddingBottom: tokens.spacingVerticalXXL,
  },
  richCardBodyExpanded: {
    maxHeight: 'min(300px, 50vh)',
    opacity: 1,
    paddingBottom: tokens.spacingVerticalXXL,
  },
  richHeader: {
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL} 0`,
  },
  richHeaderFlat: {
    paddingTop: tokens.spacingVerticalL,
  },
  richHeaderFlatWithHandle: {
    paddingTop: 0,
  },
  richActions: {
    display: 'flex',
    justifyContent: 'flex-start',
    gap: tokens.spacingHorizontalM,
    padding: `0 ${tokens.spacingHorizontalXXL} ${tokens.spacingVerticalL}`,
  },
  richSectionTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.01em',
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL} ${tokens.spacingVerticalXXS}`,
    color: tokens.colorNeutralForeground1,
  },
  richSection: {
    padding: '0',
  },
  richSectionDivider: {
    height: '1px',
    backgroundColor: tokens.colorNeutralStroke2,
    margin: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL} 0`,
  },
  richInfoRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    minHeight: '32px',
    padding: `0 ${tokens.spacingHorizontalXXL}`,
    alignItems: 'center',
    color: 'inherit',
    position: 'relative' as const,
  },
  // Sets CSS custom properties on hover that child elements (richInfoValue,
  // copyButton) read via var(). Only applied on devices with a precise pointer.
  richInfoRowInteractive: {
    '@media (hover: hover)': {
      '&:hover': {
        backgroundColor: tokens.colorNeutralBackground2,
        '--gsi-info-brightness': 'brightness(0.75)',
        '--gsi-copy-opacity': '1',
      },
    },
  },
  richInfoText: {
    flex: '1',
    minWidth: '0',
  },
  richInfoIcon: {
    fontSize: '24px',
    flexShrink: 0,
    width: '24px',
    textAlign: 'center' as const,
    color: tokens.colorNeutralForeground2,
  },
  richInfoValue: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorBrandForeground1,
    overflowWrap: 'break-word' as const,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'none',
    },
    // Stretch an invisible click target across the entire row so the user can
    // click anywhere in the row to follow the link.
    '&[href]::before': {
      content: '""',
      position: 'absolute' as const,
      inset: '0',
    },
    // Plain-text values (not links): darken on row hover via the custom property.
    '&:not(a)': {
      filter: 'var(--gsi-info-brightness, none)',
    },
  },
  copyButton: {
    position: 'relative' as const,
    zIndex: 1,
    flexShrink: 0,
    // Read from the parent row's --gsi-copy-opacity custom property, falling
    // back to 0 (hidden) when the row is not hovered.
    opacity: 'var(--gsi-copy-opacity, 0)' as unknown as number,
    transitionProperty: 'opacity',
    transitionDuration: '80ms',
    transitionTimingFunction: 'ease',
    '&:focus-visible': {
      opacity: 1,
    },
    // Touch devices have no hover state — show copy buttons permanently.
    '@media (hover: none)': {
      opacity: 1,
    },
  },
  copyButtonCopied: {
    opacity: 1,
    color: tokens.colorStatusSuccessForeground1,
  },
  mapPreviewInline: {
    // 60px = row padding-left (24px) + icon width (24px) + gap (12px) — no spacing token available
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXXL} ${tokens.spacingVerticalS} 60px`,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: tokens.spacingHorizontalS,
  },
  mapPreviewImage: {
    width: '100%',
    maxWidth: '100%',
    height: 'auto',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  mapPreviewStatus: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  managerRow: {
    padding: `${tokens.spacingVerticalSNudge} ${tokens.spacingHorizontalXXL} 0`,
  },
});

const useMobileDrawerStyles = makeStyles({
  /**
   * OverlayDrawer portals out of the web part tree, so the nested FluentProvider
   * becomes the direct DOM child of the panel. It must stretch to the panel's
   * height, otherwise DrawerBody collapses and the sheet appears empty.
   */
  drawerProvider: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: '1 1 auto',
    width: '100%',
    minHeight: 0,
    height: '100%',
  },
  /**
   * Full-height flex column that wraps the drag handle, close bar, and
   * DrawerBody inside the OverlayDrawer panel.
   */
  drawerContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: '1 1 auto',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box' as const,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  drawerHeaderBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXXS}`,
    flexShrink: 0,
  },
  drawerHeaderBarSideSheet: {
    paddingTop: tokens.spacingVerticalSNudge,
  },

  /**
   * Flex wrapper around DrawerBody that provides position:relative so the
   * scroll-shadow overlay can be positioned inside it without affecting layout.
   */
  drawerBodyWrapper: {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    flex: '1 1 0',
    width: '100%',
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  /**
   * Gradient overlay at the top of the scroll area. Fades from the panel
   * background to transparent, indicating content scrolled out above.
   * Follows iOS/Material convention: subtle gradient, no hard shadow.
   */
  drawerScrollTopShadow: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: '40px',
    background: `linear-gradient(to bottom, ${tokens.colorNeutralBackground1} 0%, transparent 100%)`,
    pointerEvents: 'none' as const,
    zIndex: 1,
    opacity: 0,
    transitionProperty: 'opacity',
    transitionDuration: tokens.durationNormal,
    transitionTimingFunction: 'ease',
  },
  drawerScrollTopShadowVisible: {
    opacity: 1,
  },
  /** iOS-style pill indicator shown at the top of the bottom sheet. */
  drawerDragHandle: {
    // Purely visual indicator: touch input should pass through to the drawer
    // surface so the whole card behaves identically.
    width: '100%',
    height: '28px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none' as const,
    ':before': {
      content: '""',
      display: 'block',
      width: '36px',
      height: '4px',
      backgroundColor: tokens.colorNeutralStroke1,
      borderRadius: tokens.borderRadiusCircular,
    },
  },
});

/**
 * Griffel styles for Persona text slots in the rich card header and manager row.
 * Replaces the SCSS classes that previously styled the manual avatar+div structure.
 */
const usePersonaStyles = makeStyles({
  // ── Rich card header (size="huge", 96px avatar) ──────────────────────────
  richName: {
    fontSize: tokens.fontSizeBase400,       // 16px
    fontWeight: tokens.fontWeightSemibold,  // 600
    color: tokens.colorNeutralForeground1,
    display: '-webkit-box' as 'flex',       // line-clamp for long names
    WebkitLineClamp: '2',
    WebkitBoxOrient: 'vertical' as 'horizontal',
    overflow: 'hidden',
  },
  richSecondary: {
    fontSize: tokens.fontSizeBase200,       // 12px — job title or department
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: tokens.spacingHorizontalSNudge, // 6px — block 1→2 separator (name → text)
  },
  richTertiary: {
    fontSize: tokens.fontSizeBase200,       // 12px — department (same block as job title)
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground3,  // slightly lighter than job title — matches manager style
    // no marginTop — tight within-block spacing (Gestalt proximity)
  },
  richPresenceLine: {
    fontSize: tokens.fontSizeBase300,       // 14px — matches contact info rows
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingHorizontalSNudge, // 6px — block 2→3 separator
  },
  // ── Manager row (size="extra-large", 56px avatar) ────────────────────────
  managerName: {
    fontSize: tokens.fontSizeBase400,       // 16px — matches previous .managerName
    fontWeight: tokens.fontWeightRegular,   // 400
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  managerSecondary: {
    fontSize: tokens.fontSizeBase200,       // 12px — job title
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: tokens.spacingHorizontalXS,  // 4px — block 1→2 separator (scaled for smaller avatar)
  },
  managerTertiary: {
    fontSize: tokens.fontSizeBase200,       // 12px — department (same block as job title)
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    // no marginTop — tight within-block spacing (Gestalt proximity)
  },
  // Override the internal avatar↔text gap to match the 24px card-edge padding.
  // Fluent sets --fui-Persona__avatar--spacing on the .fui-Persona__avatar element
  // itself (not inherited from the root), so we must target that element directly.
  // Our compound selector (.richPersona .fui-Persona__avatar) has specificity
  // 0,2,0 vs Fluent's internal single-class 0,1,0 — so we reliably win.
  richPersona: {
    '& .fui-Persona__avatar': {
      '--fui-Persona__avatar--spacing': tokens.spacingHorizontalXXL, // 24px = card edge
    },
  },
  managerPersona: {
    '& .fui-Persona__avatar': {
      '--fui-Persona__avatar--spacing': tokens.spacingHorizontalXXL, // 24px = card edge
    },
  },
});

/** Griffel styles for the icon-only action buttons in the rich card header. */
const useActionButtonStyles = makeStyles({
  actionButton: {
    // 44 × 44 px matches Fluent UI's `size="large"` icon-button footprint and
    // the Teams People Card action button size. The built-in `size` prop on
    // Button changes both padding and min-width/height; override explicitly so
    // we keep `appearance="subtle"` without other `large` layout side-effects
    // (e.g. larger label font). Icon size 24px matches Teams.
    padding: tokens.spacingHorizontalSNudge,
    borderRadius: tokens.borderRadiusMedium,
    minWidth: '44px',
    width: '44px',
    height: '44px',
    color: tokens.colorNeutralForeground2,
    backgroundColor: 'transparent',
    '& .fui-Button__icon': {
      fontSize: '24px',
      width: '24px',
      height: '24px',
    },
    '&:hover': {
      backgroundColor: 'transparent',
    },
    '&:hover:active': {
      backgroundColor: 'transparent',
    },
    // Colour change + filled icon swap only when hovering directly over the icon,
    // not the surrounding padding. The full button area remains clickable.
    '& .fui-Button__icon:hover': {
      color: tokens.colorNeutralForeground2BrandHover,
      '& .fui-Icon-filled': { display: 'inline' },
      '& .fui-Icon-regular': { display: 'none' },
    },
    '& .fui-Button__icon:hover:active': {
      color: tokens.colorNeutralForeground2BrandPressed,
    },
  },
});

/**
 * Small copy-to-clipboard button shown at the trailing edge of each contact row.
 * Switches to a checkmark for 1.5 s after a successful copy.
 */
const CopyButton: React.FC<{ value: string; ariaLabel: string }> = ({ value, ariaLabel }) => {
  const [copied, setCopied] = React.useState(false);
  const actionButtonClasses = useActionButtonStyles();
  const richClasses = useRichCardStyles();

  const handleCopy = (e: React.MouseEvent<HTMLElement>): void => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => { /* clipboard access denied - silently ignore */ });
  };

  return (
    <Tooltip content={copied ? strings.CopiedFeedback : ariaLabel} relationship="label">
      <Button
        appearance="subtle"
        icon={copied ? <CheckmarkIcon /> : <CopyIcon />}
        aria-label={copied ? strings.CopiedFeedback : ariaLabel}
        onClick={handleCopy}
        className={mergeClasses(actionButtonClasses.actionButton, richClasses.copyButton, copied ? richClasses.copyButtonCopied : '')}
        size="small"
      />
    </Tooltip>
  );
};

interface IViewport {
  isTouch: boolean;
  widthClass: WindowWidthClass;
  heightClass: WindowHeightClass;
}

const DEFAULT_VIEWPORT: IViewport = { isTouch: false, widthClass: 'compact', heightClass: 'medium' };

const COARSE_POINTER_QUERY = '(pointer: coarse)';

let viewportSnapshot: IViewport = DEFAULT_VIEWPORT;
let viewportMediaQueryList: MediaQueryList | undefined;
let viewportCleanup: (() => void) | undefined;
const viewportSubscribers = new Set<React.Dispatch<React.SetStateAction<IViewport>>>();

function sameViewport(left: IViewport, right: IViewport): boolean {
  return left.isTouch === right.isTouch && left.widthClass === right.widthClass && left.heightClass === right.heightClass;
}

function getCurrentViewportSnapshot(mediaQueryList?: MediaQueryList): IViewport {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return DEFAULT_VIEWPORT;
  }

  const visualQaViewport = getVisualQaOverrides().viewport;
  if (visualQaViewport) {
    return visualQaViewport as IViewport;
  }

  const coarsePointerMediaQuery = mediaQueryList ?? window.matchMedia(COARSE_POINTER_QUERY);
  return {
    isTouch: coarsePointerMediaQuery.matches,
    widthClass: classifyWindowWidth(window.innerWidth),
    heightClass: classifyWindowHeight(window.innerHeight),
  };
}

function publishViewportSnapshot(): void {
  const nextViewport = getCurrentViewportSnapshot(viewportMediaQueryList);
  if (sameViewport(viewportSnapshot, nextViewport)) {
    return;
  }

  viewportSnapshot = nextViewport;
  viewportSubscribers.forEach(setViewport => {
    setViewport(currentViewport => sameViewport(currentViewport, nextViewport) ? currentViewport : nextViewport);
  });
}

function ensureViewportListenerRegistration(): void {
  if (viewportCleanup || typeof window === 'undefined' || !window.matchMedia) {
    return;
  }

  viewportMediaQueryList = window.matchMedia(COARSE_POINTER_QUERY);
  viewportSnapshot = getCurrentViewportSnapshot(viewportMediaQueryList);

  const handleViewportChange = (): void => {
    publishViewportSnapshot();
  };

  viewportMediaQueryList.addEventListener('change', handleViewportChange);
  window.addEventListener('resize', handleViewportChange);

  viewportCleanup = () => {
    viewportMediaQueryList?.removeEventListener('change', handleViewportChange);
    window.removeEventListener('resize', handleViewportChange);
    viewportMediaQueryList = undefined;
    viewportCleanup = undefined;
  };
}

function subscribeToViewportStore(setViewport: React.Dispatch<React.SetStateAction<IViewport>>): () => void {
  ensureViewportListenerRegistration();
  viewportSubscribers.add(setViewport);
  setViewport(currentViewport => sameViewport(currentViewport, viewportSnapshot) ? currentViewport : viewportSnapshot);

  return () => {
    viewportSubscribers.delete(setViewport);
    if (viewportSubscribers.size === 0) {
      viewportCleanup?.();
    }
  };
}

function classifyWindowWidth(width: number): WindowWidthClass {
  if (width < 600) return 'compact';
  if (width < 840) return 'medium';
  if (width < 1200) return 'expanded';
  if (width < 1600) return 'large';
  return 'extra-large';
}

function classifyWindowHeight(height: number): WindowHeightClass {
  if (height < 480) return 'compact';
  if (height < 900) return 'medium';
  return 'expanded';
}

/**
 * Returns the CSS value for `--fui-Drawer--size` on the side drawer, chosen
 * from the current window width and height classes.
 *
 * Height class takes priority: a compact-height window (phone landscape) gets
 * the narrowest drawer regardless of its width class. For taller viewports,
 * wider width classes receive progressively more space.
 */
function sideDrawerWidth(widthClass: WindowWidthClass, heightClass: WindowHeightClass): string {
  if (heightClass === 'compact')   return 'clamp(320px, 46vw, 420px)'; // phone landscape
  if (widthClass === 'medium')     return 'clamp(360px, 44vw, 460px)'; // small tablet
  if (widthClass === 'expanded')   return 'clamp(400px, 36vw, 480px)'; // large tablet
  return 'clamp(420px, 32vw, 520px)';                                   // desktop-scale touch
}

/**
 * Derives responsive touch classes from the current window size.
 *
 * This mirrors the platform guidance more closely than pure orientation checks:
 * - Apple uses compact/regular size classes rather than device-name breakpoints.
 * - Material/Android recommends width classes at 600/840/1200 dp and a compact-height
 *   override for short landscape windows.
 *
 * The resulting classes let us keep phone portrait as a bottom sheet while using a
 * trailing side sheet for phone landscape and tablet-sized windows.
 */
function useTouchViewport(): IViewport {
  const [viewport, setViewport] = React.useState<IViewport>(() => getCurrentViewportSnapshot());

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    return subscribeToViewportStore(setViewport);
  }, []);

  return viewport;
}

/**
 * Adds a native-feeling swipe-to-dismiss gesture to a Fluent UI OverlayDrawer.
 *
 * The hook attaches non-passive `touchmove` listeners to the DrawerBody element
 * (the direct parent of `scrollRef.current`) so it can call `preventDefault()`
 * and prevent conflicting scroll behaviour while a dismiss drag is in progress.
 *
 * It finds the drawer panel by walking up the DOM to the element with
 * `role="dialog"`, then applies a CSS `transform` to that element in real time
 * so the user sees the panel follow their finger.
 *
 * Dismissing only arms when the gesture STARTS while the scroll container is
 * already at its top edge. If the user scrolls upward from deeper content and
 * merely reaches the top during the same gesture, the drawer will not start to
 * close until they release and begin a fresh swipe. This matches the native
 * "scroll first, then dismiss" interaction the mobile view needs.
 *
 * On release:
 * - displacement ≥ 100 px OR flick velocity ≥ 0.4 px/ms → animate off-screen
 *   and call `onDismiss`
 * - otherwise → spring back to the resting position
 */
function useSwipeToDismiss(
  scrollRef: React.RefObject<HTMLDivElement>,
  onDismiss: () => void,
  enabled: boolean,
  direction: 'down' | 'end'
): void {
  // Stable ref so onDismiss identity changes never force the effect to re-run.
  const onDismissRef = React.useRef(onDismiss);
  onDismissRef.current = onDismiss;

  React.useEffect(() => {
    if (!enabled) return;
    const inner = scrollRef.current;
    if (!inner) return;

    // The DrawerBody (direct parent of the inner wrapper div) is the scroll
    // container whose scrollTop / scrollLeft we check to decide whether a
    // downward/rightward touch should be treated as a scroll or a dismiss drag.
    const scrollContainer = inner.parentElement as HTMLElement | null;
    if (!scrollContainer) return;

    // Walk up the DOM tree to find the drawer panel (role="dialog").
    let panel: HTMLElement | null = scrollContainer.parentElement;
    while (panel && panel.getAttribute('role') !== 'dialog') {
      panel = panel.parentElement;
    }
    if (!panel) return;

    // Find the overlay backdrop — typically the previous sibling of the panel
    // in the portal container — so we can fade it proportionally during drag.
    const backdrop = panel.previousElementSibling as HTMLElement | null;

    let startPrimary = 0;
    let startSecondary = 0;
    let isDragging = false;
    let currentTranslate = 0;
    let lastPrimary = 0;
    let lastTimestamp = 0;
    let velocity = 0;
    let panelSize = 0; // cached in touchstart to avoid layout reads in touchmove
    let springBackTimer = 0;
    let dismissTimer = 0;

    // Minimum movement (px) before recognising a dismiss gesture.
    const DRAG_START_MIN = 8;
    // Displacement (px) past which lifting the finger always dismisses.
    const DISMISS_DISTANCE = 100;
    // Flick velocity (px/ms) that triggers dismiss regardless of displacement.
    const DISMISS_VELOCITY = 0.4;

    const getPrimary   = (t: Touch): number => direction === 'down' ? t.clientY : t.clientX;
    const getSecondary = (t: Touch): number => direction === 'down' ? t.clientX : t.clientY;

    const setTransform = (v: number): void => {
      panel!.style.transform = direction === 'down'
        ? `translateY(${v}px)`
        : `translateX(${v}px)`;
    };

    // Tracks whether the current touch sequence belongs to the drawer surface.
    let gestureSource: 'content' | 'other' = 'other';
    let canDismissCurrentGesture = false;

    const onTouchEnd = (): void => {
      const shouldFinishDrag = isDragging;
      isDragging = false;
      gestureSource = 'other';
      canDismissCurrentGesture = false;
      if (!shouldFinishDrag) return;
      if (currentTranslate >= DISMISS_DISTANCE || velocity >= DISMISS_VELOCITY) {
        // Animate the panel off-screen then invoke the dismiss callback.
        const size = panelSize > 0 ? panelSize : (direction === 'down' ? panel!.offsetHeight : panel!.offsetWidth);
        panel!.style.transition = 'transform 200ms cubic-bezier(0.4, 0, 1, 1)';
        if (backdrop) {
          backdrop.style.transition = 'opacity 200ms cubic-bezier(0.4, 0, 1, 1)';
          backdrop.style.opacity = '0';
        }
        setTransform(size);
        dismissTimer = window.setTimeout(() => {
          panel!.style.transform  = '';
          panel!.style.transition = '';
          if (backdrop) {
            backdrop.style.opacity    = '';
            backdrop.style.transition = '';
          }
          onDismissRef.current();
        }, 200);
      } else {
        // Spring back to the resting position.
        panel!.style.transition = 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)';
        if (backdrop) {
          backdrop.style.transition = 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)';
          backdrop.style.opacity = '1';
        }
        setTransform(0);
        springBackTimer = window.setTimeout(() => {
          panel!.style.transform  = '';
          panel!.style.transition = '';
          if (backdrop) {
            backdrop.style.opacity    = '';
            backdrop.style.transition = '';
          }
        }, 300);
      }
    };

    const onTouchCancel = (): void => {
      const shouldCancelDrag = isDragging;
      isDragging = false;
      gestureSource = 'other';
      canDismissCurrentGesture = false;
      if (!shouldCancelDrag) return;
      panel!.style.transition = 'transform 200ms ease-out';
      if (backdrop) {
        backdrop.style.transition = 'opacity 200ms ease-out';
        backdrop.style.opacity = '1';
      }
      setTransform(0);
      springBackTimer = window.setTimeout(() => {
        panel!.style.transform  = '';
        panel!.style.transition = '';
        if (backdrop) {
          backdrop.style.opacity    = '';
          backdrop.style.transition = '';
        }
      }, 200);
    };

    const beginGesture = (
      primary: number,
      secondary: number,
      timeStamp: number,
      canDismiss: boolean
    ): void => {
      clearTimeout(springBackTimer);
      clearTimeout(dismissTimer);
      panel!.style.transition = 'none';
      if (backdrop) backdrop.style.transition = 'none';

      startPrimary = primary;
      startSecondary = secondary;
      lastPrimary = primary;
      lastTimestamp = timeStamp;
      velocity = 0;
      currentTranslate = 0;
      panelSize = direction === 'down' ? panel!.offsetHeight : panel!.offsetWidth;
      gestureSource = 'content';
      canDismissCurrentGesture = canDismiss;
      isDragging = false;
    };

    const updateGesture = (
      primary: number,
      secondary: number,
      timeStamp: number,
      preventScroll: () => void
    ): void => {
      if (gestureSource === 'other') return;

      const dp = primary - startPrimary;
      const ds = Math.abs(secondary - startSecondary);

      if (!isDragging && gestureSource === 'content' && canDismissCurrentGesture) {
        // Start the dismiss drag only when the scroll boundary is reached and
        // the movement is predominantly in the dismiss direction.
        if (dp > DRAG_START_MIN && dp > ds) {
          isDragging = true;
        }
      }

      if (!isDragging) return;

      preventScroll();
      // Apply light rubber-band resistance for over-pull beyond 120 px.
      const raw = Math.max(0, dp);
      currentTranslate = raw < 120 ? raw : 120 + (raw - 120) * 0.3;
      // Exponentially weighted moving average for smooth velocity tracking.
      const dt = timeStamp - lastTimestamp;
      if (dt > 0) {
        velocity = velocity * 0.3 + ((primary - lastPrimary) / dt) * 0.7;
      }
      lastPrimary = primary;
      lastTimestamp = timeStamp;
      setTransform(currentTranslate);
      // Fade the backdrop proportionally: fully opaque at rest, nearly
      // transparent when the panel reaches the dismiss threshold.
      if (backdrop && panelSize > 0) {
        const progress = Math.min(1, currentTranslate / panelSize);
        backdrop.style.opacity = String(1 - progress * 0.85);
      }
    };

    // ── Touch routing on the full panel ──────────────────────────────────
    //
    // Any touch that starts inside the drawer surface enters the same pending
    // swipe state. That makes the top pill purely decorative and keeps the
    // drag behaviour identical across the entire card.

    const onPanelTouchStart = (e: TouchEvent): void => {
      const target = e.target as HTMLElement;
      if (panel!.contains(target)) {
        const touch = e.touches[0];
        const atEdge = direction === 'down'
          ? scrollContainer.scrollTop <= 0
          : scrollContainer.scrollLeft <= 0;
        beginGesture(getPrimary(touch), getSecondary(touch), e.timeStamp, atEdge);
      } else {
        gestureSource = 'other';
        canDismissCurrentGesture = false;
        isDragging = false;
      }
    };

    const onPanelTouchMove = (e: TouchEvent): void => {
      const touch = e.touches[0];
      updateGesture(
        getPrimary(touch),
        getSecondary(touch),
        e.timeStamp,
        () => e.preventDefault(),
      );
    };

    panel.addEventListener('touchstart',  onPanelTouchStart, { passive: true });
    panel.addEventListener('touchmove',   onPanelTouchMove,  { passive: false });
    panel.addEventListener('touchend',    onTouchEnd,        { passive: true });
    panel.addEventListener('touchcancel', onTouchCancel,     { passive: true });

    return (): void => {
      clearTimeout(springBackTimer);
      clearTimeout(dismissTimer);
      panel!.removeEventListener('touchstart',  onPanelTouchStart);
      panel!.removeEventListener('touchmove',   onPanelTouchMove);
      panel!.removeEventListener('touchend',    onTouchEnd);
      panel!.removeEventListener('touchcancel', onTouchCancel);
      // Clean up any in-progress transform/opacity when the drawer closes or
      // the direction changes (e.g. device rotation).
      panel!.style.transform  = '';
      panel!.style.transition = '';
      if (backdrop) {
        backdrop.style.opacity    = '';
        backdrop.style.transition = '';
      }
    };
  }, [enabled, direction, scrollRef]);
}

interface ISponsorCardProps {
  sponsor: ISponsor;
  /** Entra ID tenant ID of the host tenant — used to build Teams guest-context deep links. */
  hostTenantId: string;
  /** When true, render a compact horizontal row instead of a full 136px tile. */
  compact: boolean;
  /** Controlled by the parent SponsorList — true when this card's rich popup should be visible. */
  isActive: boolean;
  /** Called when this card wants to show its popup. Parent cancels any pending hide timer. */
  onActivate: () => void;
  /**
   * Called on click or focus — activates the card immediately without any
   * hover delay, and pins it so a subsequent mouse-leave does not auto-close.
   */
  onActivateNow: () => void;
  /** Called when the mouse/focus leaves this card or its popup. Parent starts the hide timer. */
  onScheduleDeactivate: () => void;
  /**
   * Called when the card is explicitly dismissed (outside-click, Escape,
   * or the mobile drawer’s close button). Always closes regardless of pin state.
   */
  onForceDeactivate: () => void;
  /** Show business phone numbers in the contact details section. */
  showBusinessPhones: boolean;
  /** Show the mobile phone number in the contact details section. */
  showMobilePhone: boolean;
  /** Show the work location row in the contact details section. */
  showWorkLocation: boolean;
  /** Show the sponsor's city. */
  showCity: boolean;
  /** Show the sponsor's country or region. */
  showCountry: boolean;
  /** Show the sponsor's street address. */
  showStreetAddress: boolean;
  /** Show the sponsor's postal code. */
  showPostalCode: boolean;
  /** Show the sponsor's state or province. */
  showState: boolean;
  /** Optional Azure Maps subscription key used for inline preview. */
  azureMapsSubscriptionKey: string | undefined;
  /** External map provider used for fallback links. 'none' disables the link. */
  externalMapProvider: 'bing' | 'google' | 'apple' | 'openstreetmap' | 'none';
  /** Show the manager section below the contact details. */
  showManager: boolean;
  /** Show the presence status indicator (dot) and label. */
  showPresence: boolean;
  /** Show the sponsor's job title in the rich card header. */
  showSponsorJobTitle: boolean;
  /** Show the manager's job title in the manager row. */
  showManagerJobTitle: boolean;
  /** Show the sponsor's profile photo. When false, only initials are shown. */
  showSponsorPhoto: boolean;
  /** Show the manager's profile photo. When false, only initials are shown. */
  showManagerPhoto: boolean;
  /** Show the sponsor's department as the third line in the Persona header. */
  showSponsorDepartment: boolean;
  /** Show the manager's department in the manager row. */
  showManagerDepartment: boolean;
  /** Use informal address for user-facing tooltips. */
  useInformalAddress: boolean;
  /**
   * Whether the signed-in guest's Teams service account has been provisioned.
   * false = disable Teams Chat and Call buttons and show an explanatory tooltip.
   * undefined = unknown (fail-open — buttons remain active).
   */
  guestHasTeamsAccess?: boolean;
  /**
   * When true, the card is displayed as a visual tile only — no hover popup,
   * no keyboard activation. Used when the sponsor account is unavailable
   * (disabled or deleted) and only the name is shown for context.
   */
  readOnly?: boolean;
  /**
   * Fluent v9 theme object — passed into a nested FluentProvider inside the
   * Popover/Drawer portal so that design tokens (avatar colours, presence
   * badge, etc.) cascade correctly outside the main FluentProvider DOM tree.
   */
  v9Theme?: Theme;
}

const SponsorCard: React.FC<ISponsorCardProps> = ({
  sponsor,
  hostTenantId,
  compact,
  isActive,
  onActivate,
  onActivateNow,
  onScheduleDeactivate,
  onForceDeactivate,
  showBusinessPhones,
  showMobilePhone,
  showWorkLocation,
  showCity,
  showCountry,
  showStreetAddress,
  showPostalCode,
  showState,
  azureMapsSubscriptionKey,
  externalMapProvider,
  showManager,
  showPresence,
  showSponsorJobTitle,
  showManagerJobTitle,
  showSponsorPhoto,
  showManagerPhoto,
  showSponsorDepartment,
  showManagerDepartment,
  useInformalAddress,
  guestHasTeamsAccess,
  readOnly,
  v9Theme,
}) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const pointerOpenedCardRef = React.useRef(false);
  // Inner wrapper div inside DrawerBody — used by useSwipeToDismiss to locate
  // the scroll container (its parentElement) and the panel (role="dialog").
  const drawerScrollRef = React.useRef<HTMLDivElement>(null);
  const [shouldAutoFocusDesktopPopover, setShouldAutoFocusDesktopPopover] = React.useState(false);
  // True when the drawer content has been scrolled down, driving the top
  // gradient shadow that signals hidden content above.
  const [isDrawerScrolled, setIsDrawerScrolled] = React.useState(false);

  const resolvedName = resolvePersonName(sponsor.givenName, sponsor.surname, sponsor.displayName);
  const resolvedManagerName = resolvePersonName(sponsor.managerGivenName, sponsor.managerSurname, sponsor.managerDisplayName);

  // Pick informal string variant when the property is enabled and the locale provides one.
  const fstr = <K extends keyof typeof strings>(key: K): string => {
    if (useInformalAddress) {
      const informalKey = `${key}Informal` as keyof typeof strings;
      const informal = strings[informalKey];
      if (informal) return informal as string;
    }
    return strings[key] as string;
  };

  const isOof = sponsor.presenceActivity === 'OutOfOffice';
  const { status: presenceBadgeStatus, isOutOfOffice: badgeOof } = graphPresenceToPresenceBadge(
    sponsor.presence, sponsor.presenceActivity
  );
  // Presence badge is shown only inside the rich card header (contact popup),
  // not on the thumbnail tile — consistent with the Teams People Card pattern
  // where the grid view stays clean and presence is revealed on hover/tap.
  const showPresenceBadge = isActive && showPresence && sponsor.hasTeams !== false && !!sponsor.presence;
  const badgeStatus: PresenceBadgeStatus | undefined = showPresenceBadge ? presenceBadgeStatus : undefined;
  const presenceLabel = React.useMemo(() => {
    const availability = sponsor.presence;
    const activity = sponsor.presenceActivity;
    if (!availability && !activity) return undefined;
    if (isOof) {
      // OutOfOffice is a suffix modifier: "Available, out of office"
      // When availability mirrors a generic state, prepend it.
      const base = availability ? (getPresenceLabels()[availability] ?? '') : '';
      const suffix = strings.PresenceOutOfOfficeSuffix || ', out of office';
      return base ? `${base}${suffix}` : (strings.PresenceOutOfOffice || 'Out of office');
    }
    if (activity) return formatPresenceActivity(activity);
    return availability ? (getPresenceLabels()[availability] ?? '') : undefined;
  }, [sponsor.presence, sponsor.presenceActivity, isOof]);
  const { isTouch, widthClass, heightClass } = useTouchViewport();
  const actionButtonClasses = useActionButtonStyles();
  const personaClasses = usePersonaStyles();
  const cardClasses = useCardTileStyles();
  const richClasses = useRichCardStyles();
  const mobileDrawerClasses = useMobileDrawerStyles();
  const city = readAddressValue(sponsor.city);
  const countryOrRegion = readAddressValue(sponsor.country);
  const officeLocation = readAddressValue(sponsor.officeLocation);
  const streetAddress = readAddressValue(sponsor.streetAddress);
  const postalCode = readAddressValue(sponsor.postalCode);
  const stateOrProvince = readAddressValue(sponsor.state);
  const showOfficeLocation = Boolean(showWorkLocation && officeLocation);

  // Display formatting and maps queries intentionally use separate outputs.
  // The visible string follows country-specific postal conventions, while the
  // map query keeps broad structured components for more reliable geocoding.
  // officeLocation stays separate and is never folded into either address.
  const visibleAddressComponents: IAddressComponents = {
    streetAddress: showStreetAddress ? streetAddress : undefined,
    postalCode: showPostalCode ? postalCode : undefined,
    city: showCity ? city : undefined,
    stateOrProvince: showState ? stateOrProvince : undefined,
    country: showCountry ? countryOrRegion : undefined,
  };
  const displayAddress = formatDisplayAddress(visibleAddressComponents, countryOrRegion);
  const mapsQueryAddress = formatMapsQueryAddress(visibleAddressComponents);
  const hasDisplayAddress = displayAddress.length > 0;
  const hasMapsQueryAddress = mapsQueryAddress.length > 0;
  const addressMapLink = hasMapsQueryAddress && externalMapProvider !== 'none'
    ? buildExternalMapLink(externalMapProvider, mapsQueryAddress)
    : undefined;

  const [mapPreviewUrl, setMapPreviewUrl] = React.useState<string | undefined>(undefined);
  const [mapLoading, setMapLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isActive || !hasMapsQueryAddress || !azureMapsSubscriptionKey) {
      setMapPreviewUrl(undefined);
      setMapLoading(false);
      return;
    }

    const controller = new AbortController();
    setMapLoading(true);

    const geocodeUrl = `https://atlas.microsoft.com/search/address/json?api-version=1.0&subscription-key=${encodeURIComponent(azureMapsSubscriptionKey)}&query=${encodeURIComponent(mapsQueryAddress)}&limit=1`;

    fetch(geocodeUrl, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`Azure Maps geocode failed: ${response.status}`);
        }
        const payload = (await response.json()) as {
          results?: Array<{
            type?: string;
            entityType?: string;
            position?: { lat?: number; lon?: number };
          }>;
        };
        const result = payload.results?.[0];
        // Allow the map only when the match is specific enough to be meaningful.
        //
        // Precise (always show):
        //   'Point Address'  — exact house number
        //   'Address Range'  — number interpolated along a road
        //   'Street'         — specific road (no house number but still very local)
        //
        // Geography sub-types (show only for city-level precision):
        //   Municipality / MunicipalitySubdivision / Neighbourhood / PostalCodeArea
        //   → "Munich, Germany" resolves here → show ✅
        //
        // Too vague (suppress):
        //   Geography with entityType Country / CountrySubdivision / etc.
        //   → "Germany" alone would land here → hide ❌
        //   POI, Cross Street — wrong or ambiguous location
        const matchType = result?.type;
        const entityType = result?.entityType ?? '';
        const isPrecise =
          matchType === 'Point Address' ||
          matchType === 'Address Range' ||
          matchType === 'Street' ||
          (matchType === 'Geography' && CITY_LEVEL_MAP_ENTITY_TYPES.has(entityType));
        if (!isPrecise) {
          throw new Error(`Azure Maps match too imprecise: ${matchType}/${entityType}`);
        }
        const position = result?.position;
        const lat = position?.lat;
        const lon = position?.lon;
        if (lat === undefined || lon === undefined) {
          throw new Error('No map coordinates returned');
        }
        const staticMapUrl = `https://atlas.microsoft.com/map/static/png?api-version=1.0&subscription-key=${encodeURIComponent(azureMapsSubscriptionKey)}&center=${lon},${lat}&zoom=14&width=560&height=260&pins=default||${lon}%20${lat}`;
        setMapPreviewUrl(staticMapUrl);
        setMapLoading(false);
      })
      .catch(error => {
        if ((error as Error).name === 'AbortError') return;
        setMapPreviewUrl(undefined);
        setMapLoading(false);
      });

    return () => controller.abort();
  }, [isActive, hasMapsQueryAddress, azureMapsSubscriptionKey, mapsQueryAddress]);

  // Delayed expand: the detail sections slide open ~300 ms after the card
  // appears, matching the Microsoft Teams People Card pattern where the header
  // and action row are visible first and the body expands shortly after.
  // 300 ms = card-enter animation (180 ms) + short settle pause (~120 ms).
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);
  React.useEffect(() => {
    if (!isActive) { setDetailsExpanded(false); return; }
    const timer = setTimeout(() => setDetailsExpanded(true), 300);
    return () => clearTimeout(timer);
  }, [isActive]);

  // Pre-calculate whether the popover should open above or below the card tile.
  // This is done once when isActive becomes true — before the Popover is mounted —
  // so the position is stable throughout the expand animation and never flips.
  // pinned: true on the Popover then locks that decision in for the lifetime of
  // the popup (Fluent v9 PositioningProps).
  //
  // Estimated full height of the expanded contact card (header + actions +
  // details + optional map + optional manager section). Conservative upper
  // bound so the card doesn't clip at the bottom on typical screen heights.
  const ESTIMATED_CARD_HEIGHT_PX = 560;
  const [popoverSide, setPopoverSide] = React.useState<'above' | 'below'>('below');
  React.useEffect(() => {
    if (!isActive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // Prefer 'below'. Fall back to 'above' only when there is clearly more
    // room above than below for the fully expanded card.
    setPopoverSide(
      spaceBelow >= ESTIMATED_CARD_HEIGHT_PX || spaceBelow >= spaceAbove
        ? 'below'
        : 'above'
    );
  }, [isActive]);

  // The rich card is split into a fixed header panel and a detail body so the
  // mobile drawer can keep the sponsor persona permanently visible while only
  // the contact and org sections scroll underneath it.

  // Manager avatar size scales with the number of text rows shown:
  //   2 rows (name + job title + department) → 64 px  (one above extra-large natural)
  //   0-1 rows                              → 56 px  (extra-large natural size)
  const managerThreeLines =
    showManagerJobTitle && showManagerDepartment && !!sponsor.managerDepartment;
  const managerAvatarSize: 56 | 64 = managerThreeLines ? 64 : 56;
  const usesBottomSheet = isTouch && widthClass === 'compact' && heightClass !== 'compact';
  const mobileDrawerPosition: 'bottom' | 'end' = usesBottomSheet ? 'bottom' : 'end';
  const mobileDrawerSize: 'small' | 'medium' = usesBottomSheet ? 'medium' : 'small';
  const mobileDrawerStyle = React.useMemo<React.CSSProperties | undefined>(
    () => {
      if (!isTouch) return undefined;

      const shapeStyle: React.CSSProperties = {
        backgroundColor: tokens.colorNeutralBackground1,
        overflow: 'hidden',
      };

      if (usesBottomSheet) {
        shapeStyle.borderRadius = `${tokens.borderRadiusLarge} ${tokens.borderRadiusLarge} 0 0`;
        return {
          ...shapeStyle,
          width: '100%',
          maxWidth: '100dvw',
          minWidth: 0,
          // Open at ~80 % of the viewport — standard partial-sheet behaviour on
          // iOS/Android where the page content remains partly visible below.
          '--fui-Drawer--size': '80dvh',
        } as React.CSSProperties;
      }

      return {
        ...shapeStyle,
        '--fui-Drawer--size': sideDrawerWidth(widthClass, heightClass),
        borderRadius: `${tokens.borderRadiusLarge} 0 0 ${tokens.borderRadiusLarge}`,
      } as React.CSSProperties;
    },
    [isTouch, usesBottomSheet, widthClass, heightClass]
  );

  useSwipeToDismiss(
    drawerScrollRef,
    onForceDeactivate,
    isTouch && isActive,
    'down'
  );

  // Reset scroll position each time the drawer opens so the user always
  // starts at the top, not at a leftover position from the previous visit.
  React.useEffect(() => {
    if (!isActive) return;
    const scrollContainer = drawerScrollRef.current?.parentElement as HTMLElement | null;
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }, [isActive]);

  // Track whether the drawer content is scrolled down so we can show/hide
  // the top gradient shadow that signals content scrolled out above.
  React.useEffect(() => {
    if (!isTouch || !isActive) {
      setIsDrawerScrolled(false);
      return;
    }
    const scrollContainer = drawerScrollRef.current?.parentElement as HTMLElement | null;
    if (!scrollContainer) return;
    const onScroll = (): void => setIsDrawerScrolled(scrollContainer.scrollTop > 0);
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', onScroll);
  }, [isTouch, isActive]);

  // Fluent Popover auto-focuses the first focusable element on open. A mouse
  // click focuses the tile before React receives the click event, so track
  // pointer presses and only keep auto-focus for genuine keyboard focus.
  const handleCardMouseDown = (): void => {
    pointerOpenedCardRef.current = true;
    setShouldAutoFocusDesktopPopover(false);
  };

  const handleCardMouseEnter = (): void => {
    setShouldAutoFocusDesktopPopover(false);
    onActivate();
  };

  const handleCardFocus = (): void => {
    const openedFromKeyboard = !pointerOpenedCardRef.current;
    pointerOpenedCardRef.current = false;
    setShouldAutoFocusDesktopPopover(openedFromKeyboard);
    onActivateNow();
  };

  const handleCardBlur = (): void => {
    pointerOpenedCardRef.current = false;
    onScheduleDeactivate();
  };

  const handleCardClick = (): void => {
    pointerOpenedCardRef.current = false;
    onActivateNow();
  };

  const richHeaderPanel = (
    <div className={richClasses.richCardHeaderPanel} data-rich-header-panel="true">
      {usesBottomSheet && (
        <div
          className={mobileDrawerClasses.drawerDragHandle}
          data-drawer-handle="true"
          aria-hidden="true"
        />
      )}
      <div
        className={mergeClasses(
          richClasses.richHeader,
          isTouch && richClasses.richHeaderFlat,
          usesBottomSheet && richClasses.richHeaderFlatWithHandle,
        )}
      >
        <Persona
          size="huge"
          name={resolvedName}
          className={personaClasses.richPersona}
          textAlignment="center"
          secondaryText={
            showSponsorJobTitle && sponsor.jobTitle
              ? { children: sponsor.jobTitle, className: personaClasses.richSecondary }
              : showSponsorDepartment && sponsor.department
                ? { children: sponsor.department, className: personaClasses.richSecondary }
                : presenceLabel && showPresence && sponsor.hasTeams !== false
                  ? { children: presenceLabel, className: personaClasses.richPresenceLine }
                  : undefined
          }
          tertiaryText={
            showSponsorJobTitle && sponsor.jobTitle && showSponsorDepartment && sponsor.department
              ? { children: sponsor.department, className: personaClasses.richTertiary }
              : (showSponsorJobTitle && sponsor.jobTitle || showSponsorDepartment && sponsor.department)
                  && presenceLabel && showPresence && sponsor.hasTeams !== false
                ? { children: presenceLabel, className: personaClasses.richPresenceLine }
                : undefined
          }
          quaternaryText={
            showSponsorJobTitle && sponsor.jobTitle && showSponsorDepartment && sponsor.department
              && presenceLabel && showPresence && sponsor.hasTeams !== false
              ? { children: presenceLabel, className: personaClasses.richPresenceLine }
              : undefined
          }
          primaryText={{ className: personaClasses.richName }}
          avatar={{
            size: 96,
            image: showSponsorPhoto && sponsor.photoUrl ? { src: sponsor.photoUrl } : undefined,
            color: 'colorful',
            badge: badgeStatus ? { status: badgeStatus, outOfOffice: badgeOof } : undefined,
          }}
        />
      </div>{/* end richHeader */}

      {/* ── Action buttons row ───────────────────────────────── */}
      {sponsor.mail && (
        <div className={richClasses.richActions} role="toolbar" aria-label={strings.ContactActionsAriaLabel}>
          {sponsor.hasTeams !== false && sponsor.mail && (
            <Tooltip
              content={guestHasTeamsAccess === false ? fstr('TeamsNotReadyChatTooltip') : strings.ChatTitle.replace('{name}', resolvedName)}
              relationship="label"
            >
              <Button
                as={guestHasTeamsAccess === false ? 'button' : 'a'}
                href={guestHasTeamsAccess === false ? undefined : `https://teams.cloud.microsoft/l/chat/0/0?tenantId=${encodeURIComponent(hostTenantId)}&users=${encodeURIComponent(sponsor.mail)}`}
                disabledFocusable={guestHasTeamsAccess === false}
                appearance="subtle"
                icon={<ChatIcon />}
                target="_blank"
                rel="noreferrer noopener"
                className={actionButtonClasses.actionButton}
              />
            </Tooltip>
          )}
          {sponsor.mail && (
            <Tooltip content={strings.EmailTitle.replace('{name}', resolvedName)} relationship="label">
              <Button
                as="a"
                href={`mailto:${sponsor.mail}`}
                appearance="subtle"
                icon={<MailIcon />}
                className={actionButtonClasses.actionButton}
              />
            </Tooltip>
          )}
          {sponsor.hasTeams !== false && (
            <Tooltip
              content={guestHasTeamsAccess === false ? fstr('TeamsNotReadyCallTooltip') : strings.CallTitle.replace('{name}', resolvedName)}
              relationship="label"
            >
              <Button
                as={guestHasTeamsAccess === false ? 'button' : 'a'}
                href={guestHasTeamsAccess === false ? undefined : `https://teams.cloud.microsoft/l/call/0/0?tenantId=${encodeURIComponent(hostTenantId)}&users=${encodeURIComponent(sponsor.mail)}&withVideo=false`}
                disabledFocusable={guestHasTeamsAccess === false}
                appearance="subtle"
                icon={<CallIcon />}
                target="_blank"
                rel="noreferrer noopener"
                className={actionButtonClasses.actionButton}
              />
            </Tooltip>
          )}
        </div>
      )}

    </div>
  );

  const richDetailSections = (
    <>
      {/* ── Contact section ─────────────────────────────────── */}
      <div className={richClasses.richSectionTitle}>{strings.ContactInfoSection}</div>
      <div className={richClasses.richSection}>
        {sponsor.mail && (
          <div className={mergeClasses(richClasses.richInfoRow, richClasses.richInfoRowInteractive)}>
            <MailRegular className={richClasses.richInfoIcon} aria-hidden="true" />
            <div className={richClasses.richInfoText}>
              <Link href={`mailto:${sponsor.mail}`} className={richClasses.richInfoValue}>{sponsor.mail}</Link>
            </div>
            <CopyButton value={sponsor.mail} ariaLabel={strings.CopyEmailAriaLabel} />
          </div>
        )}
        {showBusinessPhones && sponsor.businessPhones?.map(phone => (
          <div key={phone} className={mergeClasses(richClasses.richInfoRow, richClasses.richInfoRowInteractive)}>
            <CallRegular className={richClasses.richInfoIcon} aria-hidden="true" />
            <div className={richClasses.richInfoText}>
              <Link href={`tel:${phone}`} className={richClasses.richInfoValue}>{phone}</Link>
            </div>
            <CopyButton value={phone} ariaLabel={strings.CopyWorkPhoneAriaLabel} />
          </div>
        ))}
        {showMobilePhone && sponsor.mobilePhone && (
          <div className={mergeClasses(richClasses.richInfoRow, richClasses.richInfoRowInteractive)}>
            <PhoneRegular className={richClasses.richInfoIcon} aria-hidden="true" />
            <div className={richClasses.richInfoText}>
              <Link href={`tel:${sponsor.mobilePhone}`} className={richClasses.richInfoValue}>{sponsor.mobilePhone}</Link>
            </div>
            <CopyButton value={sponsor.mobilePhone} ariaLabel={strings.CopyMobileAriaLabel} />
          </div>
        )}
        {showOfficeLocation && (
          <div className={mergeClasses(richClasses.richInfoRow, richClasses.richInfoRowInteractive)}>
            <BuildingRegular className={richClasses.richInfoIcon} aria-hidden="true" />
            <div className={richClasses.richInfoText}>
              <div className={richClasses.richInfoValue}>{officeLocation}</div>
            </div>
            <CopyButton value={officeLocation!} ariaLabel={strings.CopyLocationAriaLabel} />
          </div>
        )}
        {hasDisplayAddress && (
          <>
            <div className={mergeClasses(richClasses.richInfoRow, richClasses.richInfoRowInteractive)}>
              <LocationRegular className={richClasses.richInfoIcon} aria-hidden="true" />
              <div className={richClasses.richInfoText}>
                {addressMapLink ? (
                  <Link href={addressMapLink} target="_blank" rel="noreferrer noopener" className={richClasses.richInfoValue}>
                    {displayAddress}
                  </Link>
                ) : (
                  <div className={richClasses.richInfoValue}>{displayAddress}</div>
                )}
              </div>
              <CopyButton value={displayAddress} ariaLabel={strings.CopyAddressAriaLabel} />
            </div>
            {azureMapsSubscriptionKey && (mapLoading || mapPreviewUrl) && (
              <div className={richClasses.mapPreviewInline}>
                {mapLoading && !mapPreviewUrl && (
                  <div className={richClasses.mapPreviewStatus}>{strings.AddressMapLoadingLabel}</div>
                )}
                {mapPreviewUrl && (
                  addressMapLink ? (
                    <Link href={addressMapLink} target="_blank" rel="noreferrer noopener">
                      <img
                        src={mapPreviewUrl}
                        alt={strings.AddressMapSectionLabel}
                        className={richClasses.mapPreviewImage}
                        referrerPolicy="no-referrer"
                      />
                    </Link>
                  ) : (
                    <img
                      src={mapPreviewUrl}
                      alt={strings.AddressMapSectionLabel}
                      className={richClasses.mapPreviewImage}
                      referrerPolicy="no-referrer"
                    />
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Reports to section (manager) ───────────────────────────── */}
      {showManager && sponsor.managerDisplayName && (
        <>
          <div className={richClasses.richSectionDivider} />
          <div className={richClasses.richSectionTitle}>{strings.ReportsToSection}</div>
          <div className={richClasses.richSection}>
            <div className={richClasses.managerRow}>
              <Persona
                size="extra-large"
                name={resolvedManagerName}
                className={personaClasses.managerPersona}
                textAlignment="center"
                secondaryText={
                  showManagerJobTitle && sponsor.managerJobTitle
                    ? { children: sponsor.managerJobTitle, className: personaClasses.managerSecondary }
                    : !showManagerJobTitle && showManagerDepartment && sponsor.managerDepartment
                      ? { children: sponsor.managerDepartment, className: personaClasses.managerSecondary }
                      : undefined
                }
                tertiaryText={
                  showManagerJobTitle && showManagerDepartment && sponsor.managerDepartment
                    ? { children: sponsor.managerDepartment, className: personaClasses.managerTertiary }
                    : undefined
                }
                primaryText={{ className: personaClasses.managerName }}
                avatar={{
                  size: managerAvatarSize,
                  image: showManagerPhoto && sponsor.managerPhotoUrl ? { src: sponsor.managerPhotoUrl } : undefined,
                  color: 'colorful',
                }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );

  const desktopRichBody = (
    <div
      className={richClasses.richCard}
      onMouseEnter={onActivate}
      onMouseLeave={onScheduleDeactivate}
    >
      {richHeaderPanel}
      <div
        className={mergeClasses(
          richClasses.richCardBody,
          detailsExpanded && richClasses.richCardBodyExpanded,
        )}
        data-rich-detail-body="true"
      >
        {richDetailSections}
      </div>
    </div>
  );

  const mobileRichDetailBody = (
    <div
      className={richClasses.richCardBodyDrawer}
      data-rich-detail-body="true"
    >
      {richDetailSections}
    </div>
  );

  return (
    <>
      {/* ── Card thumbnail (always visible in the grid) ──────────────── */}
      <div
        ref={cardRef}
        className={mergeClasses(compact ? cardClasses.cardCompact : cardClasses.card, readOnly ? cardClasses.cardReadOnly : '')}
        onMouseDown={readOnly ? undefined : handleCardMouseDown}
        onMouseEnter={readOnly ? undefined : handleCardMouseEnter}
        onMouseLeave={readOnly ? undefined : onScheduleDeactivate}
        onFocus={readOnly ? undefined : handleCardFocus}
        onBlur={readOnly ? undefined : handleCardBlur}
        onClick={readOnly ? undefined : handleCardClick}
        tabIndex={readOnly ? undefined : 0}
        role={readOnly ? undefined : 'button'}
        aria-label={resolvedName}
        aria-haspopup={readOnly ? undefined : 'dialog'}
        aria-expanded={readOnly ? undefined : isActive}
      >
        <div className={compact ? cardClasses.avatarWrapperCompact : cardClasses.avatarWrapper}>
          <Avatar
            size={compact ? 40 : 72}
            name={resolvedName}
            image={showSponsorPhoto && sponsor.photoUrl ? { src: sponsor.photoUrl } : undefined}
            color="colorful"
          />
        </div>
        <div className={compact ? cardClasses.cardNameCompact : cardClasses.cardName}>
          {resolvedName}
        </div>
      </div>

      {/* ── Rich contact card (OverlayDrawer on mobile, Popover on desktop) ─── */}
      {!readOnly && isTouch && (
        <OverlayDrawer
          aria-label={resolvedName}
          open={isActive}
          position={mobileDrawerPosition}
          size={mobileDrawerSize}
          style={mobileDrawerStyle}
          onOpenChange={(_, data) => { if (!data.open) onForceDeactivate(); }}
        >
          <RendererProvider renderer={griffelRenderer}>
          <FluentProvider theme={v9Theme} className={mobileDrawerClasses.drawerProvider}>
            {/* Full-height flex column so drag handle + header + body fill the panel */}
            <div className={mobileDrawerClasses.drawerContent}>
              {/* Close button — side sheet only; bottom sheet dismisses via drag or backdrop tap */}
              {!usesBottomSheet && (
                <div className={mergeClasses(mobileDrawerClasses.drawerHeaderBar, mobileDrawerClasses.drawerHeaderBarSideSheet)}>
                  <Button
                    appearance="subtle"
                    icon={<DismissRegular />}
                    onClick={onForceDeactivate}
                    aria-label={strings.CloseLabel}
                    data-drawer-close="true"
                  />
                </div>
              )}
                {richHeaderPanel}
              {/*
               * Wrapper provides position:relative so the top gradient shadow
               * can be absolutely positioned over the scroll area.
               * DrawerBody inside is the actual scroll container; its scrollTop
               * is read by useSwipeToDismiss via drawerScrollRef.parentElement.
               */}
              <div className={mobileDrawerClasses.drawerBodyWrapper}>
                {/* Gradient fade indicating content scrolled out above. */}
                <div
                  className={mergeClasses(
                    mobileDrawerClasses.drawerScrollTopShadow,
                    isDrawerScrolled && mobileDrawerClasses.drawerScrollTopShadowVisible,
                  )}
                  aria-hidden="true"
                />
                <DrawerBody
                  style={{
                    padding: 0,
                    display: 'block',
                    flex: '1 1 0',
                    width: '100%',
                    height: '100%',
                    maxHeight: '100%',
                    minHeight: 0,
                    minWidth: 0,
                    boxSizing: 'border-box',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-y',
                    // Prevent the page behind from scrolling when the user
                    // reaches the top/bottom boundary of the drawer content.
                    overscrollBehavior: 'contain',
                  }}
                >
                  <div
                    ref={drawerScrollRef}
                    style={{
                      width: '100%',
                      minHeight: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {mobileRichDetailBody}
                  </div>
                </DrawerBody>
              </div>
            </div>
          </FluentProvider>
          </RendererProvider>
        </OverlayDrawer>
      )}
      {!readOnly && !isTouch && isActive && (
        <Popover
          open
          unstable_disableAutoFocus={!shouldAutoFocusDesktopPopover}
          positioning={{
            target: cardRef.current,
            position: popoverSide,
            align: 'start',
            offset: { mainAxis: 8 },
            // pinned prevents Fluent's positioning engine from re-evaluating the
            // flip axis while the card expands — the side chosen above is locked
            // in for the entire lifetime of the popup.
            pinned: true,
          }}
          onOpenChange={(_, data) => { if (!data.open) onForceDeactivate(); }}
        >
          <PopoverSurface
            role="dialog"
            aria-label={strings.ContactDetailsAriaLabel.replace('{0}', resolvedName)}
            style={{ padding: 0, boxShadow: 'none', border: 'none', borderRadius: 0, backgroundColor: 'transparent', overflow: 'visible' }}
            onMouseEnter={onActivate}
            onMouseLeave={onScheduleDeactivate}
          >
            <RendererProvider renderer={griffelRenderer}>
            <FluentProvider theme={v9Theme} style={{ backgroundColor: 'transparent' }}>
              {desktopRichBody}
            </FluentProvider>
            </RendererProvider>
          </PopoverSurface>
        </Popover>
      )}
    </>
  );
};

export default SponsorCard;
