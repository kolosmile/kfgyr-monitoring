import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import type { GrafanaTheme2 } from '@grafana/data';
import { Button, Icon, Input, Modal, Spinner, useStyles2 } from '@grafana/ui';
import { Access, useAccess } from '../access';
import { visibleChapters } from '../pages/guide/guideContent';
import { guideGroupOrder } from '../pages/guide/guideTypes';

type GuideModalProps = {
  isOpen: boolean;
  onDismiss: () => void;
  initialChapter?: string;
  access?: Access;
};

type GuideView = 'toc' | 'chapter';

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: 'min(800px, calc(100vw - 24px))',
    maxWidth: 'calc(100vw - 24px)',
    height: 'min(82dvh, 760px)',
    maxHeight: 'calc(100dvh - 32px)',
    top: '50%',
    transform: 'translateY(-50%)',
  }),
  modalContent: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'hidden',
    padding: theme.spacing(1.5, 3, 0, 3),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1, 2, 0, 2),
      marginBottom: theme.spacing(1.5),
    },
  }),
  loading: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flex: '1 1 auto',
    color: theme.colors.text.secondary,
  }),
  toolbar: css({
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  tabBtn: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '7px 14px',
    borderRadius: theme.shape.radius.default,
    border: '1px solid transparent',
    background: 'transparent',
    color: theme.colors.text.secondary,
    fontSize: 13.5,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    '& > svg': { flexShrink: 0 },
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: 1,
    },
  }),
  tabBtnActive: css({
    background: theme.colors.action.selected,
    borderColor: theme.colors.primary.border,
    color: theme.colors.text.primary,
    fontWeight: 600,
    '& > svg': { color: theme.colors.primary.text },
  }),
  scrollBody: css({
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: 4,
    paddingBottom: 12,
  }),
  tocWrap: css({
    display: 'grid',
    gap: 14,
    minWidth: 0,
  }),
  searchWrap: css({
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    '& input': {
      minWidth: 0,
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
    },
  }),
  group: css({
    display: 'grid',
    gap: 4,
    minWidth: 0,
  }),
  groupTitle: css({
    margin: '4px 6px 2px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: theme.colors.text.secondary,
  }),
  tocItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    textAlign: 'left',
    padding: '10px 12px',
    border: '1px solid transparent',
    borderRadius: 6,
    background: 'transparent',
    color: theme.colors.text.primary,
    fontFamily: 'inherit',
    cursor: 'pointer',
    '& > svg:first-child': { flexShrink: 0, color: theme.colors.text.secondary },
    '&:hover': { background: theme.colors.action.hover },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: 1,
    },
  }),
  tocItemActive: css({
    background: theme.colors.action.selected,
    borderColor: theme.colors.primary.border,
    '& > svg:first-child': { color: theme.colors.primary.text },
  }),
  tocItemText: css({
    flex: '1 1 auto',
    minWidth: 0,
    display: 'grid',
    gap: 2,
  }),
  tocItemTitle: css({
    fontSize: 13.5,
    fontWeight: 600,
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
  }),
  tocItemSummary: css({
    fontSize: 12.5,
    lineHeight: 1.4,
    color: theme.colors.text.secondary,
    overflowWrap: 'anywhere',
  }),
  tocArrow: css({
    flexShrink: 0,
    marginLeft: 'auto',
    color: theme.colors.text.secondary,
  }),
  article: css({
    border: 'none',
    background: 'transparent',
    padding: '4px 2px 8px',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  }),
  articleInner: css({
    minWidth: 0,
    maxWidth: '100%',
    display: 'grid',
    gap: 18,
  }),
  articleHeader: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    paddingBottom: 14,
    display: 'grid',
    gap: 6,
  }),
  articleKicker: css({
    fontSize: 12,
    fontWeight: 600,
    color: theme.colors.text.secondary,
  }),
  articleTitle: css({
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 22,
    lineHeight: 1.25,
    fontWeight: 700,
    '& > svg': { color: theme.colors.primary.text, flexShrink: 0 },
  }),
  articleSummary: css({
    margin: 0,
    color: theme.colors.text.secondary,
    fontSize: 14,
  }),
  pager: css({
    marginTop: 8,
    paddingTop: 16,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  }),
  muted: css({
    margin: 0,
    fontSize: 13,
    color: theme.colors.text.secondary,
  }),
});

function GuideModalInner({
  access,
  initialChapter,
  onDismiss,
}: {
  access: Access;
  initialChapter?: string;
  onDismiss: () => void;
}) {
  const s = useStyles2(getStyles);
  const chapters = useMemo(() => visibleChapters(access), [access]);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(() =>
    initialChapter && chapters.some((c) => c.id === initialChapter)
      ? initialChapter
      : (chapters[0]?.id ?? 'bevezetes')
  );
  const [view, setView] = useState<GuideView>(() =>
    initialChapter && chapters.some((c) => c.id === initialChapter) ? 'chapter' : 'toc'
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view, activeId]);

  function openChapter(id: string) {
    if (!chapters.some((c) => c.id === id)) {
      return;
    }
    setActiveId(id);
    setView('chapter');
  }

  function switchView(next: GuideView) {
    setView(next);
  }

  const normalized = query.trim().toLocaleLowerCase('hu');
  const filtered = useMemo(() => {
    if (!normalized) {
      return chapters;
    }
    return chapters.filter((chapter) =>
      `${chapter.title} ${chapter.shortTitle} ${chapter.summary} ${chapter.keywords.join(' ')}`
        .toLocaleLowerCase('hu')
        .includes(normalized)
    );
  }, [chapters, normalized]);

  const matchedIndex = chapters.findIndex((c) => c.id === activeId);
  const currentIndex = matchedIndex >= 0 ? matchedIndex : 0;
  const current = chapters[currentIndex] ?? chapters[0];
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : undefined;
  const next = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : undefined;

  return (
    <Modal
      title="Használati útmutató"
      isOpen
      onDismiss={onDismiss}
      className={s.modal}
      contentClassName={s.modalContent}
    >
      <div className={s.toolbar} role="navigation" aria-label="Útmutató nézetválasztó">
        <button
          type="button"
          aria-pressed={view === 'toc'}
          className={cx(s.tabBtn, view === 'toc' && s.tabBtnActive)}
          onClick={() => switchView('toc')}
        >
          <Icon name="list-ul" aria-hidden="true" />
          <span>Tartalomjegyzék</span>
        </button>
        <button
          type="button"
          aria-pressed={view === 'chapter'}
          className={cx(s.tabBtn, view === 'chapter' && s.tabBtnActive)}
          onClick={() => switchView('chapter')}
        >
          <Icon name="book-open" aria-hidden="true" />
          <span>Fejezet</span>
        </button>
      </div>

      <div ref={scrollRef} className={s.scrollBody}>
        {view === 'toc' && (
          <div className={s.tocWrap}>
            <div className={s.searchWrap}>
              <Input
                aria-label="Keresés az útmutatóban"
                placeholder="Keresés a fejezetekben…"
                prefix={<Icon name="search" />}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>

            {guideGroupOrder.map((group) => {
              const items = filtered.filter((c) => c.group === group);
              if (!items.length) {
                return null;
              }
              return (
                <div key={group} className={s.group}>
                  <div className={s.groupTitle}>{group}</div>
                  {items.map((item) => {
                    const selected = item.id === current?.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={selected ? 'page' : undefined}
                        className={cx(s.tocItem, selected && s.tocItemActive)}
                        onClick={() => openChapter(item.id)}
                      >
                        <Icon name={item.icon} aria-hidden="true" />
                        <span className={s.tocItemText}>
                          <span className={s.tocItemTitle}>{item.shortTitle}</span>
                          <span className={s.tocItemSummary}>{item.summary}</span>
                        </span>
                        <Icon name="angle-right" className={s.tocArrow} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {!filtered.length && <p className={s.muted}>Nincs a keresésnek megfelelő fejezet.</p>}
          </div>
        )}

        {view === 'chapter' && current && (
          <article className={s.article} aria-labelledby="guide-modal-chapter-heading">
            <div className={s.articleInner}>
              <header className={s.articleHeader}>
                <span className={s.articleKicker}>{current.group}</span>
                <h2 id="guide-modal-chapter-heading" className={s.articleTitle}>
                  <Icon name={current.icon} size="xl" aria-hidden="true" />
                  <span>{current.title}</span>
                </h2>
                <p className={s.articleSummary}>{current.summary}</p>
              </header>

              {current.render(access, openChapter)}

              <nav className={s.pager} aria-label="Fejezetváltás">
                <div>
                  {prev && (
                    <Button
                      type="button"
                      variant="secondary"
                      icon="arrow-left"
                      onClick={() => openChapter(prev.id)}
                    >
                      {prev.shortTitle}
                    </Button>
                  )}
                </div>
                <div>
                  {next && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => openChapter(next.id)}
                    >
                      {next.shortTitle} <Icon name="arrow-right" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </nav>
            </div>
          </article>
        )}
      </div>
    </Modal>
  );
}

function GuideModalWithAccess({
  initialChapter,
  onDismiss,
}: {
  initialChapter?: string;
  onDismiss: () => void;
}) {
  const s = useStyles2(getStyles);
  const { access } = useAccess();
  if (!access) {
    return (
      <Modal
        title="Használati útmutató"
        isOpen
        onDismiss={onDismiss}
        className={s.modal}
        contentClassName={s.modalContent}
      >
        <div className={s.loading} role="status">
          <Spinner /> Betöltés…
        </div>
      </Modal>
    );
  }
  return <GuideModalInner access={access} initialChapter={initialChapter} onDismiss={onDismiss} />;
}

export function GuideModal({ isOpen, onDismiss, initialChapter, access }: GuideModalProps) {
  if (!isOpen) {
    return null;
  }
  if (access !== undefined) {
    return <GuideModalInner access={access} initialChapter={initialChapter} onDismiss={onDismiss} />;
  }
  return <GuideModalWithAccess initialChapter={initialChapter} onDismiss={onDismiss} />;
}
