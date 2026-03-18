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

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  container.remove();
});

function render(sponsor: ISponsor, hostTenantId = 'test-tenant-id'): void {
  act(() => { ReactDOM.render(<SponsorCard sponsor={sponsor} hostTenantId={hostTenantId} />, container); });
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

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('SponsorCard', () => {
  describe('basic rendering', () => {
    it('renders the display name', () => {
      render(BASE_SPONSOR);
      expect(container.textContent).toContain('Alice Smith');
    });

    it('renders the job title', () => {
      render(BASE_SPONSOR);
      expect(container.textContent).toContain('Project Manager');
    });

    it('has an accessible article role', () => {
      render(BASE_SPONSOR);
      expect(container.querySelector('[role="article"]')).not.toBeNull();
    });

    it('sets aria-label to the display name', () => {
      render(BASE_SPONSOR);
      const card = container.querySelector('[role="article"]');
      expect(card?.getAttribute('aria-label')).toBe('Alice Smith');
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

    it('renders an <img> element and no initials box when photoUrl is provided', () => {
      render({ ...BASE_SPONSOR, photoUrl: 'data:image/jpeg;base64,/9j/4AAQ' });
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img!.getAttribute('src')).toBe('data:image/jpeg;base64,/9j/4AAQ');
      expect(container.querySelector('[class="initials"]')).toBeNull();
    });
  });

  describe('contact details overlay', () => {
    it('is not visible before any user interaction', () => {
      render(BASE_SPONSOR);
      expect(container.querySelector('[role="tooltip"]')).toBeNull();
    });

    it('appears on mouseenter and contains the email address', () => {
      render(BASE_SPONSOR);
      const card = container.querySelector('[role="article"]') as HTMLElement;
      fireEvent(card, 'mouseenter');
      const tooltip = container.querySelector('[role="tooltip"]');
      expect(tooltip).not.toBeNull();
      expect(tooltip!.textContent).toContain('alice@contoso.com');
    });

    it('appears on mouseenter and contains the office phone', () => {
      render(BASE_SPONSOR);
      const card = container.querySelector('[role="article"]') as HTMLElement;
      fireEvent(card, 'mouseenter');
      expect(container.querySelector('[role="tooltip"]')!.textContent).toContain('+49 30 12345678');
    });

    it('disappears on mouseleave after a short delay', () => {
      jest.useFakeTimers();
      render(BASE_SPONSOR);
      const card = container.querySelector('[role="article"]') as HTMLElement;
      act(() => { fireEvent(card, 'mouseenter'); });
      act(() => { fireEvent(card, 'mouseleave'); });
      // Tooltip still visible during the delay
      expect(container.querySelector('[role="tooltip"]')).not.toBeNull();
      // Advance past the 150 ms hide delay
      act(() => { jest.advanceTimersByTime(200); });
      expect(container.querySelector('[role="tooltip"]')).toBeNull();
      jest.useRealTimers();
    });

    it('shows the mobile phone when present and business phones are absent', () => {
      const sponsor: ISponsor = {
        ...BASE_SPONSOR,
        businessPhones: [],
        mobilePhone: '+1 555 0199',
      };
      render(sponsor);
      const card = container.querySelector('[role="article"]') as HTMLElement;
      fireEvent(card, 'mouseenter');
      expect(container.querySelector('[role="tooltip"]')!.textContent).toContain('+1 555 0199');
    });

    it('does not render email link when mail is absent', () => {
      render({ ...BASE_SPONSOR, mail: undefined });
      const card = container.querySelector('[role="article"]') as HTMLElement;
      fireEvent(card, 'mouseenter');
      const links = container.querySelectorAll('[role="tooltip"] a[href^="mailto:"]');
      expect(links).toHaveLength(0);
    });

    it('renders Teams home-tenant chat link when mail is present', () => {
      render(BASE_SPONSOR, 'aaaabbbb-0000-0000-0000-000000000001');
      const card = container.querySelector('[role="article"]') as HTMLElement;
      fireEvent(card, 'mouseenter');
      const links = Array.from(container.querySelectorAll('[role="tooltip"] a[href*="teams.microsoft.com"]'));
      const homeLink = links.find(l => !l.getAttribute('href')!.includes('tenantId'));
      expect(homeLink).not.toBeNull();
      expect(homeLink!.getAttribute('href')).toContain(encodeURIComponent('alice@contoso.com'));
    });

    it('renders Teams guest-tenant chat link with correct tenantId', () => {
      const tenantId = 'aaaabbbb-0000-0000-0000-000000000001';
      render(BASE_SPONSOR, tenantId);
      const card = container.querySelector('[role="article"]') as HTMLElement;
      fireEvent(card, 'mouseenter');
      const links = Array.from(container.querySelectorAll('[role="tooltip"] a[href*="teams.microsoft.com"]'));
      const guestLink = links.find(l => l.getAttribute('href')!.includes('tenantId'));
      expect(guestLink).not.toBeNull();
      expect(guestLink!.getAttribute('href')).toContain(encodeURIComponent(tenantId));
    });

    it('does not render Teams links when mail is absent', () => {
      render({ ...BASE_SPONSOR, mail: undefined });
      const card = container.querySelector('[role="article"]') as HTMLElement;
      fireEvent(card, 'mouseenter');
      const links = container.querySelectorAll('[role="tooltip"] a[href*="teams.microsoft.com"]');
      expect(links).toHaveLength(0);
    });
  });
});
