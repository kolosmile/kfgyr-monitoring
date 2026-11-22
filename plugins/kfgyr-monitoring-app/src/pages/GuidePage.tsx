import React, { useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import type { GrafanaTheme2 } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import { Badge, Button, Icon, Input, useStyles2 } from '@grafana/ui';
import type { Access } from '../access';
import { HomeLink } from '../components/HomeLink';
import { MenuPageTitle } from '../components/MenuPageTitle';
import { useMobileLayout } from '../components/useMobileLayout';
import { menu } from '../navigation/menu';
import { visibleChapters } from './guide/guideContent';
import { currentRoleLabel, guideGroupOrder } from './guide/guideTypes';

const viewerFallback: Access = { manage_plugin: false, manage_access: false };

const getStyles = (theme: GrafanaTheme2) => ({
  page: css({ maxWidth: 1180, margin: '0 auto', paddingBottom: 32, color: theme.colors.text.primary }),
  topBar: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  }),
  layout: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(240px, 280px) minmax(0, 1fr)',
    gap: 20,
    alignItems: 'start',
    '@media (max-width: 860px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
      gap: 14,
    },
  }),
  sidebar: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: 8,
    background: theme.colors.background.primary,
    padding: 14,
    display: 'grid',
    gap: 12,
    position: 'sticky',
    top: 16,
    maxHeight: 'calc(100dvh - 48px)',
    overflowY: 'auto',
    '@media (max-width: 860px)': {
      position: 'static',
      maxHeight: 'none',
    },
  }),
  group: css({ display: 'grid', gap: 4 }),
  groupTitle: css({
    margin: '4px 4px 2px',
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
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: 8,
    background: theme.colors.background.primary,
    padding: '24px 28px',
    minWidth: 0,
    '@media (max-width: 600px)': { padding: '18px 16px' },
  }),
  articleInner: css({
    maxWidth: 780,
    display: 'grid',
    gap: 16,
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

  const currentIndex = Math.max(0, chapters.findIndex((c) => c.id === activeId));
  const current = chapters[currentIndex] ?? chapters[0];
  const prev = currentIndex > 0 ? chapters[currentIndex - 1] : undefined;
  const next = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : undefined;

  const tocContent = (
    <>
      <Input
        aria-label="Keresés az útmutatóban"
        placeholder="Keresés a fejezetekben…"
        prefix={<Icon name="search" />}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />
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
          <Badge color="blue" text={`Szerepkör: ${currentRoleLabel(access)}`} />
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
