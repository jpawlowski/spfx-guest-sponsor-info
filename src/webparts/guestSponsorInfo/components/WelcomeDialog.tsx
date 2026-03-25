// SPDX-FileCopyrightText: 2026 Workoho GmbH <https://workoho.com>
// SPDX-FileCopyrightText: 2026 Julian Pawlowski <https://github.com/jpawlowski>
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import {
  Button,
  Field,
  Input,
  Link,
  Radio,
  RadioGroup,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import {
  BeakerRegular,
  CheckmarkCircleRegular,
  CloudRegular,
  PeopleTeamRegular,
} from '@fluentui/react-icons';
import * as strings from 'GuestSponsorInfoWebPartStrings';
import type { IWelcomeSetupConfig } from './IGuestSponsorInfoProps';
import workohoLogo from '../assets/workoho-default-logo.svg';

/**
 * URL of the Azure Function deployment guide on GitHub.
 * Shown as a help link in step 2 when the admin chooses the API path.
 */
const GITHUB_SETUP_URL = 'https://github.com/workoho/spfx-guest-sponsor-info/blob/main/docs/deployment.md';

const useStyles = makeStyles({
  // ── Inline card wrapper ───────────────────────────────────────────────────
  // The wizard renders as plain DOM content inside the web part zone — no
  // portal, no z-index fight with SharePoint chrome.  A centred card provides
  // the same visual weight as a modal without any of the SPFx caveats.
  root: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
  },
  card: {
    maxWidth: '520px',
    width: '100%',
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    borderRadius: tokens.borderRadiusXLarge,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
  },
  wizardTitle: {
    margin: 0,
    marginBottom: tokens.spacingVerticalL,
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase500,
    color: tokens.colorNeutralForeground1,
    display: 'block',
  },
  stepActions: {
    marginTop: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  // ── Step progress dots ─────────────────────────────────────────────────────
  stepDots: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    justifyContent: 'center',
    marginBottom: tokens.spacingVerticalL,
  },
  dot: {
    height: '8px',
    width: '8px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorNeutralStroke1,
    transition: 'width 0.2s ease, background-color 0.2s ease',
  },
  dotActive: {
    width: '24px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
  },
  dotDone: {
    backgroundColor: tokens.colorBrandBackground,
  },
  // ── Illustration placeholder area ─────────────────────────────────────────
  // Each step has a centred icon-in-circle that acts as a placeholder for
  // custom artwork. Replace the icon with an <img> pointing to your SVG asset
  // once the illustrations are ready.
  illustrationWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalS,
  },
  illustrationCircle: {
    // ILLUSTRATION PLACEHOLDER — Step 1 (Welcome):
    // Custom artwork suggestion: a stylised "sponsor card" layout showing a guest
    // user icon on the left connected by a dashed arc to two sponsor profile
    // cards on the right, rendered in Workoho brand blue (#0078D4) on a white
    // or light-blue background. Approx. 240 × 140 px SVG.
    width: '72px',
    height: '72px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationCircleSuccess: {
    // ILLUSTRATION PLACEHOLDER — Step 3 (Done):
    // Custom artwork suggestion: a large green checkmark shield with a subtle
    // confetti scatter, indicating successful setup completion.
    width: '72px',
    height: '72px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorPaletteGreenBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationIcon: {
    color: tokens.colorBrandForeground1,
  },
  illustrationIconSuccess: {
    color: tokens.colorPaletteGreenForeground1,
  },
  // ── Typography ─────────────────────────────────────────────────────────────
  body: {
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase400,
    display: 'block',
    marginBottom: tokens.spacingVerticalM,
  },
  muted: {
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase400,
    display: 'block',
  },
  workohoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalL,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  workohoLogo: {
    height: '20px',
    display: 'block',
    flexShrink: 0,
  },
  // ── Setup step (step 2) ────────────────────────────────────────────────────
  setupIntro: {
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase400,
    display: 'block',
    marginBottom: tokens.spacingVerticalL,
  },
  // ILLUSTRATION PLACEHOLDER — Step 2 (Setup choice):
  // Custom artwork suggestion: a split-screen layout. Left side shows a cloud
  // icon with an Azure Functions "⚡" badge (representing the API path); right
  // side shows a beaker / preview eye with "DEMO" text (representing demo mode).
  // Both sides are separated by a thin vertical divider.  The currently selected
  // side is subtly highlighted with a brand-colour glow.  Approx. 320 × 120 px.
  optionGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalM,
  },
  optionCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `2px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    '&:hover': {
      border: `2px solid ${tokens.colorNeutralStroke1}`,
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  optionCardSelected: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
    '&:hover': {
      border: `2px solid ${tokens.colorBrandStroke1}`,
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
  optionIcon: {
    color: tokens.colorBrandForeground1,
    flexShrink: 0,
    marginTop: '2px',
  },
  optionText: {
    flex: 1,
  },
  apiFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalXL,
  },
  docsLink: {
    display: 'block',
    marginTop: tokens.spacingVerticalXS,
  },
  // ── Action rows ────────────────────────────────────────────────────────────
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    width: '100%',
  },
  actionsSplit: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  skipLink: {
    color: tokens.colorNeutralForeground3,
    textDecorationLine: 'none',
    fontSize: tokens.fontSizeBase200,
    cursor: 'pointer',
    '&:hover': {
      color: tokens.colorNeutralForeground2,
      textDecorationLine: 'underline',
    },
  },
  actionsRight: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────────────────────────

interface IWelcomeDialogProps {
  open: boolean;
  /** Called when the wizard is complete (finish) or deliberately skipped. */
  onComplete: (config: IWelcomeSetupConfig) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step content sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Step 1 — Welcome intro + Workoho branding. */
const Step1Welcome: React.FC<{ classes: ReturnType<typeof useStyles> }> = ({ classes }) => (
  <>
    {/* ILLUSTRATION PLACEHOLDER — replace <div> with <img src={yourAsset} alt="" /> */}
    <div className={classes.illustrationWrap}>
      <div className={classes.illustrationCircle}>
        <PeopleTeamRegular style={{ width: 40, height: 40 }} className={classes.illustrationIcon} />
      </div>
    </div>
    <Text block className={classes.body}>{strings.WelcomeDialogBody}</Text>
    <div className={classes.workohoRow}>
      <img src={workohoLogo} alt="Workoho" className={classes.workohoLogo} />
      <Text className={classes.muted}>
        {strings.WelcomeDialogBroughtToYouBy}{' '}
        <Link href="https://workoho.com" target="_blank" rel="noopener noreferrer">
          {strings.WelcomeDialogWorkohoLinkLabel}
        </Link>
      </Text>
    </div>
  </>
);

interface IStep2SetupProps {
  classes: ReturnType<typeof useStyles>;
  choice: 'api' | 'demo';
  apiUrl: string;
  clientId: string;
  urlError: string;
  onChoiceChange: (v: 'api' | 'demo') => void;
  onApiUrlChange: (v: string) => void;
  onClientIdChange: (v: string) => void;
}

/** Step 2 — Setup choice: API vs. Demo Mode + conditional API fields. */
const Step2Setup: React.FC<IStep2SetupProps> = ({
  classes, choice, apiUrl, clientId, urlError,
  onChoiceChange, onApiUrlChange, onClientIdChange,
}) => (
  <>
    <Text block className={classes.setupIntro}>{strings.WelcomeDialogSetupIntro}</Text>

    {/* ILLUSTRATION PLACEHOLDER — replace with a split-screen SVG asset (see comment in useStyles) */}
    <RadioGroup value={choice} onChange={(_, d) => onChoiceChange(d.value as 'api' | 'demo')}>
      {/* Option A: Guest Sponsor API */}
      <div
        role="presentation"
        className={mergeClasses(classes.optionCard, choice === 'api' && classes.optionCardSelected)}
        onClick={() => onChoiceChange('api')}
      >
        <CloudRegular style={{ width: 24, height: 24 }} className={classes.optionIcon} />
        <div className={classes.optionText}>
          <Radio value="api" label={
            <>
              <Text weight="semibold">{strings.WelcomeDialogOptionApiTitle}</Text>
              <Text size={200} block className={classes.muted}>{strings.WelcomeDialogOptionApiBody}</Text>
            </>
          } />
        </div>
      </div>

      {/* Conditional API fields — only shown when 'api' is selected */}
      {choice === 'api' && (
        <div className={classes.apiFields}>
          <Field
            label={strings.FunctionUrlFieldLabel}
            required
            validationMessage={urlError || undefined}
            validationState={urlError ? 'error' : 'none'}
          >
            <Input
              value={apiUrl}
              onChange={(_, d) => onApiUrlChange(d.value)}
              placeholder="https://my-app.azurewebsites.net"
              type="url"
            />
          </Field>
          <Field label={strings.FunctionClientIdFieldLabel}>
            <Input
              value={clientId}
              onChange={(_, d) => onClientIdChange(d.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </Field>
          <Link
            href={GITHUB_SETUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={classes.docsLink}
          >
            {strings.WelcomeDialogOptionApiDocsLabel}
          </Link>
        </div>
      )}

      {/* Option B: Demo Mode */}
      <div
        role="presentation"
        className={mergeClasses(classes.optionCard, choice === 'demo' && classes.optionCardSelected)}
        onClick={() => onChoiceChange('demo')}
      >
        <BeakerRegular style={{ width: 24, height: 24 }} className={classes.optionIcon} />
        <div className={classes.optionText}>
          <Radio value="demo" label={
            <>
              <Text weight="semibold">{strings.WelcomeDialogOptionDemoTitle}</Text>
              <Text size={200} block className={classes.muted}>{strings.WelcomeDialogOptionDemoBody}</Text>
            </>
          } />
        </div>
      </div>
    </RadioGroup>
  </>
);

/** Step 3 — Confirmation (content differs by chosen path). */
const Step3Done: React.FC<{ classes: ReturnType<typeof useStyles>; choice: 'api' | 'demo' }> = ({ classes, choice }) => (
  <>
    {/* ILLUSTRATION PLACEHOLDER — replace <div> with <img src={yourSuccessAsset} alt="" /> */}
    <div className={classes.illustrationWrap}>
      <div className={classes.illustrationCircleSuccess}>
        <CheckmarkCircleRegular style={{ width: 40, height: 40 }} className={classes.illustrationIconSuccess} />
      </div>
    </div>
    <Text block className={classes.body}>
      {choice === 'api' ? strings.WelcomeDialogDoneApiBody : strings.WelcomeDialogDoneDemoBody}
    </Text>
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main dialog component
// ─────────────────────────────────────────────────────────────────────────────

const WelcomeDialog: React.FC<IWelcomeDialogProps> = ({ open, onComplete }) => {
  const classes = useStyles();
  const [step, setStep] = React.useState(0);
  const [choice, setChoice] = React.useState<'api' | 'demo'>('api');
  const [apiUrl, setApiUrl] = React.useState('');
  const [clientId, setClientId] = React.useState('');
  const [urlError, setUrlError] = React.useState('');

  // Reset wizard state whenever the dialog is (re-)opened.
  React.useEffect(() => {
    if (open) {
      setStep(0);
      setChoice('api');
      setApiUrl('');
      setClientId('');
      setUrlError('');
    }
  }, [open]);

  const handleNext = (): void => {
    if (step === 1 && choice === 'api' && !apiUrl.trim()) {
      setUrlError(strings.WelcomeDialogFunctionUrlRequired);
      return;
    }
    setUrlError('');
    setStep(s => s + 1);
  };

  const handleBack = (): void => {
    setUrlError('');
    setStep(s => s - 1);
  };

  const handleFinish = (): void => {
    onComplete({
      chosenPath: choice,
      apiUrl: choice === 'api' ? apiUrl.trim() : undefined,
      clientId: choice === 'api' ? clientId.trim() : undefined,
    });
  };

  const handleSkip = (): void => onComplete({ chosenPath: 'skip' });

  const stepTitle =
    step === 0 ? strings.WelcomeDialogTitle :
    step === 1 ? strings.WelcomeDialogSetupTitle :
    choice === 'api' ? strings.WelcomeDialogDoneApiTitle : strings.WelcomeDialogDoneDemoTitle;

  if (!open) return null;

  return (
    <div className={classes.root}>
      <div className={classes.card}>
        <Text as="h2" className={classes.wizardTitle}>{stepTitle}</Text>

        {/* Progress dots */}
        <div className={classes.stepDots} role="group" aria-label="Step progress">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              aria-hidden="true"
              className={mergeClasses(
                classes.dot,
                i === step && classes.dotActive,
                i < step && classes.dotDone,
              )}
            />
          ))}
        </div>

        {step === 0 && <Step1Welcome classes={classes} />}
        {step === 1 && (
          <Step2Setup
            classes={classes}
            choice={choice}
            apiUrl={apiUrl}
            clientId={clientId}
            urlError={urlError}
            onChoiceChange={setChoice}
            onApiUrlChange={(v) => { setApiUrl(v); if (v.trim()) setUrlError(''); }}
            onClientIdChange={setClientId}
          />
        )}
        {step === 2 && <Step3Done classes={classes} choice={choice} />}

        <div className={classes.stepActions}>
          {step === 0 && (
            <div className={classes.actionsSplit}>
              <Link
                as="button"
                appearance="subtle"
                className={classes.skipLink}
                onClick={handleSkip}
              >
                {strings.WelcomeDialogSkipButton}
              </Link>
              <Button appearance="primary" onClick={handleNext}>
                {strings.WelcomeDialogNextButton}
              </Button>
            </div>
          )}
          {step === 1 && (
            <div className={classes.actionsSplit}>
              <Button appearance="secondary" onClick={handleBack}>
                {strings.WelcomeDialogBackButton}
              </Button>
              <Button appearance="primary" onClick={handleNext}>
                {strings.WelcomeDialogNextButton}
              </Button>
            </div>
          )}
          {step === 2 && (
            <div className={classes.actionsSplit}>
              <Button appearance="secondary" onClick={handleBack}>
                {strings.WelcomeDialogBackButton}
              </Button>
              <Button appearance="primary" onClick={handleFinish}>
                {strings.WelcomeDialogDismissButton}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WelcomeDialog;
