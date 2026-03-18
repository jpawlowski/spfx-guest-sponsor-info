import * as React from 'react';
import { ISponsor } from '../services/ISponsor';
import styles from './GuestSponsorInfo.module.scss';

/** Fluent UI persona colours used as avatar backgrounds when no photo is available. */
const PERSONA_COLORS = [
  '#D13438', '#CA5010', '#986F0B', '#498205',
  '#038387', '#004E8C', '#8764B8', '#69797E',
  '#C19C00', '#00B294', '#E3008C', '#0099BC',
];

/** Derives a consistent colour from a display name string. */
function getInitialsColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return PERSONA_COLORS[Math.abs(hash) % PERSONA_COLORS.length];
}

/** Extracts up to two initials from a display name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

interface ISponsorCardProps {
  sponsor: ISponsor;
}

const SponsorCard: React.FC<ISponsorCardProps> = ({ sponsor }) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const initials = getInitials(sponsor.displayName);
  const bgColor = getInitialsColor(sponsor.displayName);

  const openDetails = (): void => setShowDetails(true);
  const closeDetails = (): void => setShowDetails(false);

  const hasPhone =
    (sponsor.businessPhones && sponsor.businessPhones.length > 0) || !!sponsor.mobilePhone;

  return (
    <div
      className={styles.card}
      onMouseEnter={openDetails}
      onMouseLeave={closeDetails}
      onFocus={openDetails}
      onBlur={closeDetails}
      tabIndex={0}
      role="article"
      aria-label={sponsor.displayName}
    >
      {/* Avatar – live photo or coloured initials */}
      <div className={styles.avatar}>
        {sponsor.photoUrl ? (
          <img src={sponsor.photoUrl} alt="" className={styles.photo} />
        ) : (
          <div className={styles.initials} style={{ backgroundColor: bgColor }}>
            {initials}
          </div>
        )}
      </div>

      {/* Primary text visible at all times */}
      <div className={styles.cardName}>{sponsor.displayName}</div>
      {sponsor.jobTitle && (
        <div className={styles.cardJobTitle}>{sponsor.jobTitle}</div>
      )}

      {/* Contact details panel – rendered on hover or keyboard focus */}
      {showDetails && (
        <div className={styles.detailsCard} role="tooltip">
          <div className={styles.detailsName}>{sponsor.displayName}</div>
          {sponsor.jobTitle && (
            <div className={styles.detailsMeta}>{sponsor.jobTitle}</div>
          )}
          {sponsor.department && (
            <div className={styles.detailsMeta}>{sponsor.department}</div>
          )}
          {sponsor.officeLocation && (
            <div className={styles.detailsMeta}>{sponsor.officeLocation}</div>
          )}
          {sponsor.mail && (
            <a
              href={`mailto:${sponsor.mail}`}
              className={styles.contactLink}
              tabIndex={-1}
            >
              {sponsor.mail}
            </a>
          )}
          {hasPhone && (
            <>
              {sponsor.businessPhones && sponsor.businessPhones.length > 0 && (
                <a
                  href={`tel:${sponsor.businessPhones[0]}`}
                  className={styles.contactLink}
                  tabIndex={-1}
                >
                  {sponsor.businessPhones[0]}
                </a>
              )}
              {sponsor.mobilePhone && (
                <a
                  href={`tel:${sponsor.mobilePhone}`}
                  className={styles.contactLink}
                  tabIndex={-1}
                >
                  {sponsor.mobilePhone}
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SponsorCard;
