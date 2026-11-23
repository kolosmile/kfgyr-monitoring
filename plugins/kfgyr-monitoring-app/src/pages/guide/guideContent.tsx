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
        A <strong>KFGyR Monitoring</strong> felületen a gyártórendszer gépeinek aktuális állapota, mért értékei és
        múltbeli adatai követhetők egy helyen, asztali böngészőből és telefonról is.
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
        A mindennapi műveletekhez összefoglalt lépéssorok a{' '}
        <ChapterLink id="gyakori-feladatok" label="Gyakori feladatok" goTo={goTo} /> fejezetben találhatók.
      </Callout>
    </div>
  );
}

function HomeSection({ access }: { access: Access }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        A <strong>KFGyR · Kezdőlap</strong> a rendszer központi kiindulópontja: az elérhető nézetek és beállítási
        oldalak kártyákba csoportosítva jelennek meg rajta, és a megfelelő kártyára kattintva nyithatók meg.
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
        Minden belső oldal és a Monitoring tetején megtalálható a <UiTag icon="home-alt" label="Kezdőlap" /> gomb,
        amelyre kattintva bármikor vissza lehet térni a főmenüre.
      </p>

      {access.manage_plugin && (
        <Callout kind="note" title="Nem mentett módosítások">
          Az <strong>Agentek és gépek</strong> vagy a <strong>Dashboard szerkesztő</strong> oldalon elkezdett, még nem
          mentett módosítás esetén a böngésző az oldal elhagyása előtt figyelmeztetést jelenít meg.
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
        <li>Felül az adatgyűjtő (agent) elérhetőség szerint színezett címkéje és a gép neve látható.</li>
        <li>
          A középső rész legfeljebb 6 állapotot, az alsó sor legfeljebb 3 félköríves műszert mutat a jelnevekkel
          együtt, a gép alapértelmezett dashboardjáról.
        </li>
        <li>
          A kártya jobb alsó sarkában lévő <UiTag icon="external-link-alt" label="Megnyitás a Monitoringban" /> ikonra
          kattintva közvetlenül az adott gép részletes oldala nyitható meg.
        </li>
      </ul>

      <h3>Állapotok színjelzése</h3>
      <div className={s.badgeRow}>
        <Badge color="green" text="AVAILABLE / ACTIVE / NORMAL — rendben" />
        <Badge color="orange" text="WARNING — figyelmeztetés" />
        <Badge color="red" text="UNAVAILABLE / FAULT / ALARM — hiba vagy nem elérhető" />
      </div>

      <Callout kind="tip" title="Részletes trendek">
        Múltbeli grafikonokhoz és a teljes adatpont-listához a{' '}
        <ChapterLink id="monitoring" label="Monitoring" goTo={goTo} /> oldal nyitható meg.
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
        <li>A felső navigációs sávban először az <strong>Agent</strong>, majd a <strong>Gép</strong> választható ki.</li>
        <li>Ha a géphez több nézet is készült, a <strong>Dashboard</strong> választóban lehet váltani közöttük.</li>
        <li>Mobilon a felső választógombra kattintva nyitható meg a gép- és dashboard-lista.</li>
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
        <li>A jobb felső időválasztóval bármilyen korábbi időszakra vissza lehet tekinteni, és az automatikus frissítés is itt állítható.</li>
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
          <UiTag icon="plus" label="Dashboard hozzáadása" />) gombra kattintva közvetlenül az aktuális gép paneljeinek
          szerkesztőjébe lehet lépni.
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
        Az <strong>Adatexport</strong> oldalon táblázatos CSV-fájlként tölthetők le a gépek korábbi mérései saját
        elemzéshez vagy Excel-táblázathoz.
      </p>

      <h3>Letöltés lépései</h3>
      <ol>
        <li>A <strong>Gépek</strong> listában egy vagy több gép jelölhető ki (gépeléssel a lista szűrhető).</li>
        <li>
          Az <strong>Adatpontok</strong> mezőben a kívánt jelek választhatók ki, vagy az{' '}
          <UiTag label="Összes adatpont kijelölése" /> gombra kattintva az összes jel megjelölhető.
        </li>
        <li>A <strong>Kezdőidő</strong> és a <strong>Végidő</strong> a helyi időzónában adható meg.</li>
        <li>
          A <strong>Sorkorlát</strong> (legfeljebb 100 000 sor) és a <strong>Formátum</strong> kiválasztása:
          <ul>
            <li><strong>CSV (vesszővel):</strong> általános adatfeldolgozáshoz.</li>
            <li><strong>Excelhez formázott CSV (pontosvesszővel):</strong> magyar Excelben közvetlenül oszlopokra bontva nyílik meg.</li>
          </ul>
        </li>
        <li>A <UiTag icon="download-alt" label="CSV letöltése" /> gombra kattintva indul el a fájl letöltése.</li>
      </ol>

      <Callout kind="note" title="Időbélyegek és részleges export">
        A letöltött fájlban az időbélyegek UTC-ben szerepelnek. Ha a kért időszak több sort tartalmaz a sorkorlátnál, a
        felület jelzi, hogy <strong>részleges export</strong> készült (az időben első N sorral); ilyenkor a letöltést
        érdemes kisebb időszakokra bontani.
      </Callout>
    </div>
  );
}

function AgentsSection({ goTo }: { goTo: (id: string) => void }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        Az <strong>Agentek és gépek</strong> oldalon köthetők be a gépek adatgyűjtő kapcsolatai (agentjei), itt adható
        megjelenítési név a gépeknek, és itt szüneteltethető a gyűjtés.
      </p>

      <h3>Új agent és gép felvétele</h3>
      <ol>
        <li>
          <strong>Automatikusan:</strong> a <UiTag icon="search" label="Hálózati keresés" /> gombra kattintva
          kiválasztható a helyi hálózat, majd a talált eszköznél az <UiTag label="Agent beállítása" /> gombra
          kattintva folytatható a felvétel.
        </li>
        <li>
          <strong>Kézzel:</strong> az <UiTag icon="plus" label="Agent hozzáadása" /> gombra kattintva megadható az
          egyedi név, valamint az agent hálózati címe (URL / IP és port).
        </li>
        <li>A <UiTag icon="search" label="Kapcsolat és eszközkeresés" /> gombra kattintva lekérdezhetők a gép adatai.</li>
        <li>Minden megtalált gépnél megadható egy <strong>Megjelenítési név</strong>, és kiválasztható egy <strong>Séma</strong>.</li>
        <li>A <UiTag icon="check" label="Hozzáadás a listához" /> gombra kattintva előkészíthető a módosítás.</li>
        <li>Végül a lap alján megjelenő sávban a <UiTag label="Mentés és alkalmazás" /> gombra kattintva menthető és élesíthető a lista.</li>
      </ol>

      <Callout kind="warning" title="Kötelező sémaválasztás">
        Gép csak kiválasztott sémával menthető. Ha még nincs megfelelő séma, előbb a{' '}
        <ChapterLink id="jelkatalogus" label="Jelkatalógus" goTo={goTo} /> oldalon kell létrehozni.
      </Callout>

      <h3>Szüneteltetés, elvetés és visszaállítás</h3>
      <ul>
        <li>
          <strong>Szüneteltetés:</strong> a <UiTag icon="pen" label="Szerkesztés" /> ablakban az{' '}
          <strong>Agent engedélyezve</strong> kapcsoló kikapcsolásával, majd mentéssel állítható le az új adatok
          gyűjtése. A már tárolt múltbeli adatok megmaradnak.
        </li>
        <li>
          <strong>Elvetés:</strong> mentés előtt az alsó sávban az <UiTag label="Elvetés" /> gombra kattintva
          visszavonhatók a helyi módosítások.
        </li>
        <li>
          <strong>Visszaállítás hiba esetén:</strong> ha az alkalmazás után a felső állapotsáv hibát jelez, a{' '}
          <UiTag label="Visszaállítás a futó konfigurációra" /> gombra kattintva visszaállítható a korábbi működő
          állapot.
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
        <li>A jobb oldali <strong>Sémák</strong> panelen az <UiTag icon="plus" label="Új séma" /> gombra kattintva nyitható meg a létrehozó ablak.</li>
        <li>A séma nevének megadása után a <strong>Kiindulás</strong> mezőben üres séma vagy egy meglévő séma másolása választható.</li>
        <li>A <UiTag label="Létrehozás" /> gombra kattintva létrejön az új séma.</li>
      </ol>

      <h3>Jelek és adatpontok összekötése</h3>
      <ol>
        <li>
          <strong>Új jel beolvasott gépből:</strong> az <UiTag icon="plus" label="Új jel gépadatpontból" /> gombra
          kattintva kijelölhető a gép és az adatpont; a rendszer automatikusan javasol nevet, azonosítót és egységet.
        </li>
        <li>
          <strong>Kézi felvétel:</strong> a <UiTag icon="plus" label="Jel hozzáadása" /> gombra kattintva előre is
          felvehetők közös jelek. (A <strong>Jelazonosító</strong> létrehozás után nem módosítható.)
        </li>
        <li>
          <strong>Összekötés a sémában:</strong> a jel sorának jobb oldalán az{' '}
          <UiTag icon="plus" label="Adatpont hozzárendelése" /> gombra kattintva választható adatpont a gép listájából
          (vagy <code>/</code>-rel kezdődő útvonal is megadható).
        </li>
      </ol>

      <h3>Színjelölés és megjelenítési mértékegységek</h3>
      <ul>
        <li>A jelnevek és útvonalak színe a gép funkcionális ágát jelöli (például tengelyek, vezérlő, rendszerek).</li>
        <li>
          A <UiTag icon="calculator-alt" label="Megjelenítési mértékegységek" /> gombra kattintva megnyíló ablakban a gép
          nyers kódjaihoz (pl. <code>REVOLUTION/MINUTE</code>) rövid, olvasható felirat (pl. <code>rpm</code>) adható
          meg.
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
        A <strong>Dashboard szerkesztő</strong> oldalon állíthatók össze a gépek Monitoring nézetei. Egy géphez több
        önálló dashboard is készíthető.
      </p>

      <h3>Dashboard létrehozása vagy másolása</h3>
      <ol>
        <li>A listából a kívánt gép kiválasztása után a <UiTag icon="plus" label="Dashboard hozzáadása" /> gombra kattintva hozható létre új nézet.</li>
        <li>Név megadása után a <strong>Kiindulás</strong> listában üres dashboard vagy egy azonos sémájú gép meglévő dashboardja választható.</li>
      </ol>

      <h3>Panelek beállítása és mentése</h3>
      <ol>
        <li>A kívánt nézetcsoport (<strong>Állapot</strong>, <strong>Aktuális érték</strong>, <strong>Műszer</strong> vagy <strong>Grafikon</strong>) lenyitása után a <UiTag icon="plus" label="Panel hozzáadása" /> kártyára kattintva vehető fel új panel.</li>
        <li>A <strong>Jel a katalógusból</strong> listából kiválasztható a jel, és igény szerint egyedi név is megadható.</li>
        <li>
          A nézet opcióinak beállítása:
          <ul>
            <li><strong>Állapot:</strong> bekapcsolható az <strong>Állapotidősor megjelenítése</strong> színes idővonala.</li>
            <li><strong>Műszer:</strong> kötelező megadni a <strong>Minimum</strong> és <strong>Maximum</strong> értéket.</li>
            <li><strong>Grafikon:</strong> választható <strong>Vonalszín</strong>.</li>
          </ul>
        </li>
        <li>A <UiTag label="Módosítások átvétele" /> gombra kattintva a panel bekerül a nézetbe, majd a kártyák nyilaival a panelek sorrendje rendezhető.</li>
        <li>A <UiTag icon="save" label="Dashboard mentése" /> gombra kattintva menthető a beállítás; az eredmény a <UiTag icon="chart-line" label="Monitoring megnyitása" /> gombra kattintva tekinthető meg.</li>
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
        <li>A Kezdőlapról a <strong>Jogosultságkezelés</strong> oldal nyitható meg.</li>
        <li>A <strong>Felhasználó hozzáadása</strong> listából kiválasztható egy meglévő <em>Viewer</em> fiók.</li>
        <li>A <UiTag icon="plus" label="Hozzáadás" /> gombra kattintva adható meg a jogosultság (eltávolításhoz a név melletti <UiTag icon="trash-alt" label="Eltávolítás" /> gombra kattintva vonható vissza).</li>
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
          <li>A <strong>Monitoring</strong> oldalon a kívánt gép kiválasztása.</li>
          <li>A jobb felső időválasztóra kattintva a kívánt nap és óra beállítása.</li>
          <li>Az automatikus frissítés kikapcsolásával (<em>Off</em>) elkerülhető, hogy az időablak nézelődés közben elmozduljon.</li>
        </ol>
      </div>

      <div className={s.taskBlock}>
        <h4>Adatok megnyitása magyar Excelben</h4>
        <ol>
          <li>Az <ChapterLink id="adatexport" label="Adatexport" goTo={goTo} /> oldalra lépve a gép, a jelek és az időszak kiválasztása.</li>
          <li>Az <strong>Excelhez formázott CSV (pontosvesszővel)</strong> formátum kiválasztása után a <UiTag icon="download-alt" label="CSV letöltése" /> gombra kattintva indítható a fájl mentése.</li>
        </ol>
      </div>

      <div className={s.taskBlock}>
        <h4>„Nincs érték” vagy szaggatott vonal a grafikonon</h4>
        <ul>
          <li>A felső <strong>Agent</strong> jelvény jelzi az állapotot: ha piros, a gép ki van kapcsolva vagy nem válaszol a hálózaton.</li>
          <li>Ritkán változó jeleknél az időablak bővítésével, vagy a lap alján a <strong>Gyors adatpontnézegető</strong> táblázatban ellenőrizhető a legutóbbi érték.</li>
        </ul>
      </div>

      {access.manage_plugin && (
        <>
          <div className={s.taskBlock}>
            <h4>Új gép bekötésének ajánlott sorrendje</h4>
            <ol>
              <li>Új géptípusnál séma létrehozása a <ChapterLink id="jelkatalogus" label="Jelkatalógus" goTo={goTo} /> oldalon.</li>
              <li>Az <ChapterLink id="agentek" label="Agentek és gépek" goTo={goTo} /> oldalon az agent felvétele, a gép elnevezése és a séma hozzárendelése után a <UiTag label="Mentés és alkalmazás" /> gombra kattintva véglegesíthető a kapcsolat.</li>
              <li>Az első adatok beérkezése után a <strong>Jelkatalógus</strong> oldalon az <UiTag icon="plus" label="Új jel gépadatpontból" /> gombra kattintva köthetők össze a gép adatpontjai a magyar jelnevekkel.</li>
              <li>A <ChapterLink id="dashboard-szerkeszto" label="Dashboard szerkesztő" goTo={goTo} /> oldalon hozható létre a gép dashboardja.</li>
            </ol>
          </div>

          <div className={s.taskBlock}>
            <h4>A Hálózati keresés nem találja a gépet</h4>
            <ul>
              <li>Ellenőrizendő, hogy a gép be van-e kapcsolva és azonos helyi hálózaton van-e az adatgyűjtővel.</li>
              <li>Eltérő port vagy külön útvonal esetén kézzel adható meg a port, vagy az <UiTag icon="plus" label="Agent hozzáadása" /> gombra kattintva vehető fel kézzel az eszköz.</li>
            </ul>
          </div>

          <div className={s.taskBlock}>
            <h4>Jel vagy séma nem törölhető</h4>
            <p>
              Jel törlése előtt a hivatkozások eltávolítása szükséges az érintett dashboardokról és sémákból; séma
              törlése előtt másik sémát kell választani az <strong>Agentek és gépek</strong> oldalon a hozzá rendelt
              gépekhez.
            </p>
          </div>
        </>
      )}

      {access.manage_access && (
        <div className={s.taskBlock}>
          <h4>Kezelői jogosultság adása új kollégának</h4>
          <ol>
            <li>A kollégának először be kell lépnie saját fiókkal a Grafanába.</li>
            <li>A <ChapterLink id="jogosultsagok" label="Jogosultságkezelés" goTo={goTo} /> oldalon a név kiválasztása után a <UiTag icon="plus" label="Hozzáadás" /> gombra kattintva adható meg a jogosultság.</li>
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
