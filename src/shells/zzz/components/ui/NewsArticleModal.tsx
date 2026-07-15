import React, { useEffect, useCallback, useState } from 'react';
import { api, type MinecraftArticle } from '../../../../shared/api';
import { useI18n } from '../../../../shared/i18n';
import { formatError } from '../../../../shared/utils/errorMapping';
import { Icon } from './Icon';
import styles from './NewsArticleModal.module.css';

interface NewsArticleModalProps {
  open: boolean;
  onClose: () => void;
  articleUrl: string;
  articleTitle?: string;
  articleImageUrl?: string | null;
}

export const NewsArticleModal: React.FC<NewsArticleModalProps> = ({
  open,
  onClose,
  articleUrl,
  articleTitle: _articleTitle,
  articleImageUrl,
}) => {
  const { t } = useI18n();
  const [article, setArticle] = useState<MinecraftArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setArticle(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    api
      .getMinecraftArticle(articleUrl)
      .then((data) => {
        setArticle(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(formatError(e));
        setLoading(false);
      });
  }, [open, articleUrl]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const headerImage = article?.header_image || articleImageUrl;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label={t('newsArticle.closeAriaLabel')}>
          <Icon name="cross" size={14} />
        </button>

        {loading && (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner} />
            <span>{t('news.loading')}</span>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <div className={styles.errorTitle}>{t('news.loadFailed')}</div>
            <div className={styles.errorMsg}>{error}</div>
          </div>
        )}

        {!loading && !error && article && (
          <div className={styles.content}>
            {headerImage && (
              <div className={styles.heroImage}>
                <img src={headerImage} alt={article.title} loading="lazy" decoding="async" />
                <div className={styles.heroGradient} />
              </div>
            )}

            <div className={styles.articleHeader}>
              <div className={styles.metaRow}>
                {article.author && <span className={styles.metaItem}>{article.author}</span>}
                {article.date && (
                  <>
                    {article.author && <span className={styles.metaSep}>·</span>}
                    <span className={styles.metaItem}>{article.date}</span>
                  </>
                )}
              </div>
              <h1 className={styles.title}>{article.title}</h1>
              {article.subtitle && <p className={styles.subtitle}>{article.subtitle}</p>}
            </div>

            <div className={styles.body}>
              {article.sections.map((section, si) => (
                <div key={si} className={styles.section}>
                  {section.heading && <h2 className={styles.sectionHeading}>{section.heading}</h2>}
                  {section.paragraphs.map((p, pi) => (
                    <p key={pi} className={styles.paragraph}>
                      {p}
                    </p>
                  ))}
                  {section.list_items.length > 0 && (
                    <ul className={styles.list}>
                      {section.list_items.map((item, li) => (
                        <li key={li} className={styles.listItem}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.images.map((img, ii) => (
                    <figure key={ii} className={styles.figure}>
                      <img
                        src={img.url}
                        alt={img.caption || ''}
                        className={styles.sectionImage}
                        loading="lazy"
                        decoding="async"
                      />
                      {img.caption && <figcaption className={styles.figcaption}>{img.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
