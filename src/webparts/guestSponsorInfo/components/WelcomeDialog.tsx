import * as React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  FluentProvider,
  Link,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { Theme } from '@fluentui/react-components';
import * as strings from 'GuestSponsorInfoWebPartStrings';
import workohoLogo from '../assets/workoho-default-logo.svg';

const useStyles = makeStyles({
  surface: {
    maxWidth: '480px',
    width: '90vw',
    boxSizing: 'border-box',
  },
  logo: {
    display: 'block',
    height: '28px',
    marginBottom: tokens.spacingVerticalM,
  },
  body: {
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase400,
    display: 'block',
    marginBottom: tokens.spacingVerticalM,
  },
  workohoRow: {
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase400,
    display: 'block',
  },
  actions: {
    paddingTop: tokens.spacingVerticalM,
  },
});

interface IWelcomeDialogProps {
  open: boolean;
  onDismiss: () => void;
  /** Fluent v9 theme forwarded from the host web part — ensures the dialog
   * surface picks up the SharePoint site theme despite rendering in a portal
   * outside the main FluentProvider DOM tree. */
  v9Theme?: Theme;
}

const WelcomeDialog: React.FC<IWelcomeDialogProps> = ({ open, onDismiss, v9Theme }) => {
  const classes = useStyles();
  return (
    <Dialog
      open={open}
      modalType="modal"
      onOpenChange={(_, data) => {
        // Allow Escape key to dismiss, but keep the dialog open when the user
        // accidentally clicks the backdrop so they are sure to see the content.
        if (data.type !== 'backdropClick') {
          onDismiss();
        }
      }}
    >
      <DialogSurface className={classes.surface}>
        {/* A nested FluentProvider supplies theme tokens inside the portal so
            buttons and links pick up the SharePoint site's brand colour. */}
        <FluentProvider theme={v9Theme}>
          <DialogBody>
            <DialogTitle>
              <img
                src={workohoLogo}
                alt="Workoho"
                className={classes.logo}
              />
              {strings.WelcomeDialogTitle}
            </DialogTitle>
            <DialogContent>
              <Text block className={classes.body}>
                {strings.WelcomeDialogBody}
              </Text>
              <Text block className={classes.workohoRow}>
                {strings.WelcomeDialogBroughtToYouBy}{' '}
                <Link
                  href="https://workoho.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {strings.WelcomeDialogWorkohoLinkLabel}
                </Link>
              </Text>
            </DialogContent>
            <DialogActions className={classes.actions}>
              <Button appearance="primary" onClick={onDismiss}>
                {strings.WelcomeDialogDismissButton}
              </Button>
            </DialogActions>
          </DialogBody>
        </FluentProvider>
      </DialogSurface>
    </Dialog>
  );
};

export default WelcomeDialog;
