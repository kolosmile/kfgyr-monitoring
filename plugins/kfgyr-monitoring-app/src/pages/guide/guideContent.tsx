import React from 'react';
import { css } from '@emotion/css';
import type { GrafanaTheme2, IconName } from '@grafana/data';
import { Badge, Icon, useStyles2 } from '@grafana/ui';
import type { Access } from '../../access';
import { canSeeRole, GuideChapter } from './guideTypes';

const getStyles = (theme: GrafanaTheme2) => ({
  body: css({
    display: 'grid',
    gap: 16,
    lineHeight: 1.68,
    fontSize: 14,
    '& h3': { margin: '22px 0 4px', fontSize: 17, fontWeight: 600 },
    '& p': { margin: 0 },
    '& ul, & ol': { margin: 0, paddingLeft: 20, display: 'grid', gap: 8 },
  }),
  uiTag: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '1px 7px',
    borderRadius: 4,
    border: `1px solid ${theme.colors.border.medium}`,
    background: theme.colors.background.secondary,
    fontSize: 12.5,
    fontWeight: 600,
    lineHeight: 1.45,
    verticalAlign: 'baseline',
    whiteSpace: 'nowrap',
    '& > svg': { color: theme.colors.text.secondary },
  }),
  badgeRow: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    margin: '2px 0',
  }),
  callout: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
    padding: '10px 14px',
    borderRadius: 6,
    background: theme.colors.background.secondary,
    fontSize: 13,
    lineHeight: 1.55,
  }),
  calloutTip: css({ borderLeft: `3px solid ${theme.colors.success.border}` }),
  calloutNote: css({ borderLeft: `3px solid ${theme.colors.info.border}` }),
  calloutWarn: css({ borderLeft: `3px solid ${theme.colors.warning.border}` }),
  calloutIconTip: css({ color: theme.colors.success.text, flexShrink: 0, marginTop: 2 }),
  calloutIconNote: css({ color: theme.colors.info.text, flexShrink: 0, marginTop: 2 }),
  calloutIconWarn: css({ color: theme.colors.warning.text, flexShrink: 0, marginTop: 2 }),
  tableWrap: css({ overflowX: 'auto' }),
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13.5,
    '& th, & td': {
      textAlign: 'left',
      padding: '9px 12px',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      verticalAlign: 'top',
    },
    '& th': { fontWeight: 600, color: theme.colors.text.secondary, fontSize: 12.5 },
  }),
  linkBtn: css({
    background: 'none',
    border: 'none',
    padding: 0,
    color: theme.colors.text.link,
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'underline',
    '&:hover': { opacity: 0.85 },
  }),
  taskBlock: css({
    paddingBottom: 16,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    display: 'grid',
    gap: 8,
    '&:last-child': { borderBottom: 'none', paddingBottom: 0 },
    '& h4': { margin: 0, fontSize: 15.5, fontWeight: 600 },
  }),
});

function UiTag({ icon, label }: { icon?: IconName; label: string }) {
  const s = useStyles2(getStyles);
  return (
    <span className={s.uiTag}>
      {icon && <Icon name={icon} size="xs" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}

function Callout({ kind, title, children }: { kind: 'tip' | 'note' | 'warning'; title: string; children: React.ReactNode }) {
  const s = useStyles2(getStyles);
  const box = kind === 'tip' ? s.calloutTip : kind === 'warning' ? s.calloutWarn : s.calloutNote;
  const iconStyle = kind === 'tip' ? s.calloutIconTip : kind === 'warning' ? s.calloutIconWarn : s.calloutIconNote;
  const icon = kind === 'tip' ? 'check-circle' : kind === 'warning' ? 'exclamation-triangle' : 'info-circle';
  return (
    <aside className={`${s.callout} ${box}`} aria-label={title}>
      <Icon name={icon} className={iconStyle} aria-hidden="true" />
      <div>
        <strong>{title}: </strong>
        {children}
      </div>
    </aside>
  );
}

function ChapterLink({ id, label, goTo }: { id: string; label: string; goTo: (id: string) => void }) {
  const s = useStyles2(getStyles);
  return (
    <button type="button" className={s.linkBtn} onClick={() => goTo(id)}>
      {label}
    </button>
  );
}

function IntroSection({ access, goTo }: { access: Access; goTo: (id: string) => void }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        A <strong>KFGyR Monitoring</strong> felületen a gyártórendszer gépeinek aktuális állapotát, mért értékeit és
        múltbeli adatait követheted egy helyen, asztali böngészőből és telefonról is.
      </p>

      <h3>Oldalak áttekintése</h3>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Oldal</th>
              <th>Mire használható?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><ChapterLink id="geppark" label="Géppark" goTo={goTo} /></td>
              <td>Az összes gép főbb állapotainak és műszereinek gyors áttekintése egy képernyőn.</td>
            </tr>
            <tr>
              <td><ChapterLink id="monitoring" label="Monitoring" goTo={goTo} /></td>
              <td>Egy kiválasztott gép élő és visszakereshető nézete grafikonokkal, állapotokkal és adatpont-listával.</td>
            </tr>
            <tr>
              <td><ChapterLink id="adatexport" label="Adatexport" goTo={goTo} /></td>
              <td>Kiválasztott gépek és jelek mentése CSV vagy Excelhez formázott táblázatba.</td>
            </tr>
            {access.manage_plugin && (
              <>
                <tr>
                  <td><ChapterLink id="agentek" label="Agentek és gépek" goTo={goTo} /></td>
                  <td>Új gépek megkeresése a hálózaton, kapcsolatok felvétele, elnevezés és sémaválasztás.</td>
                </tr>
                <tr>
                  <td><ChapterLink id="jelkatalogus" label="Jelkatalógus" goTo={goTo} /></td>
                  <td>Közös magyar jelnevek, gépcsalád-sémák és megjelenítési mértékegységek kezelése.</td>
                </tr>
                <tr>
                  <td><ChapterLink id="dashboard-szerkeszto" label="Dashboard szerkesztő" goTo={goTo} /></td>
                  <td>Gépenkénti nézetek összeállítása, panelek hozzáadása és sorrendezése.</td>
                </tr>
              </>
            )}
            {access.manage_access && (
              <tr>
                <td><ChapterLink id="jogosultsagok" label="Jogosultságkezelés" goTo={goTo} /></td>
                <td>Kezelői csapat tagjainak felvétele vagy eltávolítása és a kapcsolat ellenőrzése.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Callout kind="tip" title="Gyors keresés">
        A mindennapi műveletekhez összefoglalt lépéssorokat a{' '}
        <ChapterLink id="gyakori-feladatok" label="Gyakori feladatok" goTo={goTo} /> fejezetben találod.
      </Callout>
    </div>
  );
}

function HomeSection({ access }: { access: Access }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        A <strong>KFGyR · Kezdőlap</strong> a rendszer központi kiindulópontja: az elérhető nézeteket és beállítási
        oldalakat kártyákba csoportosítva jeleníti meg.
      </p>

      <h3>A főmenü csoportjai</h3>
      <ul>
        <li>
          <strong>Eszközök:</strong> innen nyitható a <UiTag icon="chart-line" label="Monitoring" />, a{' '}
          <UiTag icon="apps" label="Géppark" /> és az <UiTag icon="download-alt" label="Adatexport" />.
        </li>
        {access.manage_plugin && (
          <li>
            <strong>Beállítások:</strong> az <UiTag icon="plug" label="Agentek és gépek" />, a{' '}
            <UiTag icon="sliders-v-alt" label="Dashboard szerkesztő" />, a{' '}
            <UiTag icon="sitemap" label="Jelkatalógus" />
            {access.manage_access ? (
              <>
                {' '}és a <UiTag icon="users-alt" label="Jogosultságkezelés" /> oldal.
              </>
            ) : (
              '.'
            )}
          </li>
        )}
        <li>
          <strong>Dokumentáció:</strong> megnyitja a <UiTag icon="book-open" label="Használati útmutató" /> oldalt.
        </li>
      </ul>

      <h3>Visszalépés a főmenüre</h3>
      <p>
        Minden belső oldal és a Monitoring tetején megtalálod a <UiTag icon="home-alt" label="Kezdőlap" /> gombot,
        amellyel bármikor visszatérhetsz ide.
      </p>

      {access.manage_plugin && (
        <Callout kind="note" title="Nem mentett módosítások">
          Ha az <strong>Agentek és gépek</strong> vagy a <strong>Dashboard szerkesztő</strong> oldalon elkezdett
          módosításod van, a böngésző figyelmeztet, mielőtt elhagynád az oldalt.
        </Callout>
      )}
    </div>
  );
}

function FleetSection({ goTo }: { goTo: (id: string) => void }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        A <strong>Géppark</strong> oldal rácsban, gépkártyákon mutatja az összes bekötött gép aktuális állapotát és
        legfontosabb mérőszámait — hasznos például műhelyi kijelzőn vagy gyors ellenőrzéshez.
      </p>

      <h3>Egy gépkártya felépítése</h3>
      <ul>
        <li>Felül az adatgyűjtő (<Badge color="blue" text="Agent" />) és a gép neve látható.</li>
        <li>
          A kártya jobb felső sarkában lévő <UiTag icon="external-link-alt" label="Megnyitás a Monitoringban" /> ikonra
          kattintva rögtön az adott gép részletes oldalára ugorhatsz.
        </li>
        <li>A középső rész legfeljebb 6 állapotot, az alsó sor legfeljebb 3 félköríves műszert mutat a gép alapértelmezett dashboardjáról.</li>
      </ul>

      <h3>Állapotok színjelzése</h3>
      <div className={s.badgeRow}>
        <Badge color="green" text="AVAILABLE / ACTIVE / NORMAL — rendben" />
        <Badge color="orange" text="WARNING — figyelmeztetés" />
        <Badge color="red" text="UNAVAILABLE / FAULT / ALARM — hiba vagy nem elérhető" />
      </div>

      <Callout kind="tip" title="Részletes trendek">
        Múltbeli grafikonokhoz és a teljes adatpont-listához nyisd meg a{' '}
        <ChapterLink id="monitoring" label="Monitoring" goTo={goTo} /> oldalt.
      </Callout>
    </div>
  );
}

function MonitoringSection({ access }: { access: Access }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        A <strong>KFGyR · Monitoring</strong> egy kiválasztott gép részletes, élő és visszakereshető nézete.
        Alapértelmezésben az elmúlt 5 percet mutatja, és 5 másodpercenként frissül.
      </p>

      <h3>Gép és dashboard kiválasztása</h3>
      <ol>
        <li>A felső navigációs sávban válassz <strong>Agent</strong>-et, majd <strong>Gép</strong>-et.</li>
        <li>Ha a géphez több nézet is készült, a <strong>Dashboard</strong> választóban válthatsz közöttük.</li>
        <li>Mobilon a felső választógombbal nyitható meg a gép- és dashboard-lista.</li>
      </ol>

      <h3>Agent-elérhetőség jelzése</h3>
      <div className={s.badgeRow}>
        <Badge color="green" text="Agent elérhető" />
        <Badge color="red" text="Agent nem elérhető" />
        <Badge color="darkgrey" text="Agent elérhetősége ismeretlen" />
      </div>
      <p>
        A felső jelvény azt mutatja, hogy a gép adatforrása válaszol-e jelenleg a hálózaton (kikapcsolt vagy lekapcsolt
        gépnél piros jelzés jelenik meg).
      </p>

      <h3>Időszak és paneltípusok</h3>
      <ul>
        <li>A jobb felső időválasztóval bármilyen korábbi időszakra visszanézhetsz, és az automatikus frissítés is itt állítható.</li>
        <li><strong>Állapot:</strong> nagy szöveges kártya; ha engedélyezve van, alatta színes idővonal mutatja az állapotváltásokat.</li>
        <li><strong>Aktuális érték:</strong> az utoljára mért számérték a beállított mértékegységgel.</li>
        <li><strong>Műszer:</strong> félköríves skála a megadott minimum és maximum tartományban.</li>
        <li><strong>Grafikon:</strong> idősoros görbe a kiválasztott időablakra.</li>
        <li>
          <strong>Gyors adatpontnézegető:</strong> a lap alján lévő kereshető táblázat a gép összes adatpontjának
          utolsó, az időablakon belüli értékét sorolja fel.
        </li>
      </ul>

      {access.manage_plugin && (
        <Callout kind="tip" title="Közvetlen szerkesztés">
          A felső sávban lévő <UiTag icon="pen" label="Dashboard szerkesztése" /> (vagy új gépnél{' '}
          <UiTag icon="plus" label="Dashboard hozzáadása" />) gombbal közvetlenül az aktuális gép paneljeinek
          szerkesztőjébe léphetsz.
        </Callout>
      )}
    </div>
  );
}

function ExportSection() {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        Az <strong>Adatexport</strong> oldalon táblázatos CSV-fájlként töltheted le a gépek korábbi méréseit saját
        elemzéshez vagy Excel-táblázathoz.
      </p>

      <h3>Letöltés lépései</h3>
      <ol>
        <li>A <strong>Gépek</strong> listában válassz ki egy vagy több gépet (gépeléssel szűrhetsz).</li>
        <li>
          Az <strong>Adatpontok</strong> mezőben jelöld ki a kívánt jeleket, vagy használd az{' '}
          <UiTag label="Összes adatpont kijelölése" /> gombot.
        </li>
        <li>Add meg a <strong>Kezdőidő</strong>-t és a <strong>Végidő</strong>-t a saját helyi időzónádban.</li>
        <li>
          Válassz <strong>Sorkorlát</strong>-ot (legfeljebb 100 000 sor) és <strong>Formátum</strong>-ot:
          <ul>
            <li><strong>CSV (vesszővel):</strong> általános adatfeldolgozáshoz.</li>
            <li><strong>Excelhez formázott CSV (pontosvesszővel):</strong> magyar Excelben közvetlenül oszlopokra bontva nyílik meg.</li>
          </ul>
        </li>
        <li>Kattints a <UiTag icon="download-alt" label="CSV letöltése" /> gombra.</li>
      </ol>

      <Callout kind="note" title="Időbélyegek és részleges export">
        A letöltött fájlban az időbélyegek UTC-ben szerepelnek. Ha a kért időszak több sort tartalmaz a sorkorlátnál, a
        felület jelzi, hogy <strong>részleges export</strong> készült (az időben első N sorral); ilyenkor bontsd kisebb
        időszakokra a letöltést.
      </Callout>
    </div>
  );
}

function AgentsSection({ goTo }: { goTo: (id: string) => void }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        Az <strong>Agentek és gépek</strong> oldalon kötheted be a gépek adatgyűjtő kapcsolatait (agenteket), adhatsz
        megjelenítési nevet a gépeknek, és itt szüneteltetheted a gyűjtést.
      </p>

      <h3>Új agent és gép felvétele</h3>
      <ol>
        <li>
          <strong>Automatikusan:</strong> kattints a <UiTag icon="search" label="Hálózati keresés" /> gombra, válaszd ki
          a helyi hálózatot, majd a talált eszköznél nyomd meg az <UiTag label="Agent beállítása" /> gombot.
        </li>
        <li>
          <strong>Kézzel:</strong> kattints az <UiTag icon="plus" label="Agent hozzáadása" /> gombra, és add meg az
          egyedi nevet, valamint az agent hálózati címét (URL / IP és port).
        </li>
        <li>Használd a <UiTag icon="search" label="Kapcsolat és eszközkeresés" /> gombot a gépek lekérdezéséhez.</li>
        <li>Minden megtalált gépnél adj meg egy <strong>Megjelenítési név</strong>-et, és válassz egy <strong>Séma</strong>-t.</li>
        <li>Kattints a <UiTag icon="check" label="Hozzáadás a listához" /> gombra.</li>
        <li>Végül a lap alján megjelenő sávban kattints a <UiTag label="Mentés és alkalmazás" /> gombra.</li>
      </ol>

      <Callout kind="warning" title="Kötelező sémaválasztás">
        Gép csak kiválasztott sémával menthető. Ha még nincs megfelelő sémád, előbb hozd létre a{' '}
        <ChapterLink id="jelkatalogus" label="Jelkatalógus" goTo={goTo} /> oldalon.
      </Callout>

      <h3>Szüneteltetés, elvetés és visszaállítás</h3>
      <ul>
        <li>
          <strong>Szüneteltetés:</strong> a <UiTag icon="pen" label="Szerkesztés" /> ablakban kapcsold ki az{' '}
          <strong>Agent engedélyezve</strong> kapcsolót, majd ments. A már tárolt múltbeli adatok megmaradnak.
        </li>
        <li>
          <strong>Elvetés:</strong> mentés előtt az alsó sávban az <UiTag label="Elvetés" /> gombbal visszavonhatod a
          helyi módosításokat.
        </li>
        <li>
          <strong>Visszaállítás hiba esetén:</strong> ha az alkalmazás után a felső állapotsáv hibát jelez, a{' '}
          <UiTag label="Visszaállítás a futó konfigurációra" /> gombbal visszatérhetsz a korábbi működő állapothoz.
        </li>
      </ul>

      <Callout kind="note" title="Rövid szünet és rögzített azonosítók">
        A <strong>Mentés és alkalmazás</strong> újraindítja az adatgyűjtőt, ami néhány másodperces szünettel járhat. A
        már mentett agent- és gépazonosítók a történeti adatok védelme érdekében később nem írhatók át.
      </Callout>
    </div>
  );
}

function CatalogSection() {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        Különböző géptípusok ugyanazt a mérést (például a főorsó fordulatszámát) eltérő belső útvonalon küldhetik. A{' '}
        <strong>Jelkatalógus</strong> két fogalommal egységesíti ezt:
      </p>
      <ul>
        <li><strong>Jel:</strong> egységes magyar név és mértékegység, amely a dashboardokon megjelenik.</li>
        <li><strong>Séma:</strong> egy gépcsaládhoz tartozó „szótár”, amely az egyes jelekhez hozzárendeli a gép belső adatpont-útvonalát.</li>
      </ul>

      <h3>Séma létrehozása vagy másolása</h3>
      <ol>
        <li>A jobb oldali <strong>Sémák</strong> panelen kattints az <UiTag icon="plus" label="Új séma" /> gombra.</li>
        <li>Add meg a séma nevét, majd a <strong>Kiindulás</strong> mezőben válassz üres sémát vagy egy meglévő séma másolását.</li>
        <li>Kattints a <UiTag label="Létrehozás" /> gombra.</li>
      </ol>

      <h3>Jelek és adatpontok összekötése</h3>
      <ol>
        <li>
          <strong>Új jel beolvasott gépből:</strong> válaszd az <UiTag icon="plus" label="Új jel gépadatpontból" /> gombot,
          jelöld ki a gépet és az adatpontot; a rendszer automatikusan javasol nevet, azonosítót és egységet.
        </li>
        <li>
          <strong>Kézi felvétel:</strong> a <UiTag icon="plus" label="Jel hozzáadása" /> gombbal előre is felvehetsz
          közös jeleket. (A <strong>Jelazonosító</strong> létrehozás után nem módosítható.)
        </li>
        <li>
          <strong>Összekötés a sémában:</strong> a jel sorának jobb oldalán kattints az{' '}
          <UiTag icon="plus" label="Adatpont hozzárendelése" /> gombra, és válassz a gép adatpontjai közül (vagy adj meg
          <code>/</code>-rel kezdődő útvonalat).
        </li>
      </ol>

      <h3>Színjelölés és megjelenítési mértékegységek</h3>
      <ul>
        <li>A jelnevek és útvonalak színe a gép funkcionális ágát jelöli (például tengelyek, vezérlő, rendszerek).</li>
        <li>
          A <UiTag icon="calculator-alt" label="Megjelenítési mértékegységek" /> ablakban a gép nyers kódjaihoz (pl.{' '}
          <code>REVOLUTION/MINUTE</code>) megadhatsz rövid, olvasható feliratot (pl. <code>rpm</code>).
        </li>
      </ul>

      <Callout kind="warning" title="Védett törlés és eltérő mértékegység">
        Eltérő mértékegységű adatpont hozzárendelésekor a rendszer figyelmeztet, és nem írja felül a jel mentett
        egységét. Sémában vagy dashboardon használt jel, illetve géphez rendelt séma nem törölhető a hivatkozások
        eltávolításáig.
      </Callout>
    </div>
  );
}

function EditorSection() {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        A <strong>Dashboard szerkesztő</strong> oldalon állíthatod össze a gépek Monitoring nézeteit. Egy géphez több
        önálló dashboard is készíthető.
      </p>

      <h3>Dashboard létrehozása vagy másolása</h3>
      <ol>
        <li>Válaszd ki a gépet a listából, majd kattints a <UiTag icon="plus" label="Dashboard hozzáadása" /> gombra.</li>
        <li>Adj meg nevet, és a <strong>Kiindulás</strong> listában válassz üres dashboardot vagy egy azonos sémájú gép meglévő dashboardját.</li>
      </ol>

      <h3>Panelek beállítása és mentése</h3>
      <ol>
        <li>Nyisd le a kívánt nézetcsoportot (<strong>Állapot</strong>, <strong>Aktuális érték</strong>, <strong>Műszer</strong> vagy <strong>Grafikon</strong>), és kattints a <UiTag icon="plus" label="Panel hozzáadása" /> kártyára.</li>
        <li>Válassz egy jelet a <strong>Jel a katalógusból</strong> listából, és igény szerint adj neki egyedi nevet.</li>
        <li>
          Állítsd be a nézet opcióit:
          <ul>
            <li><strong>Állapot:</strong> bekapcsolható az <strong>Állapotidősor megjelenítése</strong> színes idővonala.</li>
            <li><strong>Műszer:</strong> kötelező megadni a <strong>Minimum</strong> és <strong>Maximum</strong> értéket.</li>
            <li><strong>Grafikon:</strong> választható <strong>Vonalszín</strong>.</li>
          </ul>
        </li>
        <li>A <UiTag label="Módosítások átvétele" /> után a kártyák nyilaival rendezheted a panelek sorrendjét.</li>
        <li>Mentsd a <UiTag icon="save" label="Dashboard mentése" /> gombbal; az eredményt a <UiTag icon="chart-line" label="Monitoring megnyitása" /> gombbal nézheted meg.</li>
      </ol>

      <Callout kind="tip" title="Folyamatos adatgyűjtés">
        A dashboardok mentése, átnevezése vagy törlése azonnali, és nem állítja meg az adatgyűjtést.
      </Callout>
    </div>
  );
}

function AccessSection() {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>A rendszer három jogosultsági szintet különböztet meg:</p>

      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Szerepkör</th>
              <th>Elérhető funkciók</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Megtekintő (Viewer / vendég)</strong></td>
              <td>Kezdőlap, Géppark, Monitoring, Adatexport és a megtekintői útmutató.</td>
            </tr>
            <tr>
              <td><strong>KFGyR kezelő</strong></td>
              <td>Megtekintői jogok + Agentek és gépek, Jelkatalógus és Dashboard szerkesztő (a gyári Grafana-elrendezés módosítása nélkül).</td>
            </tr>
            <tr>
              <td><strong>Adminisztrátor</strong></td>
              <td>Teljes hozzáférés, beleértve a Jogosultságkezelés oldalt és a Relay kapcsolat beállításait.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Kezelő felvétele vagy eltávolítása</h3>
      <ol>
        <li>A Kezdőlapról nyisd meg a <strong>Jogosultságkezelés</strong> oldalt.</li>
        <li>A <strong>Felhasználó hozzáadása</strong> listából válassz ki egy meglévő <em>Viewer</em> fiókot.</li>
        <li>Kattints a <UiTag icon="plus" label="Hozzáadás" /> gombra (vagy eltávolításhoz a név melletti <UiTag icon="trash-alt" label="Eltávolítás" /> gombra).</li>
      </ol>

      <h3>Relay kapcsolat beállítása</h3>
      <p>
        A Grafana bővítmény beállításainál a <strong>KFGyR Monitoring → Relay kapcsolat</strong> fülön ellenőrizhető a
        háttérkapcsolat állapota és tesztelhető az összeköttetés.
      </p>
    </div>
  );
}

function TasksSection({ access, goTo }: { access: Access; goTo: (id: string) => void }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <div className={s.taskBlock}>
        <h4>Korábbi műszak adatainak visszanézése</h4>
        <ol>
          <li>Nyisd meg a <strong>Monitoring</strong> oldalt, és válaszd ki a gépet.</li>
          <li>A jobb felső időválasztóban állítsd be a kívánt napot és órát.</li>
          <li>Kapcsold ki az automatikus frissítést (<em>Off</em>), hogy nézelődés közben ne ugorjon el az ablak.</li>
        </ol>
      </div>

      <div className={s.taskBlock}>
        <h4>Adatok megnyitása magyar Excelben</h4>
        <ol>
          <li>Lépj az <ChapterLink id="adatexport" label="Adatexport" goTo={goTo} /> oldalra, válaszd ki a gépet, jeleket és időszakot.</li>
          <li>Válaszd az <strong>Excelhez formázott CSV (pontosvesszővel)</strong> formátumot, majd kattints a <UiTag icon="download-alt" label="CSV letöltése" /> gombra.</li>
        </ol>
      </div>

      <div className={s.taskBlock}>
        <h4>„Nincs érték” vagy szaggatott vonal a grafikonon</h4>
        <ul>
          <li>Ellenőrizd a felső <strong>Agent</strong> jelvényt: ha piros, a gép ki van kapcsolva vagy nem válaszol a hálózaton.</li>
          <li>Ritkán változó jeleknél növeld az időablakot, vagy nézd meg a lap alján a <strong>Gyors adatpontnézegető</strong> táblázatot.</li>
        </ul>
      </div>

      {access.manage_plugin && (
        <>
          <div className={s.taskBlock}>
            <h4>Új gép bekötésének ajánlott sorrendje</h4>
            <ol>
              <li>Új géptípusnál hozz létre sémát a <ChapterLink id="jelkatalogus" label="Jelkatalógus" goTo={goTo} /> oldalon.</li>
              <li>Az <ChapterLink id="agentek" label="Agentek és gépek" goTo={goTo} /> oldalon vedd fel az agentet, nevezd el a gépet, rendeld hozzá a sémát, majd nyomd meg a <UiTag label="Mentés és alkalmazás" /> gombot.</li>
              <li>Az első adatok beérkezése után a <strong>Jelkatalógus</strong> oldalon az <UiTag icon="plus" label="Új jel gépadatpontból" /> gombbal kösd össze a gép adatpontjait a magyar jelnevekkel.</li>
              <li>A <ChapterLink id="dashboard-szerkeszto" label="Dashboard szerkesztő" goTo={goTo} /> oldalon hozd létre a gép dashboardját.</li>
            </ol>
          </div>

          <div className={s.taskBlock}>
            <h4>A Hálózati keresés nem találja a gépet</h4>
            <ul>
              <li>Ellenőrizd, hogy a gép be van-e kapcsolva és azonos helyi hálózaton van-e az adatgyűjtővel.</li>
              <li>Eltérő port vagy külön útvonal esetén add meg kézzel a portot, vagy használd az <UiTag icon="plus" label="Agent hozzáadása" /> gombot.</li>
            </ul>
          </div>

          <div className={s.taskBlock}>
            <h4>Jel vagy séma nem törölhető</h4>
            <p>
              Jel törlése előtt vedd le az érintett dashboardokról és sémákból; séma törlése előtt válassz másik sémát
              az <strong>Agentek és gépek</strong> oldalon a hozzá rendelt gépekhez.
            </p>
          </div>
        </>
      )}

      {access.manage_access && (
        <div className={s.taskBlock}>
          <h4>Kezelői jogosultság adása új kollégának</h4>
          <ol>
            <li>A kolléga először lépjen be saját fiókkal a Grafanába.</li>
            <li>A <ChapterLink id="jogosultsagok" label="Jogosultságkezelés" goTo={goTo} /> oldalon válaszd ki a nevét, és kattints a <UiTag icon="plus" label="Hozzáadás" /> gombra.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

export const guideChapters: GuideChapter[] = [
  {
    id: 'bevezetes',
    group: 'Bevezetés',
    title: 'Első lépések és áttekintés',
    shortTitle: 'Első lépések',
    icon: 'book-open',
    role: 'viewer',
    summary: 'A rendszer főbb részei és gyors tájékozódás az oldalak között.',
    keywords: ['bevezetés', 'áttekintés', 'oldalak', 'kezdés'],
    render: (access, goTo) => <IntroSection access={access} goTo={goTo} />,
  },
  {
    id: 'kezdolap',
    group: 'Bevezetés',
    title: 'A Kezdőlap használata',
    shortTitle: 'Kezdőlap',
    icon: 'home-alt',
    role: 'viewer',
    summary: 'A főmenü csoportjai és visszalépés bármelyik oldalról.',
    keywords: ['kezdőlap', 'főmenü', 'kártyák', 'navigáció'],
    render: (access) => <HomeSection access={access} />,
  },
  {
    id: 'geppark',
    group: 'Gépek figyelése és adatok',
    title: 'Géppark áttekintés',
    shortTitle: 'Géppark',
    icon: 'apps',
    role: 'viewer',
    summary: 'Összesített kártyanézet állapot-színekkel és műszerekkel.',
    keywords: ['géppark', 'kártya', 'állapot', 'zöld', 'piros', 'sárga', 'műszer'],
    render: (_access, goTo) => <FleetSection goTo={goTo} />,
  },
  {
    id: 'monitoring',
    group: 'Gépek figyelése és adatok',
    title: 'Részletes Monitoring nézet',
    shortTitle: 'Monitoring',
    icon: 'chart-line',
    role: 'viewer',
    summary: 'Gép- és dashboardválasztás, időablak, panelek és gyors adatpont-táblázat.',
    keywords: ['monitoring', 'grafikon', 'idősor', 'állapotidősor', 'gyors adatpontnézegető', 'időablak'],
    render: (access) => <MonitoringSection access={access} />,
  },
  {
    id: 'adatexport',
    group: 'Gépek figyelése és adatok',
    title: 'Adatok letöltése (Adatexport)',
    shortTitle: 'Adatexport',
    icon: 'download-alt',
    role: 'viewer',
    summary: 'Múltbeli mérések exportálása CSV vagy magyar Excel fájlba.',
    keywords: ['export', 'csv', 'excel', 'letöltés', 'részleges', 'utc'],
    render: () => <ExportSection />,
  },
  {
    id: 'agentek',
    group: 'Rendszer beállítása',
    title: 'Agentek és gépek kezelése',
    shortTitle: 'Agentek és gépek',
    icon: 'plug',
    role: 'operator',
    summary: 'Gépek hálózati felderítése, bekötése, szüneteltetése és visszaállítása.',
    keywords: ['agent', 'hálózati keresés', 'mentés és alkalmazás', 'szüneteltetés', 'visszaállítás'],
    render: (_access, goTo) => <AgentsSection goTo={goTo} />,
  },
  {
    id: 'jelkatalogus',
    group: 'Rendszer beállítása',
    title: 'Jelkatalógus, sémák és mértékegységek',
    shortTitle: 'Jelkatalógus',
    icon: 'sitemap',
    role: 'operator',
    summary: 'Magyar jelnevek, gépsémák kezelése és a mértékegységek testreszabása.',
    keywords: ['jelkatalógus', 'séma', 'mértékegység', 'másolás', 'hozzárendelés'],
    render: () => <CatalogSection />,
  },
  {
    id: 'dashboard-szerkeszto',
    group: 'Rendszer beállítása',
    title: 'Dashboard szerkesztő',
    shortTitle: 'Dashboard szerkesztő',
    icon: 'sliders-v-alt',
    role: 'operator',
    summary: 'Gépenkénti dashboardok létrehozása, panelek felvétele, rendezése és másolása.',
    keywords: ['dashboard szerkesztő', 'panel', 'műszer', 'állapotidősor', 'vonalszín'],
    render: () => <EditorSection />,
  },
  {
    id: 'jogosultsagok',
    group: 'Adminisztráció',
    title: 'Jogosultságkezelés és kapcsolat',
    shortTitle: 'Jogosultságkezelés',
    icon: 'users-alt',
    role: 'admin',
    summary: 'Szerepkörök, kezelői csapat karbantartása és a Relay kapcsolat ellenőrzése.',
    keywords: ['jogosultság', 'admin', 'kezelők', 'viewer', 'relay kapcsolat'],
    render: () => <AccessSection />,
  },
  {
    id: 'gyakori-feladatok',
    group: 'Segítség',
    title: 'Gyakori feladatok és hibaelhárítás',
    shortTitle: 'Gyakori feladatok',
    icon: 'question-circle',
    role: 'viewer',
    summary: 'Rövid útmutatók a leggyakoribb kérdésekhez és hibajelenségekhez.',
    keywords: ['gyakori', 'hiba', 'nincs adat', 'új gép', 'excel', 'segítség'],
    render: (access, goTo) => <TasksSection access={access} goTo={goTo} />,
  },
];

export function visibleChapters(access: Access): GuideChapter[] {
  return guideChapters.filter((chapter) => canSeeRole(chapter.role, access));
}
