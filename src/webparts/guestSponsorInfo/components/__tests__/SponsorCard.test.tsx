// SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
// SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
// SPDX-License-Identifier: LicenseRef-PolyForm-Shield-1.0.0

// Mock Fluent UI v9 components so they render inline (avoids portal / ResizeObserver issues).
// All rendered children are still fully exercised.
// NOTE: jest.mock must be placed before imports so the linting rule is satisfied
// (Jest hoists it automatically at runtime regardless of source position).
jest.mock('@fluentui/react-components', () => ({
  // Avatar: renders initials derived from the name prop and an optional photo.
  // data-badge-status exposes the presence badge status for tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Avatar: ({ name, image, badge, size, className, ...rest }: any) => {
    const parts = ((name as string) || '').trim().split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : ((name as string) || '').substring(0, 2).toUpperCase();
    return (
      <div data-avatar-size={size} data-badge-status={badge?.status ?? 'none'} className={className} {...rest}>
        <div className="initials">{initials}</div>
        {image?.src && <img src={image.src} alt="" />}
      </div>
    );
  },
  // Persona: renders avatar + text slots. Exposes the same data attributes as Avatar so
  // existing tests that query the rich card header can continue to use the same selectors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Persona: ({ name, size, avatar, primaryText, secondaryText, tertiaryText, className }: any) => {
    const parts = ((name as string) || '').trim().split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : ((name as string) || '').substring(0, 2).toUpperCase();
    const secondary = typeof secondaryText === 'object' && secondaryText !== null
      ? secondaryText.children
      : secondaryText;
    const tertiary = typeof tertiaryText === 'object' && tertiaryText !== null
      ? tertiaryText.children
      : tertiaryText;
    return (
      <div data-persona="" data-size={size} className={className}>
        <div data-avatar-size={size ?? 'medium'} data-badge-status={avatar?.badge?.status ?? 'none'}>
          <div className="initials">{initials}</div>
          {avatar?.image?.src && <img src={avatar.image.src} alt="" />}
        </div>
        <span>
          <span data-primary-text="">{primaryText?.children ?? name}</span>
          {secondary !== undefined && <span data-secondary-text="">{secondary}</span>}
          {tertiary !== undefined && <span data-tertiary-text="">{tertiary}</span>}
        </span>
      </div>
    );
  },
  // Button: renders as <a> when href is present and not disabled, otherwise <button>.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Button: ({ as: As, href, children, icon, disabled, disabledFocusable, onClick, className, 'aria-label': ariaLabel, target, rel, ...rest }: any) => {
    const resolvedAs = As || 'button';
    const isDisabled = disabled || disabledFocusable;
    if (href && !isDisabled) {
      return <a href={href} target={target} rel={rel} className={className} aria-label={ariaLabel} {...rest}>{icon}{children}</a>;
    }
    if (resolvedAs === 'a' && !href) {
      return <button type="button" onClick={onClick} disabled={isDisabled} className={className} aria-label={ariaLabel} {...rest}>{icon}{children}</button>;
    }
    return <button type="button" onClick={onClick} disabled={isDisabled} className={className} aria-label={ariaLabel} {...rest}>{icon}{children}</button>;
  },
  // Tooltip: render children directly; tooltip behaviour is tested in Fluent UI itself.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  // Popover: render children when open. PopoverSurface renders with the given role.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Popover: ({ children, open, unstable_disableAutoFocus }: { children: React.ReactNode; open?: boolean; unstable_disableAutoFocus?: boolean }) => (
    open ? <div data-popover-disable-auto-focus={unstable_disableAutoFocus ? 'true' : 'false'}>{children}</div> : null
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PopoverSurface: ({ children, role, ...rest }: any) => (
    <div role={role ?? 'dialog'} {...rest}>{children}</div>
  ),
  // OverlayDrawer: renders children inside a dialog when open.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OverlayDrawer: ({ children, open, position, size, onOpenChange: _onOpenChange, ...rest }: any) => (
    open ? <div role="dialog" data-position={position} data-size={size} {...rest}>{children}</div> : null
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DrawerHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DrawerHeaderTitle: ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
    <><span>{children}</span>{action}</>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DrawerBody: ({ children, ...rest }: any) => <div data-drawer-body="" {...rest}>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ href, children, className, ...rest }: any) => (
    <a href={href} className={className} {...rest}>{children}</a>
  ),
  // makeStyles returns a hook that returns an empty style map (CSS-in-JS not needed in tests).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  makeStyles: () => () => ({} as any),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mergeClasses: (...classes: string[]) => classes.filter(Boolean).join(' '),
  // FluentProvider: pass-through wrapper so nested providers in portals render in tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FluentProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  tokens: {},
}));

// Mock Fluent UI v9 SVG icons as empty spans so tests don't need SVG support.
jest.mock('@fluentui/react-icons', () =>
  new Proxy(
    {},
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get: (_target: any, prop: string): any => {
        // bundleIcon returns a component that renders the Regular variant only.
        if (prop === 'bundleIcon') {
          return (_Filled: React.FC, Regular: React.FC) => Regular;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Icon = ({ className }: { className?: string }): React.ReactElement => <span data-icon-name={prop} className={className} />;
        Icon.displayName = prop;
        return Icon;
      },
    }
  )
);

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import SponsorCard from '../SponsorCard';
import type { ISponsor } from '../../services/ISponsor';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_SPONSOR: ISponsor = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  displayName: 'Alice Smith',
  mail: 'alice@contoso.com',
  jobTitle: 'Project Manager',
  department: 'Engineering',
  officeLocation: 'Berlin',
  businessPhones: ['+49 30 12345678'],
  mobilePhone: undefined,
  photoUrl: undefined,
};

// ─── DOM helpers ───────────────────────────────────────────────────────────────

let container: HTMLDivElement;
const originalFetch = globalThis.fetch;
const originalMatchMedia = window.matchMedia;
const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;
const originalTestUrl = window.location.href;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

function renderIntoContainer(tree: React.ReactElement): void {
  ReactDOM.render(tree, container);
}

function unmountContainer(): void {
  ReactDOM.unmountComponentAtNode(container);
}

afterEach(() => {
  act(() => { unmountContainer(); });
  container.remove();
  window.history.replaceState({}, '', originalTestUrl);
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    // Keep test globals clean when fetch was not defined initially.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).fetch;
  }

  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
  } else {
    // Keep test globals clean when matchMedia was not defined initially.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).matchMedia;
  }

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
});

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function mockMatchMedia(matchesByQuery: Record<string, boolean>): void {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: matchesByQuery[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

function mockViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function openOnTouchViewport(width: number, height: number): Promise<void> {
  window.history.replaceState({}, '', originalTestUrl);
  mockViewport(width, height);
  mockMatchMedia({
    '(pointer: coarse)': true,
  });
  render(BASE_SPONSOR, 'test-tenant-id', true);
  return flushAsync();
}

interface ITouchDrawerRenderOptions {
  sponsor?: ISponsor;
  onForceDeactivate?: jest.Mock;
}

function renderTouchDrawer(
  width: number,
  height: number,
  options: ITouchDrawerRenderOptions = {}
): Promise<void> {
  const {
    sponsor = BASE_SPONSOR,
    onForceDeactivate = jest.fn(),
  } = options;

  window.history.replaceState({}, '', originalTestUrl);
  mockViewport(width, height);
  mockMatchMedia({
    '(pointer: coarse)': true,
  });
  render(
    sponsor,
    'test-tenant-id',
    true,
    jest.fn(),
    jest.fn(),
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    true,
    true,
    false,
    true,
    true,
    false,
    false,
    true,
    true,
    undefined,
    'bing',
    false,
    jest.fn(),
    onForceDeactivate
  );
  return flushAsync();
}

function render(
  sponsor: ISponsor,
  hostTenantId = 'test-tenant-id',
  isActive = false,
  onActivate = jest.fn(),
  onScheduleDeactivate = jest.fn(),
  showBusinessPhones = true,
  showMobilePhone = true,
  showWorkLocation = true,
  showCity = false,
  showCountry = false,
  showStreetAddress = false,
  showPostalCode = false,
  showState = false,
  showManager = true,
  showPresence = true,
  useInformalAddress = false,
  showSponsorJobTitle = true,
  showManagerJobTitle = true,
  showSponsorDepartment = false,
  showManagerDepartment = false,
  showSponsorPhoto = true,
  showManagerPhoto = true,
  azureMapsSubscriptionKey: string | undefined = undefined,
  externalMapProvider: 'bing' | 'google' | 'apple' | 'openstreetmap' | 'none' = 'bing',
  compact = false,
  onActivateNow = jest.fn(),
  onForceDeactivate = jest.fn()
): void {
  act(() => {
    renderIntoContainer(
      <SponsorCard
        sponsor={sponsor}
        hostTenantId={hostTenantId}
        compact={compact}
        isActive={isActive}
        onActivate={onActivate}
        onActivateNow={onActivateNow}
        onScheduleDeactivate={onScheduleDeactivate}
        onForceDeactivate={onForceDeactivate}
        showBusinessPhones={showBusinessPhones}
        showMobilePhone={showMobilePhone}
        showWorkLocation={showWorkLocation}
        showCity={showCity}
        showCountry={showCountry}
        showStreetAddress={showStreetAddress}
        showPostalCode={showPostalCode}
        showState={showState}
        azureMapsSubscriptionKey={azureMapsSubscriptionKey}
        externalMapProvider={externalMapProvider}
        showManager={showManager}
        showPresence={showPresence}
        useInformalAddress={useInformalAddress}
        showSponsorJobTitle={showSponsorJobTitle}
        showManagerJobTitle={showManagerJobTitle}
        showSponsorDepartment={showSponsorDepartment}
        showManagerDepartment={showManagerDepartment}
        showSponsorPhoto={showSponsorPhoto}
        showManagerPhoto={showManagerPhoto}
      />
    );
  });
}

function fireEvent(element: Element, eventName: string): void {
  // React 17 uses event delegation: onMouseEnter is triggered by native 'mouseover'
  // events bubbling to the root container, and onMouseLeave by 'mouseout'.
  // Dispatching the raw 'mouseenter'/'mouseleave' events (which normally don't bubble)
  // would not reach React's root listener even with bubbles:true.
  const nativeEvent =
    eventName === 'mouseenter' ? 'mouseover' :
    eventName === 'mouseleave' ? 'mouseout' :
    eventName;
  act(() => {
    element.dispatchEvent(new MouseEvent(nativeEvent, { bubbles: true, cancelable: true }));
  });
}

function fireFocus(element: Element): void {
  act(() => {
    element.dispatchEvent(new FocusEvent('focusin', { bubbles: true, cancelable: true }));
  });
}

function renderDesktopCard(isActive = false, onActivateNow = jest.fn()): void {
  mockViewport(1280, 900);
  mockMatchMedia({
    '(pointer: coarse)': false,
  });

  render(
    BASE_SPONSOR,
    'test-tenant-id',
    isActive,
    jest.fn(),
    jest.fn(),
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    true,
    true,
    false,
    true,
    true,
    false,
    false,
    true,
    true,
    undefined,
    'bing',
    false,
    onActivateNow
  );
}

type TouchEventName = 'touchstart' | 'touchmove' | 'touchend';
interface ITouchPoint {
  clientX: number;
  clientY: number;
}

function dispatchTouchEvent(
  element: Element,
  eventName: TouchEventName,
  point: ITouchPoint,
  timeStamp: number
): Event {
  const touchPoint = point as Touch;
  const event = new Event(eventName, { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    timeStamp: {
      configurable: true,
      value: timeStamp,
    },
    touches: {
      configurable: true,
      value: eventName === 'touchend' ? [] : [touchPoint],
    },
    changedTouches: {
      configurable: true,
      value: [touchPoint],
    },
  });

  act(() => {
    element.dispatchEvent(event);
  });

  return event;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('SponsorCard', () => {
  describe('basic rendering', () => {
    it('renders the display name', () => {
      render(BASE_SPONSOR);
      expect(container.textContent).toContain('Alice Smith');
    });

    it('renders the job title in the expanded rich card', () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      expect(container.textContent).toContain('Project Manager');
    });

    it('has an accessible button role', () => {
      render(BASE_SPONSOR);
      expect(container.querySelector('[role="button"]')).not.toBeNull();
    });

    it('sets aria-label to the display name', () => {
      render(BASE_SPONSOR);
      const card = container.querySelector('[role="button"]');
      expect(card?.getAttribute('aria-label')).toBe('Alice Smith');
    });

    it('sets aria-expanded=false when not active', () => {
      render(BASE_SPONSOR);
      const card = container.querySelector('[role="button"]');
      expect(card?.getAttribute('aria-expanded')).toBe('false');
    });

    it('sets aria-expanded=true when active', () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      const card = container.querySelector('[role="button"]');
      expect(card?.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('avatar', () => {
    it('renders coloured initials when no photoUrl is provided', () => {
      render(BASE_SPONSOR);
      // The initials box uses the "initials" CSS class (echoed as-is by styleMock).
      const initialsEl = container.querySelector('[class="initials"]');
      expect(initialsEl).not.toBeNull();
      expect(initialsEl!.textContent).toBe('AS');
    });

    it('uses first-letter + last-word-first-letter for two-part names', () => {
      render({ ...BASE_SPONSOR, displayName: 'John Van Der Berg' });
      expect(container.querySelector('[class="initials"]')!.textContent).toBe('JB');
    });

    it('uses the first two characters for a single-word name', () => {
      render({ ...BASE_SPONSOR, displayName: 'Madonna' });
      expect(container.querySelector('[class="initials"]')!.textContent).toBe('MA');
    });

    it('renders an <img> element overlaid on the initials when photoUrl is provided', () => {
      // Initials are always rendered as the base layer; the photo fades in on top
      // via CSS absolute positioning so there is no pop-in layout shift.
      render({ ...BASE_SPONSOR, photoUrl: 'data:image/jpeg;base64,/9j/4AAQ' });
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img!.getAttribute('src')).toBe('data:image/jpeg;base64,/9j/4AAQ');
      // Initials div must still be present (it is the background layer).
      expect(container.querySelector('[class="initials"]')).not.toBeNull();
    });
  });

  describe('contact details overlay', () => {
    it('is not visible before activation', () => {
      render(BASE_SPONSOR);
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it('appears when isActive=true and contains the email address', () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog!.textContent).toContain('alice@contoso.com');
    });

    it('appears when isActive=true and contains the office phone', () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      expect(container.querySelector('[role="dialog"]')!.textContent).toContain('+49 30 12345678');
    });

    it('opens as a full-height bottom drawer on compact-width touch windows', async () => {
      await openOnTouchViewport(390, 844);

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog?.getAttribute('data-position')).toBe('bottom');
      // 'medium' maps to durationSlow (300ms) — shorter than 'full' (500ms)
      // so the open/close animation feels native. Height is still 80dvh via
      // the --fui-Drawer--size CSS variable override.
      expect(dialog?.getAttribute('data-size')).toBe('medium');
      expect(dialog?.textContent).toContain('alice@contoso.com');
    });

    it('limits the bottom sheet to 80dvh via the CSS size variable', async () => {
      await openOnTouchViewport(390, 844);

      const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
      expect(dialog?.getAttribute('data-position')).toBe('bottom');
      expect(dialog?.style.getPropertyValue('--fui-Drawer--size')).toBe('80dvh');
    });

    it('uses a constrained side drawer on compact-height touch windows', async () => {
      await openOnTouchViewport(844, 390);

      const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
      expect(dialog?.getAttribute('data-position')).toBe('end');
      expect(dialog?.getAttribute('data-size')).toBe('small');
      expect(dialog?.style.getPropertyValue('--fui-Drawer--size')).toBe('clamp(320px, 46vw, 420px)');
    });

    it('uses a medium side drawer on tablet portrait widths', async () => {
      await openOnTouchViewport(820, 1180);

      const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
      expect(dialog?.getAttribute('data-position')).toBe('end');
      expect(dialog?.getAttribute('data-size')).toBe('small');
      expect(dialog?.style.getPropertyValue('--fui-Drawer--size')).toBe('clamp(360px, 44vw, 460px)');
    });

    it('uses an expanded side drawer on large tablet portrait widths', async () => {
      await openOnTouchViewport(1024, 1366);

      const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
      expect(dialog?.getAttribute('data-position')).toBe('end');
      expect(dialog?.getAttribute('data-size')).toBe('small');
      expect(dialog?.style.getPropertyValue('--fui-Drawer--size')).toBe('clamp(400px, 36vw, 480px)');
    });

    it('uses the widest side drawer on large tablet landscape widths', async () => {
      await openOnTouchViewport(1366, 1024);

      const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
      expect(dialog?.getAttribute('data-position')).toBe('end');
      expect(dialog?.getAttribute('data-size')).toBe('small');
      expect(dialog?.style.getPropertyValue('--fui-Drawer--size')).toBe('clamp(420px, 32vw, 520px)');
    });

    it('keeps the mobile drawer named via aria-label without repeating the sponsor name in the header', async () => {
      await openOnTouchViewport(390, 844);

      const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
      expect(dialog?.getAttribute('aria-label')).toBe('Alice Smith');
      // Bottom sheet dismisses via drag or backdrop tap — no visible close button.
      expect(dialog?.querySelector('[data-drawer-close="true"]')).toBeNull();

      const nameMatches = dialog?.textContent?.match(/Alice Smith/g) ?? [];
      expect(nameMatches).toHaveLength(1);
    });

    it('makes DrawerBody the scroll container for the touch drawer', async () => {
      await openOnTouchViewport(390, 844);

      const drawerBody = container.querySelector('[data-drawer-body]') as HTMLDivElement | null;
      const scrollContent = drawerBody?.firstElementChild as HTMLDivElement | null;
      expect(drawerBody).not.toBeNull();
      expect(drawerBody?.style.padding).toBe('0px');
      expect(drawerBody?.style.display).toBe('block');
      expect(drawerBody?.style.flexGrow).toBe('1');
      expect(drawerBody?.style.flexShrink).toBe('1');
      expect(['0', '0px']).toContain(drawerBody?.style.flexBasis ?? '');
      expect(drawerBody?.style.width).toBe('100%');
      expect(drawerBody?.style.height).toBe('100%');
      expect(drawerBody?.style.maxHeight).toBe('100%');
      expect(['0', '0px']).toContain(drawerBody?.style.minHeight ?? '');
      expect(['0', '0px']).toContain(drawerBody?.style.minWidth ?? '');
      expect(drawerBody?.style.boxSizing).toBe('border-box');
      expect(drawerBody?.style.overflowY).toBe('auto');
      expect(drawerBody?.style.overflowX).toBe('hidden');
      expect(drawerBody?.style.touchAction).toBe('pan-y');
      expect(drawerBody?.style.overscrollBehavior).toBe('contain');

      expect(scrollContent).not.toBeNull();
      expect(scrollContent?.style.width).toBe('100%');
      expect(scrollContent?.style.minHeight).toBe('100%');
      expect(scrollContent?.style.boxSizing).toBe('border-box');
    });

    it('keeps the sponsor header outside the mobile scroll container', async () => {
      await openOnTouchViewport(390, 844);

      const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
      const drawerBody = container.querySelector('[data-drawer-body]') as HTMLDivElement | null;
      const headerPanel = container.querySelector('[data-rich-header-panel="true"]') as HTMLDivElement | null;
      const drawerHandle = container.querySelector('[data-drawer-handle="true"]') as HTMLDivElement | null;
      expect(dialog).not.toBeNull();
      expect(drawerBody).not.toBeNull();
      expect(headerPanel).not.toBeNull();
      expect(drawerHandle).not.toBeNull();

      expect(dialog?.textContent).toContain('Alice Smith');
      expect(drawerBody?.textContent).not.toContain('Alice Smith');
      expect(drawerBody?.textContent).toContain('alice@contoso.com');
      expect(drawerBody?.contains(headerPanel!)).toBe(false);
      expect(headerPanel?.contains(drawerHandle!)).toBe(true);
    });

    it('can force the touch drawer path from the URL QA viewport override', async () => {
      window.history.replaceState({}, '', `${originalTestUrl}?gsi-qa-viewport=phone`);
      mockViewport(1440, 960);
      mockMatchMedia({
        '(pointer: coarse)': false,
      });
      render(BASE_SPONSOR, 'test-tenant-id', true);
      await flushAsync();

      const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
      expect(dialog?.getAttribute('data-position')).toBe('bottom');
    });

    it('calls onActivate when mouse enters the card', () => {
      const onActivate = jest.fn();
      render(BASE_SPONSOR, 'test-tenant-id', false, onActivate);
      const card = container.querySelector('[role="button"]') as HTMLElement;
      fireEvent(card, 'mouseenter');
      expect(onActivate).toHaveBeenCalled();
    });

    it('calls onScheduleDeactivate when mouse leaves the card', () => {
      const onScheduleDeactivate = jest.fn();
      render(BASE_SPONSOR, 'test-tenant-id', false, jest.fn(), onScheduleDeactivate);
      const card = container.querySelector('[role="button"]') as HTMLElement;
      fireEvent(card, 'mouseleave');
      expect(onScheduleDeactivate).toHaveBeenCalled();
    });

    it('calls onActivateNow when the card is clicked (tap on touch devices)', () => {
      const onActivateNow = jest.fn();
      render(BASE_SPONSOR, 'test-tenant-id', false, jest.fn(), jest.fn(), true, true, true,
        false, false, false, false, false, true, true, false, true, true, false, false,
        true, true, undefined, 'bing', false, onActivateNow);
      const card = container.querySelector('[role="button"]') as HTMLElement;
      act(() => { card.click(); });
      expect(onActivateNow).toHaveBeenCalled();
    });

    it('shares viewport listeners across multiple sponsor cards', () => {
      const resizeListenerSpy = jest.spyOn(window, 'addEventListener');
      const mediaQueryAddListener = jest.fn();
      const mediaQueryRemoveListener = jest.fn();

      window.matchMedia = jest.fn().mockReturnValue({
        matches: false,
        media: '(pointer: coarse)',
        onchange: null,
        addEventListener: mediaQueryAddListener,
        removeEventListener: mediaQueryRemoveListener,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }) as unknown as typeof window.matchMedia;

      const sharedProps = {
        hostTenantId: 'test-tenant-id',
        compact: false,
        isActive: false,
        onActivate: jest.fn(),
        onActivateNow: jest.fn(),
        onScheduleDeactivate: jest.fn(),
        onForceDeactivate: jest.fn(),
        showBusinessPhones: true,
        showMobilePhone: true,
        showWorkLocation: true,
        showCity: false,
        showCountry: false,
        showStreetAddress: false,
        showPostalCode: false,
        showState: false,
        azureMapsSubscriptionKey: undefined,
        externalMapProvider: 'bing' as const,
        showManager: true,
        showPresence: true,
        useInformalAddress: false,
        showSponsorJobTitle: true,
        showManagerJobTitle: true,
        showSponsorDepartment: false,
        showManagerDepartment: false,
        showSponsorPhoto: true,
        showManagerPhoto: true,
      };

      act(() => {
        renderIntoContainer(
          <>
            <SponsorCard sponsor={BASE_SPONSOR} {...sharedProps} />
            <SponsorCard
              sponsor={{
                ...BASE_SPONSOR,
                id: 'aaaaaaaa-0000-0000-0000-000000000002',
                displayName: 'Bob Smith',
                mail: 'bob@contoso.com',
              }}
              {...sharedProps}
            />
          </>
        );
      });

      const resizeRegistrations = resizeListenerSpy.mock.calls.filter(([eventName]) => eventName === 'resize');
      expect(resizeRegistrations).toHaveLength(1);
      expect(mediaQueryAddListener).toHaveBeenCalledTimes(1);

      resizeListenerSpy.mockRestore();
    });

    it('disables desktop popover auto-focus when pointer input focuses the card', () => {
      const onActivateNow = jest.fn();
      renderDesktopCard(false, onActivateNow);
      const card = container.querySelector('[role="button"]') as HTMLElement;

      fireEvent(card, 'mousedown');
      fireFocus(card);
      renderDesktopCard(true, onActivateNow);

      const popover = container.querySelector('[data-popover-disable-auto-focus]') as HTMLDivElement | null;
      expect(popover?.getAttribute('data-popover-disable-auto-focus')).toBe('true');
    });

    it('keeps desktop popover auto-focus when keyboard focus opens the card', () => {
      const onActivateNow = jest.fn();
      renderDesktopCard(false, onActivateNow);
      const card = container.querySelector('[role="button"]') as HTMLElement;

      fireFocus(card);
      renderDesktopCard(true, onActivateNow);

      const popover = container.querySelector('[data-popover-disable-auto-focus]') as HTMLDivElement | null;
      expect(popover?.getAttribute('data-popover-disable-auto-focus')).toBe('false');
    });

    it('shows the mobile phone when present and business phones are absent', () => {
      const sponsor: ISponsor = {
        ...BASE_SPONSOR,
        businessPhones: [],
        mobilePhone: '+1 555 0199',
      };
      render(sponsor, 'test-tenant-id', true);
      expect(container.querySelector('[role="dialog"]')!.textContent).toContain('+1 555 0199');
    });

    it('does not render email link when mail is absent', () => {
      render({ ...BASE_SPONSOR, mail: undefined }, 'test-tenant-id', true);
      const links = container.querySelectorAll('[role="dialog"] a[href^="mailto:"]');
      expect(links).toHaveLength(0);
    });

    it('renders a Teams chat link and a Teams call link when mail is present', () => {
      const tenantId = 'aaaabbbb-0000-0000-0000-000000000001';
      render(BASE_SPONSOR, tenantId, true);
      const links = Array.from(container.querySelectorAll('[role="dialog"] a[href*="teams.cloud.microsoft"]'));
      expect(links).toHaveLength(2);

      const chatLink = links.find(l => l.getAttribute('href')!.includes('/l/chat/'));
      const callLink = links.find(l => l.getAttribute('href')!.includes('/l/call/'));
      expect(chatLink).not.toBeNull();
      expect(callLink).not.toBeNull();

      // Chat link: tenantId before users
      const chatHref = chatLink!.getAttribute('href')!;
      expect(chatHref).toContain(`tenantId=${encodeURIComponent(tenantId)}`);
      expect(chatHref).toContain(encodeURIComponent('alice@contoso.com'));
      expect(chatHref.indexOf('tenantId')).toBeLessThan(chatHref.indexOf('users'));

      // Call link: Teams audio call deep link with withVideo=false
      const callHref = callLink!.getAttribute('href')!;
      expect(callHref).toContain(`tenantId=${encodeURIComponent(tenantId)}`);
      expect(callHref).toContain(encodeURIComponent('alice@contoso.com'));
      expect(callHref).toContain('withVideo=false');
      expect(callHref.indexOf('tenantId')).toBeLessThan(callHref.indexOf('users'));
    });

    it('does not render Teams links when mail is absent', () => {
      render({ ...BASE_SPONSOR, mail: undefined }, 'test-tenant-id', true);
      const links = container.querySelectorAll('[role="dialog"] a[href*="teams.cloud.microsoft"]');
      expect(links).toHaveLength(0);
    });

    it('does not render Teams Chat or Call links when hasTeams is false', () => {
      render({ ...BASE_SPONSOR, hasTeams: false }, 'test-tenant-id', true);
      const links = container.querySelectorAll('[role="dialog"] a[href*="teams.cloud.microsoft"]');
      expect(links).toHaveLength(0);
    });

    it('still renders the Email link when hasTeams is false', () => {
      render({ ...BASE_SPONSOR, hasTeams: false }, 'test-tenant-id', true);
      const links = container.querySelectorAll('[role="dialog"] a[href^="mailto:"]');
      expect(links.length).toBeGreaterThan(0);
    });

    describe('touch dismiss gesture', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('dismisses the drawer after a downward pull from scrollTop=0', async () => {
        const onForceDeactivate = jest.fn();
        await renderTouchDrawer(390, 844, { onForceDeactivate });

        const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
        const drawerBody = container.querySelector('[data-drawer-body]') as HTMLDivElement | null;
        expect(dialog).not.toBeNull();
        expect(drawerBody).not.toBeNull();

        Object.defineProperty(dialog!, 'offsetHeight', { configurable: true, value: 480 });
        drawerBody!.scrollTop = 0;

        dispatchTouchEvent(drawerBody!, 'touchstart', { clientX: 24, clientY: 120 }, 0);
        dispatchTouchEvent(drawerBody!, 'touchmove', { clientX: 30, clientY: 240 }, 200);

        expect(dialog?.style.transform).toBe('translateY(120px)');

        dispatchTouchEvent(drawerBody!, 'touchend', { clientX: 30, clientY: 240 }, 210);
        expect(onForceDeactivate).not.toHaveBeenCalled();

        act(() => {
          jest.advanceTimersByTime(220);
        });

        expect(onForceDeactivate).toHaveBeenCalledTimes(1);
      });

      it('springs back when the downward pull stays below the dismiss threshold', async () => {
        const onForceDeactivate = jest.fn();
        await renderTouchDrawer(390, 844, { onForceDeactivate });

        const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
        const drawerBody = container.querySelector('[data-drawer-body]') as HTMLDivElement | null;
        expect(dialog).not.toBeNull();
        expect(drawerBody).not.toBeNull();

        drawerBody!.scrollTop = 0;

        dispatchTouchEvent(drawerBody!, 'touchstart', { clientX: 20, clientY: 100 }, 0);
        dispatchTouchEvent(drawerBody!, 'touchmove', { clientX: 24, clientY: 132 }, 200);

        expect(dialog?.style.transform).toBe('translateY(32px)');

        dispatchTouchEvent(drawerBody!, 'touchend', { clientX: 24, clientY: 132 }, 210);
        expect(onForceDeactivate).not.toHaveBeenCalled();

        act(() => {
          jest.advanceTimersByTime(380);
        });

        expect(dialog?.style.transform).toBe('');
        expect(onForceDeactivate).not.toHaveBeenCalled();
      });

      it('does not start dismissing while the drawer content is still scrolled', async () => {
        const onForceDeactivate = jest.fn();
        await renderTouchDrawer(390, 844, { onForceDeactivate });

        const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
        const drawerBody = container.querySelector('[data-drawer-body]') as HTMLDivElement | null;
        expect(dialog).not.toBeNull();
        expect(drawerBody).not.toBeNull();

        drawerBody!.scrollTop = 48;

        dispatchTouchEvent(drawerBody!, 'touchstart', { clientX: 24, clientY: 120 }, 0);
        dispatchTouchEvent(drawerBody!, 'touchmove', { clientX: 28, clientY: 250 }, 200);
        dispatchTouchEvent(drawerBody!, 'touchend', { clientX: 28, clientY: 250 }, 210);

        act(() => {
          jest.runOnlyPendingTimers();
        });

        expect(dialog?.style.transform).toBe('');
        expect(onForceDeactivate).not.toHaveBeenCalled();
      });

      it('starts the same downward drag from the drawer shell outside the scroll body', async () => {
        const onForceDeactivate = jest.fn();
        await renderTouchDrawer(390, 844, { onForceDeactivate });

        const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
        const drawerBody = container.querySelector('[data-drawer-body]') as HTMLDivElement | null;
        expect(dialog).not.toBeNull();
        expect(drawerBody).not.toBeNull();

        Object.defineProperty(dialog!, 'offsetHeight', { configurable: true, value: 480 });
        drawerBody!.scrollTop = 0;

        dispatchTouchEvent(dialog!, 'touchstart', { clientX: 32, clientY: 24 }, 0);
        dispatchTouchEvent(dialog!, 'touchmove', { clientX: 36, clientY: 144 }, 200);

        expect(dialog?.style.transform).toBe('translateY(120px)');

        dispatchTouchEvent(dialog!, 'touchend', { clientX: 36, clientY: 144 }, 210);

        act(() => {
          jest.advanceTimersByTime(220);
        });

        expect(onForceDeactivate).toHaveBeenCalledTimes(1);
      });

      it('still dismisses normally after the drawer shell was tapped once before a content swipe', async () => {
        const onForceDeactivate = jest.fn();
        await renderTouchDrawer(390, 844, { onForceDeactivate });

        const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
        const drawerBody = container.querySelector('[data-drawer-body]') as HTMLDivElement | null;
        expect(dialog).not.toBeNull();
        expect(drawerBody).not.toBeNull();

        Object.defineProperty(dialog!, 'offsetHeight', { configurable: true, value: 480 });

        dispatchTouchEvent(dialog!, 'touchstart', { clientX: 32, clientY: 24 }, 0);
        dispatchTouchEvent(dialog!, 'touchend', { clientX: 32, clientY: 24 }, 10);

        drawerBody!.scrollTop = 0;
        dispatchTouchEvent(drawerBody!, 'touchstart', { clientX: 28, clientY: 120 }, 20);
        dispatchTouchEvent(drawerBody!, 'touchmove', { clientX: 32, clientY: 240 }, 220);

        expect(dialog?.style.transform).toBe('translateY(120px)');

        dispatchTouchEvent(drawerBody!, 'touchend', { clientX: 32, clientY: 240 }, 230);

        act(() => {
          jest.advanceTimersByTime(220);
        });

        expect(onForceDeactivate).toHaveBeenCalledTimes(1);
      });

      it('requires a fresh top-edge gesture after scrolling back to the top', async () => {
        const onForceDeactivate = jest.fn();
        await renderTouchDrawer(390, 844, { onForceDeactivate });

        const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
        const drawerBody = container.querySelector('[data-drawer-body]') as HTMLDivElement | null;
        expect(dialog).not.toBeNull();
        expect(drawerBody).not.toBeNull();

        Object.defineProperty(dialog!, 'offsetHeight', { configurable: true, value: 480 });

        drawerBody!.scrollTop = 48;
        dispatchTouchEvent(drawerBody!, 'touchstart', { clientX: 28, clientY: 120 }, 0);

        // The user reaches the top during the same gesture, but dismissal must
        // remain locked until they release and start a new swipe.
        drawerBody!.scrollTop = 0;
        dispatchTouchEvent(drawerBody!, 'touchmove', { clientX: 32, clientY: 240 }, 200);
        dispatchTouchEvent(drawerBody!, 'touchend', { clientX: 32, clientY: 240 }, 210);

        act(() => {
          jest.runOnlyPendingTimers();
        });

        expect(dialog?.style.transform).toBe('');
        expect(onForceDeactivate).not.toHaveBeenCalled();

        dispatchTouchEvent(drawerBody!, 'touchstart', { clientX: 28, clientY: 120 }, 220);
        dispatchTouchEvent(drawerBody!, 'touchmove', { clientX: 32, clientY: 240 }, 420);

        expect(dialog?.style.transform).toBe('translateY(120px)');

        dispatchTouchEvent(drawerBody!, 'touchend', { clientX: 32, clientY: 240 }, 430);

        act(() => {
          jest.advanceTimersByTime(220);
        });

        expect(onForceDeactivate).toHaveBeenCalledTimes(1);
      });

      it('uses the same downward dismiss gesture for side drawers on touch devices', async () => {
        const onForceDeactivate = jest.fn();
        await renderTouchDrawer(844, 390, { onForceDeactivate });

        const dialog = container.querySelector('[role="dialog"]') as HTMLDivElement | null;
        const drawerBody = container.querySelector('[data-drawer-body]') as HTMLDivElement | null;
        expect(dialog?.getAttribute('data-position')).toBe('end');
        expect(drawerBody).not.toBeNull();

        Object.defineProperty(dialog!, 'offsetHeight', { configurable: true, value: 420 });
        drawerBody!.scrollTop = 0;

        dispatchTouchEvent(drawerBody!, 'touchstart', { clientX: 36, clientY: 90 }, 0);
        dispatchTouchEvent(drawerBody!, 'touchmove', { clientX: 40, clientY: 210 }, 200);

        expect(dialog?.style.transform).toBe('translateY(120px)');

        dispatchTouchEvent(drawerBody!, 'touchend', { clientX: 40, clientY: 210 }, 210);

        act(() => {
          jest.advanceTimersByTime(220);
        });

        expect(onForceDeactivate).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('location rendering', () => {
    it('combines city and country into a single geographic row and also shows work location separately', () => {
      render(
        { ...BASE_SPONSOR, city: 'Munich', country: 'Germany', officeLocation: 'Building 4 / Floor 2' },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true
      );

      const dialog = container.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Munich, Germany');
      expect(dialog.textContent).toContain('Building 4 / Floor 2');
    });

    it('falls back to office location when no geographic data is available', () => {
      render(
        { ...BASE_SPONSOR, city: undefined, country: undefined, officeLocation: 'Building 4 / Floor 2' },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true
      );

      const dialog = container.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Building 4 / Floor 2');
    });

    it('shows only the city when country is hidden', () => {
      render(
        { ...BASE_SPONSOR, city: 'Munich', country: 'Germany', officeLocation: 'Building 4 / Floor 2' },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        false
      );

      const dialog = container.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Munich');
      expect(dialog.textContent).not.toContain('Germany');
      expect(dialog.textContent).toContain('Building 4 / Floor 2');
    });

    it('renders structured address rows when enabled', () => {
      render(
        {
          ...BASE_SPONSOR,
          streetAddress: 'Musterstrasse 10',
          postalCode: '80331',
          state: 'Bayern',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        false,
        false,
        true,
        true,
        true,
        true,
        true,
        false,
        false
      );

      const dialog = container.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Musterstrasse 10');
      expect(dialog.textContent).toContain('80331');
      expect(dialog.textContent).not.toContain('Bayern');
    });

    it('formats German display addresses separately from the maps query', () => {
      render(
        {
          ...BASE_SPONSOR,
          streetAddress: 'Musterstrasse 10',
          postalCode: '80331',
          city: 'Munich',
          state: 'Bayern',
          country: 'Germany',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        true,
        true,
        false,
        false,
        true,
        true,
        undefined,
        'google'
      );

      const dialog = container.querySelector('[role="dialog"]')!;
      const link = dialog.querySelector('a[href*="google.com/maps/search"]') as HTMLAnchorElement | null;
      expect(link?.textContent).toBe('Musterstrasse 10, 80331 Munich, Germany');
      expect(link?.getAttribute('href')).toContain(
        encodeURIComponent('Musterstrasse 10, 80331 Munich, Bayern, Germany')
      );
      expect(link?.getAttribute('href')).not.toContain(
        encodeURIComponent('Musterstrasse 10, 80331 Munich, Germany')
      );
    });

    it('trims whitespace from raw address fields before rendering or building map queries', () => {
      render(
        {
          ...BASE_SPONSOR,
          streetAddress: '\t Musterstrasse 10  ',
          postalCode: ' 80331\n',
          city: '  Munich\t',
          state: '  Bayern  ',
          country: '\nGermany ',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        true,
        true,
        false,
        false,
        true,
        true,
        undefined,
        'google'
      );

      const dialog = container.querySelector('[role="dialog"]')!;
      const link = dialog.querySelector('a[href*="google.com/maps/search"]') as HTMLAnchorElement | null;
      expect(link?.textContent).toBe('Musterstrasse 10, 80331 Munich, Germany');
      expect(link?.getAttribute('href')).toContain(
        encodeURIComponent('Musterstrasse 10, 80331 Munich, Bayern, Germany')
      );
      expect(link?.getAttribute('href')).not.toContain(encodeURIComponent('\t Musterstrasse 10  '));
      expect(link?.getAttribute('href')).not.toContain('%0A');
    });

    it('formats US display addresses with city state postal code order', () => {
      render(
        {
          ...BASE_SPONSOR,
          streetAddress: '1 Pike Street',
          postalCode: '98101',
          city: 'Seattle',
          state: 'WA',
          country: 'United States',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        true,
        true,
        false,
        false,
        true,
        true,
        undefined,
        'none'
      );

      const dialog = container.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain('1 Pike Street, Seattle WA 98101, United States');
    });

    it('uses postal code before city as the default for unknown countries', () => {
      render(
        {
          ...BASE_SPONSOR,
          streetAddress: 'Example Road 1',
          postalCode: '12345',
          city: 'Sampletown',
          state: 'Example Region',
          country: 'Wonderland',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        true,
        true,
        false,
        false,
        true,
        true,
        undefined,
        'none'
      );

      const dialog = container.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Example Road 1, 12345 Sampletown, Wonderland');
      expect(dialog.textContent).not.toContain('Example Region');
    });

    it('renders Azure Maps preview image when key is configured and geocoding succeeds', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ type: 'Point Address', position: { lat: 48.1371, lon: 11.5754 } }],
        }),
      }) as unknown as typeof fetch;

      render(
        {
          ...BASE_SPONSOR,
          streetAddress: 'Musterstrasse 10',
          city: 'Munich',
          country: 'Germany',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        false,
        true,
        false,
        false,
        false,
        true,
        true,
        'test-azure-maps-key',
        'bing'
      );

      await flushAsync();

      expect(globalThis.fetch).toHaveBeenCalled();
      const preview = container.querySelector('img[src*="atlas.microsoft.com/map/static/png"]');
      expect(preview).not.toBeNull();
    });

    it('uses the normalized maps query for Azure Maps geocoding instead of the display string', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ type: 'Point Address', position: { lat: 48.1371, lon: 11.5754 } }],
        }),
      }) as unknown as typeof fetch;

      render(
        {
          ...BASE_SPONSOR,
          streetAddress: 'Musterstrasse 10',
          postalCode: '80331',
          city: 'Munich',
          state: 'Bayern',
          country: 'Germany',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        true,
        true,
        false,
        false,
        true,
        true,
        'test-azure-maps-key',
        'bing'
      );

      await flushAsync();

      const geocodeUrl = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(geocodeUrl).toContain(
        `query=${encodeURIComponent('Musterstrasse 10, 80331 Munich, Bayern, Germany')}`
      );
      expect(geocodeUrl).not.toContain(
        `query=${encodeURIComponent('Musterstrasse 10, 80331 Munich, Germany')}`
      );
    });

    it('renders Azure Maps preview even when external map link is disabled', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ type: 'Point Address', position: { lat: 48.1371, lon: 11.5754 } }],
        }),
      }) as unknown as typeof fetch;

      render(
        {
          ...BASE_SPONSOR,
          streetAddress: 'Musterstrasse 10',
          city: 'Munich',
          country: 'Germany',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        false,
        true,
        false,
        false,
        false,
        true,
        true,
        'test-azure-maps-key',
        'none'
      );

      await flushAsync();

      expect(globalThis.fetch).toHaveBeenCalled();
      const preview = container.querySelector('img[src*="atlas.microsoft.com/map/static/png"]');
      expect(preview).not.toBeNull();
      const mapLink = container.querySelector('a[href*="google.com/maps/search"], a[href*="bing.com/maps"], a[href*="maps.apple.com"], a[href*="openstreetmap.org"]');
      expect(mapLink).toBeNull();
    });

    it('renders Azure Maps preview for city-only address (Geography/Municipality)', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ type: 'Geography', entityType: 'Municipality', position: { lat: 48.1371, lon: 11.5754 } }],
        }),
      }) as unknown as typeof fetch;

      render(
        {
          ...BASE_SPONSOR,
          streetAddress: undefined,
          city: 'Munich',
          country: 'Germany',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        false,
        true,
        false,
        false,
        false,
        true,
        true,
        'test-azure-maps-key',
        'bing'
      );

      await flushAsync();

      const preview = container.querySelector('img[src*="atlas.microsoft.com/map/static/png"]');
      expect(preview).not.toBeNull();
    });

    it('suppresses Azure Maps preview when geocoding returns only a country', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ type: 'Geography', entityType: 'Country', position: { lat: 51.1657, lon: 10.4515 } }],
        }),
      }) as unknown as typeof fetch;

      render(
        {
          ...BASE_SPONSOR,
          streetAddress: undefined,
          city: undefined,
          country: 'Germany',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        false,
        true,
        false,
        false,
        false,
        true,
        true,
        'test-azure-maps-key',
        'bing'
      );

      await flushAsync();

      const preview = container.querySelector('img[src*="atlas.microsoft.com/map/static/png"]');
      expect(preview).toBeNull();
    });

    it('shows external provider link fallback when Azure Maps key is missing', () => {
      render(
        {
          ...BASE_SPONSOR,
          streetAddress: 'Musterstrasse 10',
          city: 'Munich',
          country: 'Germany',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        false,
        true,
        false,
        false,
        false,
        true,
        true,
        undefined,
        'google'
      );

      const link = container.querySelector('a[href*="google.com/maps/search"]');
      expect(link).not.toBeNull();
      const preview = container.querySelector('img[src*="atlas.microsoft.com/map/static/png"]');
      expect(preview).toBeNull();
    });

    it('shows external provider link fallback when geocoding fails', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

      render(
        {
          ...BASE_SPONSOR,
          streetAddress: 'Musterstrasse 10',
          city: 'Munich',
          country: 'Germany',
        },
        'test-tenant-id',
        true,
        jest.fn(),
        jest.fn(),
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        true,
        true,
        false,
        true,
        false,
        false,
        false,
        true,
        true,
        'test-azure-maps-key',
        'google'
      );

      await flushAsync();

      const link = container.querySelector('a[href*="google.com/maps/search"]');
      expect(link).not.toBeNull();
      const preview = container.querySelector('img[src*="atlas.microsoft.com/map/static/png"]');
      expect(preview).toBeNull();
    });
  });

  describe('presence indicator', () => {
    it('never renders a presence badge on the tile, only in the rich card', () => {
      render({ ...BASE_SPONSOR, presence: 'Available' }, 'test-tenant-id', true);
      // Presence badge must not appear on the thumbnail tile — only inside the rich card header.
      const thumbnailCard = container.querySelector('[role="button"]');
      const thumbnailAvatar = thumbnailCard?.querySelector('[data-badge-status]');
      expect(thumbnailAvatar).not.toBeNull();
      expect(thumbnailAvatar!.getAttribute('data-badge-status')).toBe('none');
    });

    it('does not render a presence indicator when presence is absent', () => {
      render(BASE_SPONSOR);
      // Even when no presence data is provided, the thumbnail avatar has no badge.
      const thumbnailCard = container.querySelector('[role="button"]');
      const thumbnailAvatar = thumbnailCard?.querySelector('[data-badge-status]');
      expect(thumbnailAvatar).not.toBeNull();
      expect(thumbnailAvatar!.getAttribute('data-badge-status')).toBe('none');
    });

    it('shows the presence label in the rich card when active', () => {
      render({ ...BASE_SPONSOR, presence: 'Away' }, 'test-tenant-id', true);
      expect(container.querySelector('[role="dialog"]')!.textContent).toContain('Away');
    });

    it('does not render a presence indicator when hasTeams is false', () => {
      render({ ...BASE_SPONSOR, presence: 'Available', hasTeams: false });
      // hasTeams=false → showPresenceIndicator is false → thumbnail avatar has no badge.
      const thumbnailCard = container.querySelector('[role="button"]');
      const thumbnailAvatar = thumbnailCard?.querySelector('[data-badge-status]');
      expect(thumbnailAvatar).not.toBeNull();
      expect(thumbnailAvatar!.getAttribute('data-badge-status')).toBe('none');
    });

    it('does not show presence label in rich card when hasTeams is false', () => {
      render({ ...BASE_SPONSOR, presence: 'Away', hasTeams: false }, 'test-tenant-id', true);
      // The presence label text should not appear in the rich card
      const richPresenceLabels = container.querySelectorAll('[class="richPresenceLabel"]');
      expect(richPresenceLabels).toHaveLength(0);
    });

    it('shows activity label "In a conference call" instead of the generic busy label', () => {
      render(
        { ...BASE_SPONSOR, presence: 'Busy', presenceActivity: 'InAConferenceCall' },
        'test-tenant-id',
        true
      );
      expect(container.querySelector('[role="dialog"]')!.textContent).toContain('In a conference call');
      expect(container.querySelector('[role="dialog"]')!.textContent).not.toContain('Busy, Idle');
    });

    it('shows activity label for UrgentInterruptionsOnly as a dedicated status', () => {
      render(
        { ...BASE_SPONSOR, presence: 'DoNotDisturb', presenceActivity: 'UrgentInterruptionsOnly' },
        'test-tenant-id',
        true
      );
      expect(container.querySelector('[role="dialog"]')!.textContent).toContain('Urgent interruptions only');
    });

    it('shows localised "In a meeting" label for InAMeeting activity token', () => {
      render(
        { ...BASE_SPONSOR, presence: 'Busy', presenceActivity: 'InAMeeting' },
        'test-tenant-id',
        true
      );
      expect(container.querySelector('[role="dialog"]')!.textContent).toContain('In a meeting');
      expect(container.querySelector('[role="dialog"]')!.textContent).not.toContain('Busy');
    });

    it('shows localised "In a call" label for InACall activity token', () => {
      render(
        { ...BASE_SPONSOR, presence: 'Busy', presenceActivity: 'InACall' },
        'test-tenant-id',
        true
      );
      expect(container.querySelector('[role="dialog"]')!.textContent).toContain('In a call');
    });

    it('shows localised "Presenting" label for Presenting activity token', () => {
      render(
        { ...BASE_SPONSOR, presence: 'DoNotDisturb', presenceActivity: 'Presenting' },
        'test-tenant-id',
        true
      );
      expect(container.querySelector('[role="dialog"]')!.textContent).toContain('Presenting');
    });

    it('shows "Available, out of office" when availability is Available + activity OutOfOffice', () => {
      render(
        { ...BASE_SPONSOR, presence: 'Available', presenceActivity: 'OutOfOffice' },
        'test-tenant-id',
        true
      );
      const text = container.querySelector('[role="dialog"]')!.textContent!;
      expect(text).toContain('Available, out of office');
    });

    it('shows "Busy, out of office" when availability is Busy + activity OutOfOffice', () => {
      render(
        { ...BASE_SPONSOR, presence: 'Busy', presenceActivity: 'OutOfOffice' },
        'test-tenant-id',
        true
      );
      const text = container.querySelector('[role="dialog"]')!.textContent!;
      expect(text).toContain('Busy, out of office');
    });

    it('shows "Away, out of office" when availability is Away + activity OutOfOffice', () => {
      render(
        { ...BASE_SPONSOR, presence: 'Away', presenceActivity: 'OutOfOffice' },
        'test-tenant-id',
        true
      );
      const text = container.querySelector('[role="dialog"]')!.textContent!;
      expect(text).toContain('Away, out of office');
    });

    it('shows localised "Focusing" label for Focusing activity token', () => {
      render(
        { ...BASE_SPONSOR, presence: 'DoNotDisturb', presenceActivity: 'Focusing' },
        'test-tenant-id',
        true
      );
      expect(container.querySelector('[role="dialog"]')!.textContent).toContain('Focusing');
    });
  });

  describe('manager / organisation section', () => {
    it('does not render Organisation section when manager is absent', () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      expect(container.querySelector('[role="dialog"]')!.textContent).not.toContain('Organization');
    });

    it('renders manager name when managerDisplayName is set', () => {
      render(
        { ...BASE_SPONSOR, managerDisplayName: 'Bob Jones', managerJobTitle: 'CTO' },
        'test-tenant-id',
        true
      );
      const dialog = container.querySelector('[role="dialog"]')!;
      expect(dialog.textContent).toContain('Bob Jones');
      expect(dialog.textContent).toContain('CTO');
    });
  });

  describe('copy-to-clipboard buttons', () => {
    let clipboardWriteText: jest.Mock;

    beforeEach(() => {
      clipboardWriteText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: clipboardWriteText },
        configurable: true,
      });
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('renders a copy button for the email address', () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      const dialog = container.querySelector('[role="dialog"]')!;
      const copyBtn = dialog.querySelector('button[aria-label="Copy email address"]');
      expect(copyBtn).not.toBeNull();
    });

    it('renders a copy button for the work phone', () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      const dialog = container.querySelector('[role="dialog"]')!;
      const copyBtn = dialog.querySelector('button[aria-label="Copy work phone"]');
      expect(copyBtn).not.toBeNull();
    });

    it('renders a copy button for the office location', () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      const dialog = container.querySelector('[role="dialog"]')!;
      const copyBtn = dialog.querySelector('button[aria-label="Copy work location"]');
      expect(copyBtn).not.toBeNull();
    });

    it('copies the email to the clipboard when the copy button is clicked', async () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      const dialog = container.querySelector('[role="dialog"]')!;
      const copyBtn = dialog.querySelector('button[aria-label="Copy email address"]') as HTMLElement;
      await act(async () => { copyBtn.click(); });
      expect(clipboardWriteText).toHaveBeenCalledWith('alice@contoso.com');
    });

    it('switches to Copied! state after clicking and reverts after 1500 ms', async () => {
      render(BASE_SPONSOR, 'test-tenant-id', true);
      const dialog = container.querySelector('[role="dialog"]')!;
      const copyBtn = dialog.querySelector('button[aria-label="Copy email address"]') as HTMLElement;

      await act(async () => { copyBtn.click(); });
      expect(copyBtn.getAttribute('aria-label')).toBe('Copied!');

      act(() => { jest.advanceTimersByTime(1500); });
      expect(dialog.querySelector('button[aria-label="Copy email address"]')).not.toBeNull();
    });

    it('renders a copy button for the mobile phone when present', () => {
      const sponsor: ISponsor = { ...BASE_SPONSOR, businessPhones: [], mobilePhone: '+1 555 0199' };
      render(sponsor, 'test-tenant-id', true);
      const dialog = container.querySelector('[role="dialog"]')!;
      expect(dialog.querySelector('button[aria-label="Copy mobile number"]')).not.toBeNull();
    });
  });
});
