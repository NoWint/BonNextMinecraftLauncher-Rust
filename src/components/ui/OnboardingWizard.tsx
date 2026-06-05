import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { Icon } from './Icon';
import { SpotlightOverlay } from './SpotlightOverlay';
import type { TourStep } from './SpotlightOverlay';
import styles from './OnboardingWizard.module.css';

const ONBOARDING_SKIPPED_KEY = 'bonnext_onboarding_skipped';
const ONBOARDING_COMPLETED_KEY = 'bonnext_onboarding_completed';
const ONBOARDING_FORCE_SHOW_KEY = 'bonnext_onboarding_force_show';

export function isOnboardingSkipped(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SKIPPED_KEY) === '1';
  } catch {
    return false;
  }
}

export function isOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === '1';
  } catch {
    return false;
  }
}

export function isOnboardingForceShow(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_FORCE_SHOW_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearForceShow() {
  try {
    localStorage.removeItem(ONBOARDING_FORCE_SHOW_KEY);
  } catch {
    /* empty */
  }
}

function markSkipped() {
  try {
    localStorage.setItem(ONBOARDING_SKIPPED_KEY, '1');
  } catch {
    /* empty */
  }
}

function markCompleted() {
  try {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, '1');
  } catch {
    /* empty */
  }
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_SKIPPED_KEY);
    localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    localStorage.setItem(ONBOARDING_FORCE_SHOW_KEY, '1');
  } catch {
    /* empty */
  }
}

type TourMode = 'select' | 'quick' | 'detailed';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function OnboardingWizard({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [mode, setMode] = useState<TourMode>('select');
  const [quickStep, setQuickStep] = useState(0);
  const [detailedStep, setDetailedStep] = useState(0);

  useEffect(() => {
    if (open) {
      setMode('select');
      setQuickStep(0);
      setDetailedStep(0);
    }
  }, [open]);

  const handleSkip = () => {
    markSkipped();
    onClose();
  };

  const quickSteps: TourStep[] = [
    {
      selector: '[data-tour="home-new-instance"]',
      page: 'home',
      title: t('onboarding.quickTitle') || 'Quick Start',
      description: t('onboarding.quickStep1') || 'Click the "New Instance" button to start.',
      position: 'bottom',
    },
    {
      selector: '[data-tour="new-name"]',
      page: 'new',
      title: t('onboarding.quickTitle') || 'Quick Start',
      description: t('onboarding.quickStep2') || 'Give your world a name.',
      position: 'bottom',
    },
    {
      selector: '[data-tour="new-version"]',
      page: 'new',
      title: t('onboarding.quickTitle') || 'Quick Start',
      description: t('onboarding.quickStep3') || 'Select a Minecraft version. Latest is best.',
      position: 'bottom',
    },
    {
      selector: '[data-tour="new-create"]',
      page: 'new',
      title: t('onboarding.quickTitle') || 'Quick Start',
      description: t('onboarding.quickStep4') || 'Click "Create" to finish.',
      position: 'top',
    },
    {
      selector: '[data-tour="home-play"]',
      page: 'home',
      title: t('onboarding.quickTitle') || 'Quick Start',
      description: t('onboarding.quickStep5') || 'Now click "Launch" to play!',
      position: 'bottom',
    },
  ];

  const detailedSteps = [
    {
      page: 'home',
      title: t('onboarding.detailTitle') || 'Welcome to BonNext',
      description:
        t('onboarding.detailHome') ||
        'HomePage is your launch center. Quick start game, manage instances, and see news.',
      highlight: t('onboarding.detailHomeHighlight') || 'Play area · Instance list · News ticker',
    },
    {
      page: 'instances',
      title: t('onboarding.detailInstancesTitle') || 'Instances',
      description:
        t('onboarding.detailInstances') ||
        'Each instance is an independent Minecraft world with its own mods, settings, and saves.',
      highlight: t('onboarding.detailInstancesHighlight') || 'Create · Launch · Delete · Snapshots',
    },
    {
      page: 'store',
      title: t('onboarding.detailMarketTitle') || 'Marketplace',
      description:
        t('onboarding.detailMarket') ||
        'Browse thousands of mods, modpacks, shaders, and resource packs. Install with one click.',
      highlight: t('onboarding.detailMarketHighlight') || 'Search · Filter · Install · Collections',
    },
    {
      page: 'settings',
      title: t('onboarding.detailSettingsTitle') || 'Settings',
      description:
        t('onboarding.detailSettings') || 'Customize Java path, memory, theme, language, and more. Find it all here.',
      highlight: t('onboarding.detailSettingsHighlight') || 'Memory · Java · Theme · Language',
    },
  ];

  const handleQuickStart = () => {
    setMode('quick');
    setQuickStep(0);
    navigate('/home');
  };

  const handleDetailedStart = () => {
    setMode('detailed');
    setDetailedStep(0);
    navigate('/home');
  };

  const handleQuickComplete = () => {
    markCompleted();
    onClose();
  };

  const handleQuickNext = (step: number) => {
    const next = step + 1;
    if (next >= quickSteps.length) {
      handleQuickComplete();
      return;
    }
    setQuickStep(next);
    const targetPage = quickSteps[next].page;
    if (targetPage === 'home') navigate('/home');
    else if (targetPage === 'new') navigate('/instances/new');
    else if (targetPage === 'instances') navigate('/instances');
    else if (targetPage === 'store') navigate('/store');
    else if (targetPage === 'settings') navigate('/settings');
    else if (targetPage === 'collections') navigate('/collections');
  };

  const handleDetailedNext = useCallback(() => {
    setDetailedStep((prev) => {
      const next = prev + 1;
      if (next >= detailedSteps.length) {
        markCompleted();
        onClose();
        return prev;
      }
      const p = detailedSteps[next].page;
      if (p === 'home') navigate('/home');
      else if (p === 'instances') navigate('/instances');
      else if (p === 'store') navigate('/store');
      else if (p === 'settings') navigate('/settings');
      else if (p === 'collections') navigate('/collections');
      return next;
    });
  }, [detailedSteps, onClose]);

  if (!open) return null;

  return (
    <>
      {mode === 'select' && (
        <div className={styles.overlay}>
          <div className={styles.modePanel}>
            <button className={styles.skipBtn} onClick={handleSkip}>
              {t('onboarding.skip') || 'Skip'}
            </button>

            <div className={styles.modeTitle}>{t('onboarding.welcome') || 'Welcome to BonNext'}</div>
            <div className={styles.modeSubtitle}>
              {t('onboarding.chooseMode') || "Choose how you'd like to get started"}
            </div>

            <div className={styles.modeCards}>
              <button className={styles.modeCard} onClick={handleQuickStart}>
                <div className={styles.modeCardIcon}>
                  <Icon name="bolt" size={16} />
                </div>
                <div className={styles.modeCardTitle}>{t('onboarding.quickMode') || 'Quick Start'}</div>
                <div className={styles.modeCardDesc}>
                  {t('onboarding.quickModeDesc') || 'Step-by-step guide on the real interface. Learn by doing.'}
                </div>
                <div className={styles.modeCardHint}>
                  {t('onboarding.quickModeHint') || '~2 minutes · Guided clicks'}
                </div>
              </button>

              <button className={styles.modeCard} onClick={handleDetailedStart}>
                <div className={styles.modeCardIcon}>
                  <Icon name="book" size={16} />
                </div>
                <div className={styles.modeCardTitle}>{t('onboarding.detailedMode') || 'Detailed Tour'}</div>
                <div className={styles.modeCardDesc}>
                  {t('onboarding.detailedModeDesc') || 'Explore every feature page-by-page with full explanations.'}
                </div>
                <div className={styles.modeCardHint}>
                  {t('onboarding.detailedModeHint') || '~3 minutes · Feature overview'}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'quick' && (
        <SpotlightOverlay step={quickStep} steps={quickSteps} onNext={handleQuickNext} onSkip={handleSkip} />
      )}

      {mode === 'detailed' && (
        <div className={styles.overlay}>
          <div className={styles.detailPanel}>
            <button className={styles.skipBtn} onClick={handleSkip}>
              {t('onboarding.skip') || 'Skip'}
            </button>

            <div className={styles.detailProgress}>
              {detailedSteps.map((_, i) => (
                <div
                  key={i}
                  className={`${styles.detailDot} ${
                    i < detailedStep
                      ? styles.detailDotDone
                      : i === detailedStep
                        ? styles.detailDotActive
                        : styles.detailDotPending
                  }`}
                />
              ))}
            </div>

            <div className={styles.detailTitle}>{detailedSteps[detailedStep].title}</div>
            <div className={styles.detailDesc}>{detailedSteps[detailedStep].description}</div>

            <div className={styles.detailHighlight}>
              <span className={styles.detailHighlightLabel}>
                {t('onboarding.detailHighlightLabel') || 'KEY FEATURES'}
              </span>
              <span className={styles.detailHighlightText}>{detailedSteps[detailedStep].highlight}</span>
            </div>

            <div className={styles.detailFooter}>
              <span className={styles.detailStepCount}>
                {detailedStep + 1} / {detailedSteps.length}
              </span>
              <button className={styles.detailNextBtn} onClick={handleDetailedNext}>
                {detailedStep >= detailedSteps.length - 1 ? (
                  t('onboarding.launch') || 'FINISH'
                ) : (
                  <>
                    {t('onboarding.next') || 'Next'} <Icon name="arrowRight" size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
