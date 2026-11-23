import React, { useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import type { GrafanaTheme2 } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { Button, Icon, Input, useStyles2 } from '@grafana/ui';
import type { Access } from '../access';
import { HomeLink } from '../components/HomeLink';
import { MenuPageTitle } from '../components/MenuPageTitle';
import { useMobileLayout } from '../components/useMobileLayout';
import { menu } from '../navigation/menu';
import { visibleChapters } from './guide/guideContent';
import { guideGroupOrder } from './guide/guideTypes';

const viewerFallback: Access = { manage_plugin: false, manage_access: false };

const getStyles = (theme: GrafanaTheme2) => ({
  page: css({
    maxWidth: 1180,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    margin: '0 auto',
    paddingBottom: 32,
    color: theme.colors.text.primary,
  }),
  topBar: css({
    marginBottom: 20,
  }),
  layout: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 270px) minmax(0, 1fr)',
    gap: 28,
    alignItems: 'start',
    width: '100%',
    minWidth: 0,
    '@media (max-width: 860px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: 16,
    },
  }),
  sidebar: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: 8,
    background: theme.colors.background.primary,
    padding: 14,
    display: 'grid',
    gap: 12,
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    position: 'sticky',
    top: 64,
    maxHeight: 'calc(100dvh - 80px)',
    overflowY: 'auto',
    '@media (max-width: 860px)': {
      position: 'static',
      maxHeight: 'none',
    },
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
  group: css({ display: 'grid', gap: 3, minWidth: 0 }),
  groupTitle: css({
    margin: '6px 6px 2px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: theme.colors.text.secondary,
  }),
  navItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    textAlign: 'left',
    padding: '7px 10px',
    border: '1px solid transparent',
    borderRadius: 6,
    background: 'transparent',
    color: theme.colors.text.primary,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    '& > svg': { flexShrink: 0, color: theme.colors.text.secondary },
    '& > span': { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    '&:hover': { background: theme.colors.action.hover },
    '&:focus-visible': { outline: `2px solid ${theme.colors.primary.main}`, outlineOffset: 1 },
  }),
  navItemActive: css({
    background: theme.colors.action.selected,
    borderColor: theme.colors.primary.border,
    fontWeight: 600,
    '& > svg': { color: theme.colors.primary.text },
  }),
  article: css({
    border: 'none',
    background: 'transparent',
    padding: '4px 8px 16px',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    '@media (max-width: 860px)': { padding: '4px 0 16px' },
  }),
  articleInner: css({
    maxWidth: 740,
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
    fontSize: 24,
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
    marginTop: 12,
    paddingTop: 16,
    borderTop: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  }),
  mobileDetails: css({
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: 8,
    background: theme.colors.background.primary,
    padding: '10px 14px',
    '& > summary': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 14,
      listStyle: 'none',
    },
    '& > summary::-webkit-details-marker': { display: 'none' },
  }),
  mobileTocBody: css({
    marginTop: 12,
    display: 'grid',
    gap: 10,
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  }),
  muted: css({ margin: 0, fontSize: 13, color: theme.colors.text.secondary }),
});

function readHashId(): string {
  return window.location.hash.replace(/^#/, '').trim();
}

export function GuidePage({ access = viewerFallback }: { access?: Access }) {
  const s = useStyles2(getStyles);
  const mobile = useMobileLayout();
  const chapters = useMemo(() => visibleChapters(access), [access]);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(() => {
    const requested = readHashId();
    return chapters.some((c) => c.id === requested) ? requested : (chapters[0]?.id ?? 'bevezetes');
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onHash = () => {
      const requested = readHashId();
      if (chapters.some((c) => c.id === requested)) {
        setActiveId(requested);
      } else if (chapters[0]) {
        setActiveId(chapters[0].id);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [chapters]);

  function selectChapter(id: string) {
    if (!chapters.some((c) => c.id === id)) {
      return;
    }
    setActiveId(id);
    setMobileMenuOpen(false);
    if (window.location.hash !== `#${id}`) {
      window.history.replaceState(null, '', `#${id}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const tocContent = (
    <>
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
                  className={`${s.navItem} ${selected ? s.navItemActive : ''}`}
                  onClick={() => selectChapter(item.id)}
                >
                  <Icon name={item.icon} aria-hidden="true" />
                  <span>{item.shortTitle}</span>
                </button>
              );
            })}
          </div>
        );
      })}
      {!filtered.length && <p className={s.muted}>Nincs a keresésnek megfelelő fejezet.</p>}
    </>
  );

  return (
    <PluginPage pageNav={menu.guide} renderTitle={() => null}>
      <div className={s.page}>
        <MenuPageTitle item={menu.guide} />
        <div className={s.topBar}>
          <HomeLink />
        </div>

        <div className={s.layout}>
          {mobile ? (
            <details
              className={s.mobileDetails}
              open={mobileMenuOpen}
              onToggle={(event) => setMobileMenuOpen(event.currentTarget.open)}
            >
              <summary>
                <span>Fejezetek: {current?.shortTitle}</span>
                <Icon name={mobileMenuOpen ? 'angle-down' : 'angle-right'} aria-hidden="true" />
              </summary>
              <div className={s.mobileTocBody}>{tocContent}</div>
            </details>
          ) : (
            <nav className={s.sidebar} aria-label="Használati útmutató tartalomjegyzék">
              {tocContent}
            </nav>
          )}

          {current && (
            <article className={s.article} aria-labelledby="guide-chapter-heading">
              <div className={s.articleInner}>
                <header className={s.articleHeader}>
                  <span className={s.articleKicker}>{current.group}</span>
                  <h2 id="guide-chapter-heading" className={s.articleTitle}>
                    <Icon name={current.icon} size="xl" aria-hidden="true" />
                    <span>{current.title}</span>
                  </h2>
                  <p className={s.articleSummary}>{current.summary}</p>
                </header>

                {current.render(access, selectChapter)}

                <nav className={s.pager} aria-label="Fejezetváltás">
                  <div>
                    {prev && (
                      <Button
                        type="button"
                        variant="secondary"
                        icon="arrow-left"
                        onClick={() => selectChapter(prev.id)}
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
                        onClick={() => selectChapter(next.id)}
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
      </div>
    </PluginPage>
  );
}
