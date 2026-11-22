import React from 'react';
import { css } from '@emotion/css';
import type { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import type { Access } from '../../access';
import { canSeeRole, currentRoleLabel, GuideChapter } from './guideTypes';
import {
  AccessGuideVisual,
  AgentsGuideVisual,
  CatalogGuideVisual,
  EditorGuideVisual,
  ExportGuideVisual,
  FleetGuideVisual,
  HomeGuideVisual,
  MonitoringGuideVisual,
} from './GuideVisuals';

const getStyles = (theme: GrafanaTheme2) => ({
  body: css({
    display: 'grid',
    gap: 14,
    lineHeight: 1.6,
    fontSize: 14,
    '& h3': { margin: '10px 0 2px', fontSize: 17, fontWeight: 600 },
    '& p': { margin: 0 },
    '& ul, & ol': { margin: 0, paddingLeft: 20, display: 'grid', gap: 6 },
  }),
  callout: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '11px 14px',
    borderRadius: 8,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
    fontSize: 13,
    lineHeight: 1.5,
  }),
  calloutTip: css({ borderLeft: `4px solid ${theme.colors.success.border}` }),
  calloutNote: css({ borderLeft: `4px solid ${theme.colors.info.border}` }),
  calloutWarn: css({ borderLeft: `4px solid ${theme.colors.warning.border}` }),
  calloutIconTip: css({ color: theme.colors.success.text, flexShrink: 0, marginTop: 2 }),
  calloutIconNote: css({ color: theme.colors.info.text, flexShrink: 0, marginTop: 2 }),
  calloutIconWarn: css({ color: theme.colors.warning.text, flexShrink: 0, marginTop: 2 }),
  tableWrap: css({ overflowX: 'auto' }),
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    '& th, & td': {
      textAlign: 'left',
      padding: '8px 10px',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      verticalAlign: 'top',
    },
    '& th': { fontWeight: 600, background: theme.colors.background.secondary },
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
  taskCard: css({
    padding: '12px 14px',
    borderRadius: 8,
    border: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
    display: 'grid',
    gap: 8,
    '& h4': { margin: 0, fontSize: 15, fontWeight: 600 },
  }),
});

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
  const roleLabel = currentRoleLabel(access);
  return (
    <div className={s.body}>
      <p>
        A <strong>KFGyR Monitoring</strong> felület segítségével a gyártórendszer gépeinek működési állapotát,
        mért adatait és múltbeli adatait követheted egy helyen, böngészőből (asztali gépen és mobilon is).
      </p>
      <p>
        Az útmutató csak azokat a funkciókat mutatja meg neked, amelyek a jelenlegi hozzáféréseddel elérhetők.
        Jelenlegi jogosultsági szinted: <strong>{roleLabel}</strong>.
      </p>

      <h3>Mit tudsz elvégezni a jelenlegi hozzáféréseddel?</h3>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Feladat</th>
              <th>Hol találod?</th>
              <th>Rövid leírás</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Összes gép gyors áttekintése</td>
              <td><ChapterLink id="geppark" label="Géppark" goTo={goTo} /></td>
              <td>Egy képernyőn mutatja az összes gép legfontosabb állapotait és műszereit.</td>
            </tr>
            <tr>
              <td>Egy gép élő és múltbeli követése</td>
              <td><ChapterLink id="monitoring" label="Monitoring" goTo={goTo} /></td>
              <td>Állapotok, idősoros grafikonok, műszerek és teljes adatpont-lista megtekintése.</td>
            </tr>
            <tr>
              <td>Mért adatok letöltése táblázatba</td>
              <td><ChapterLink id="adatexport" label="Adatexport" goTo={goTo} /></td>
              <td>Kiválasztott gépek és jelek mentése CSV vagy Excelhez formázott fájlba.</td>
            </tr>
            {access.manage_plugin && (
              <>
                <tr>
                  <td>Gépek és adatgyűjtők felvétele</td>
                  <td><ChapterLink id="agentek" label="Agentek és gépek" goTo={goTo} /></td>
                  <td>Új gépek megkeresése a hálózaton, elnevezésük és sémához rendelésük.</td>
                </tr>
                <tr>
                  <td>Magyar jelnevek és mértékegységek</td>
                  <td><ChapterLink id="jelkatalogus" label="Jelkatalógus" goTo={goTo} /></td>
                  <td>Közös jelnevek, gépcsalád-sémák és megjelenítési egységek beállítása.</td>
                </tr>
                <tr>
                  <td>Gépnézetek összeállítása</td>
                  <td><ChapterLink id="dashboard-szerkeszto" label="Dashboard szerkesztő" goTo={goTo} /></td>
                  <td>Egyedi műszerfalak létrehozása, panelek hozzáadása és sorrendezése.</td>
                </tr>
              </>
            )}
            {access.manage_access && (
              <tr>
                <td>Kezelők és kapcsolat beállítása</td>
                <td><ChapterLink id="jogosultsagok" label="Jogosultságkezelés" goTo={goTo} /></td>
                <td>Bejelentkezett felhasználók felvétele a kezelői csapatba vagy eltávolítása.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Callout kind="tip" title="Gyors eligazodás">
        Ha csak egy adott feladatot szeretnél gyorsan megoldani (például adatok mentése Excelbe
        {access.manage_plugin ? ' vagy új gép bekötése' : ''}), ugorj a bal oldali menüben a{' '}
        <ChapterLink id="gyakori-feladatok" label="Gyakori feladatok" goTo={goTo} /> fejezetre.
      </Callout>
    </div>
  );
}

function HomeSection({ access }: { access: Access }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        Belépés után a <strong>KFGyR · Kezdőlap</strong> fogad. Ez a rendszer központi kiindulópontja: minden
        elérhető nézethez és beállítási oldalhoz innen tudsz egy kattintással eljutni.
      </p>
      <HomeGuideVisual access={access} />
      <h3>Hogyan navigálj a rendszerben?</h3>
      <ol>
        <li>A kezdőlapon kattints arra a kártyára, amelyet meg szeretnél nyitni.</li>
        <li>
          Bármelyik belső oldal vagy a <strong>Monitoring</strong> tetején megtalálod a <strong>Kezdőlap</strong>{' '}
          gombot, amellyel azonnal visszaléphetsz ebbe a főmenübe.
        </li>
        <li>A menü kártyái automatikusan igazodnak a jogosultságodhoz: csak a számodra nyitott funkciók látszanak.</li>
      </ol>
      {access.manage_plugin && (
        <Callout kind="note" title="Nem mentett módosítások">
          Ha az <strong>Agentek és gépek</strong> vagy a <strong>Dashboard szerkesztő</strong> oldalon módosítottál
          valamit, de még nem mentetted el, a böngésző rákérdez, mielőtt bezárnád vagy elhagynád az oldalt.
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
        A <strong>Géppark</strong> oldal arra való, hogy egyetlen képernyőn lásd az összes bekötött gép aktuális
        állapotát és főbb mérőszámait — például egy műhelyi kivetítőn vagy gyors ellenőrzés közben.
      </p>
      <FleetGuideVisual />
      <h3>Mit mutat egy gépkártya?</h3>
      <ul>
        <li>Felül látható az adatgyűjtő (agent) címkéje és a gép neve.</li>
        <li>
          A jobb felső sarokban lévő nyíl ikonra (<strong>Megnyitás a Monitoringban</strong>) kattintva rögtön az
          adott gép részletes idősoros oldalára jutsz.
        </li>
        <li>A kártya legfeljebb 6 szöveges állapotot és 3 félköríves műszert jelenít meg a gép alapértelmezett dashboardjáról.</li>
        <li>Ha egy géphez még nincs beállított állapot vagy műszer, a kártya üres jelzést mutat.</li>
      </ul>
      <h3>Színkódok jelentése az állapotoknál</h3>
      <ul>
        <li><strong>Zöld</strong> (pl. <em>AVAILABLE</em>, <em>ACTIVE</em>, <em>NORMAL</em>): a gép elérhető, működik vagy a mért érték rendben van.</li>
        <li><strong>Sárga</strong> (<em>WARNING</em>): figyelmeztetés, érdemes ellenőrizni a gépet.</li>
        <li><strong>Piros</strong> (<em>UNAVAILABLE</em>, <em>FAULT</em>, <em>ALARM</em>): a gép nem elérhető, áll vagy hibát jelez.</li>
      </ul>
      <Callout kind="tip" title="Részletes adatokhoz">
        A múltbeli grafikonokhoz és az összes mért adatponthoz kattints a kártya jobb felső nyíl ikonjára, vagy nyisd meg
        a <ChapterLink id="monitoring" label="Monitoring" goTo={goTo} /> oldalt.
      </Callout>
    </div>
  );
}

function MonitoringSection({ access }: { access: Access }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        A <strong>KFGyR · Monitoring</strong> nézet mutatja egy kiválasztott gép részletes, élő és visszakereshető
        adatait. Alapértelmezésben az <strong>elmúlt 5 percet</strong> mutatja, és <strong>5 másodpercenként</strong>{' '}
        magától frissül.
      </p>
      <MonitoringGuideVisual canEdit={access.manage_plugin} />

      <h3>1. Gép és nézet kiválasztása</h3>
      <ol>
        <li>A felső sávban válassz először <strong>Agent</strong>-et, majd <strong>Gép</strong>-et.</li>
        <li>
          Ha ugyanahhoz a géphez több nézet is készült, a <strong>Dashboard</strong> választóban válthatsz közöttük.
        </li>
        <li>Keskeny képernyőn (mobilon) a fenti választógombra bökve nyitható meg a gép- és dashboard-lista.</li>
      </ol>

      <h3>2. Mit jelent a színes „Agent” jelvény?</h3>
      <ul>
        <li><strong>Agent elérhető</strong> (zöld): a gép adatforrása jelenleg válaszol a lekérdezésekre.</li>
        <li><strong>Agent nem elérhető</strong> (piros): a gép vagy a hálózati kapcsolata nem válaszol (lehet kikapcsolva is).</li>
        <li><strong>Agent elérhetősége ismeretlen</strong> (szürke): még nem állapítható meg a kapcsolat állapota.</li>
      </ul>

      <h3>3. Időszak beállítása és panelek értelmezése</h3>
      <ol>
        <li>
          A jobb felső időválasztóval bármilyen korábbi időszakra visszanézhetsz (például az elmúlt 1 óra vagy egy
          konkrét műszak). A frissítési idő is ott állítható át vagy állítható meg.
        </li>
        <li>
          Az oldalon négyféle fő panel jelenhet meg (ha az adott géphez be vannak állítva):
          <ul>
            <li><strong>Állapot:</strong> nagy szöveges kártya az aktuális üzemmódról. Ha be van kapcsolva, közvetlenül alatta színes <strong>állapotidősor</strong> mutatja az időbeli változásokat.</li>
            <li><strong>Aktuális érték:</strong> az utoljára beérkezett mérőszám mértékegységgel.</li>
            <li><strong>Műszer:</strong> félköríves skála, amely a beállított minimum és maximum között mutatja az értéket.</li>
            <li><strong>Grafikon:</strong> az időbeli lefutást ábrázoló vonaldiagram a kiválasztott időablakra.</li>
          </ul>
        </li>
        <li>
          A lap alján található a <strong>Gyors adatpontnézegető</strong> táblázat, amely a gép minden egyes ismert
          adatpontjának utolsó, a kiválasztott időablakon belüli értékét mutatja. Az oszlopfejlécekben szűrni is tudsz.
        </li>
      </ol>

      {access.manage_plugin && (
        <Callout kind="tip" title="Gyors szerkesztés">
          Kezelőként a felső sávban megjelenő <strong>Dashboard szerkesztése</strong> (vagy új gépnél{' '}
          <strong>Dashboard hozzáadása</strong>) gombbal közvetlenül átléphetsz az adott gép paneljeinek szerkesztéséhez.
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
        elemzéshez, jegyzőkönyvhöz vagy Excel-táblázathoz.
      </p>
      <ExportGuideVisual />
      <h3>Lépések a letöltéshez</h3>
      <ol>
        <li>
          A <strong>Gépek</strong> mezőben válassz ki egy vagy több gépet (beírással kereshetsz a listában).
        </li>
        <li>
          Az <strong>Adatpontok</strong> mezőben jelöld ki a letölteni kívánt jeleket. Ha minden jelre szükséged van,
          kattints az <strong>Összes adatpont kijelölése</strong> gombra.
        </li>
        <li>
          Add meg a <strong>Kezdőidő</strong>-t és a <strong>Végidő</strong>-t. Mindkettőt a számítógéped helyi
          időzónájában kell megadni.
        </li>
        <li>
          Válassz <strong>Sorkorlát</strong>-ot (1 000 és 100 000 sor között) és <strong>Formátum</strong>-ot:
          <ul>
            <li><strong>CSV (vesszővel):</strong> általános adatfeldolgozáshoz (Python, R, szöveges elemzés).</li>
            <li><strong>Excelhez formázott CSV (pontosvesszővel):</strong> magyar nyelvű Microsoft Excelben közvetlenül, szép oszlopokra bontva nyílik meg.</li>
          </ul>
        </li>
        <li>Kattints a <strong>CSV letöltése</strong> gombra. A letöltés közvetlenül a böngésződben indul el.</li>
      </ol>
      <Callout kind="note" title="Időbélyegek és részleges export">
        A letöltött fájl oszlopai között az időpont <strong>UTC</strong> időzónában szerepel. Ha a kiválasztott
        időszak több adatot tartalmaz a megadott sorkorlátnál, a rendszer figyelmeztet, hogy{' '}
        <strong>részleges export</strong> készült — ilyenkor csak az időben első N sor kerül a fájlba, ezért bontsd
        kisebb időablakokra a letöltést.
      </Callout>
    </div>
  );
}

function AgentsSection({ goTo }: { goTo: (id: string) => void }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        Az <strong>Agentek és gépek</strong> oldalon kötheted be a gyártórendszer adatforrásait (az MTConnect
        agenteket), adhatsz emberi nevet a gépeknek, és itt szüneteltetheted vagy törölheted a kapcsolatokat.
      </p>
      <AgentsGuideVisual />

      <h3>Új gépkapcsolat felvétele</h3>
      <ol>
        <li>
          <strong>Hálózati kereséssel:</strong> kattints a <strong>Hálózati keresés</strong> gombra, válaszd ki a
          felismert helyi hálózatot, majd nyomd meg a <strong>Keresés indítása</strong> gombot. A talált eszközök
          mellett kattints az <strong>Agent beállítása</strong> gombra.
        </li>
        <li>
          <strong>Kézzel:</strong> kattints az <strong>Agent hozzáadása</strong> gombra, adj meg egy egyedi{' '}
          <strong>Agentnév</strong>-et és az <strong>Agent címe (URL)</strong> mezőben a hálózati címet (például
          IP-címmel és porttal).
        </li>
        <li>
          Kattints a <strong>Kapcsolat és eszközkeresés</strong> gombra (vagy várj egy pillanatot az URL beírása után),
          hogy a rendszer lekérdezze az agenten található gépeket.
        </li>
        <li>
          A lenti <strong>Gépek</strong> részben minden géphez adj meg egy érthető <strong>Megjelenítési név</strong>-et,
          és a <strong>Séma</strong> listából válassz ki egy meglévő sémát.
        </li>
        <li>
          Kattints a <strong>Hozzáadás a listához</strong> gombra. Ez még csak előkészíti a módosítást!
        </li>
        <li>
          A lap alján felugró sávban kattints a <strong>Mentés és alkalmazás</strong> gombra, majd erősítsd meg a
          változásösszesítőben.
        </li>
      </ol>

      <Callout kind="warning" title="Kötelező sémaválasztás">
        Új vagy módosított gép csak akkor menthető el, ha van hozzá kiválasztott séma. Ha még nincs megfelelő sémád,
        előbb hozd létre a <ChapterLink id="jelkatalogus" label="Jelkatalógus" goTo={goTo} /> oldalon.
      </Callout>

      <h3>Agent szüneteltetése, szerkesztése és visszaállítás</h3>
      <ul>
        <li>
          <strong>Szüneteltetés:</strong> a <strong>Szerkesztés</strong> ablakban kapcsold ki az{' '}
          <strong>Agent engedélyezve</strong> kapcsolót, majd ments. A már tárolt múltbeli adatok megmaradnak, csak új
          adatgyűjtés nem történik róla.
        </li>
        <li>
          <strong>Elvetés:</strong> ha meggondoltad magad mentés előtt, az alsó sávban kattints az{' '}
          <strong>Elvetés</strong> gombra.
        </li>
        <li>
          <strong>Hibás indulás utáni visszaállítás:</strong> ha egy módosítás után a felső állapotsáv hibát jelez, a{' '}
          <strong>Visszaállítás a futó konfigurációra</strong> gombbal visszaállhatsz a legutóbbi stabilan működő
          állapotra.
        </li>
      </ul>

      <Callout kind="note" title="Rövid szünet alkalmazáskor és rögzített nevek">
        A <strong>Mentés és alkalmazás</strong> újraindítja az adatgyűjtőt, ami néhány másodperces adatgyűjtési szünettel
        járhat. A már mentett agent- és gépazonosítók a múltbeli adatok védelme érdekében később már nem írhatók át
        szabadon.
      </Callout>
    </div>
  );
}

function CatalogSection() {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        Különböző gyártók vagy vezérlők ugyanazt a mérőszámot (például a főorsó fordulatszámát) eltérő belső útvonalon
        küldhetik. A <strong>Jelkatalógus</strong> feloldja ezt a különbséget:
      </p>
      <ul>
        <li><strong>Jel (katalógusjel):</strong> egy egységes magyar elnevezés és mértékegység, amit a kezelők a dashboardokon látnak (például <em>Főorsó fordulatszám</em>).</li>
        <li><strong>Séma:</strong> egy gépcsaládra vagy vezérlőtípusra jellemző „szótár”, amely megmondja, hogy az adott géptípusban melyik belső adatpont felel meg a katalógus egyes jeleinek.</li>
      </ul>
      <CatalogGuideVisual />

      <h3>1. Új séma létrehozása vagy másolása</h3>
      <ol>
        <li>A jobb oldali <strong>Sémák</strong> panelen kattints az <strong>Új séma</strong> gombra.</li>
        <li>Add meg a séma nevét (például a géptípus vagy vezérlő nevét).</li>
        <li>
          A <strong>Kiindulás</strong> mezőben választhatsz üres sémát, vagy átmásolhatod egy meglévő séma összes
          beállított jel-hozzárendelését (ez különösen hasznos hasonló gépeknél).
        </li>
        <li>Kattints a <strong>Létrehozás</strong> gombra.</li>
      </ol>

      <h3>2. Jelek felvétele és összekötése adatpontokkal</h3>
      <ol>
        <li>
          <strong>Új jel beolvasott gépből (ajánlott):</strong> válaszd ki az aktív sémát, majd kattints az{' '}
          <strong>Új jel gépadatpontból</strong> gombra. Válaszd ki a gépet és a még fel nem használt adatpontot — a
          rendszer automatikusan javasol egy azonosítót, magyar nevet és mértékegységet, amelyeket mentés előtt
          finomíthatsz.
        </li>
        <li>
          <strong>Kézi felvétel:</strong> kattints a <strong>Jel hozzáadása</strong> gombra, ha előre szeretnél közös
          magyar jelnevet rögzíteni. (A létrehozáskor megadott <strong>Jelazonosító</strong> később nem módosítható.)
        </li>
        <li>
          <strong>Összekötés a kiválasztott sémában:</strong> egy jel sorának jobb oldalán kattints az{' '}
          <strong>Adatpont hozzárendelése</strong> gombra (vagy a ceruza ikonra módosításkor). Választhatsz egy gép
          adatpontjai közül, vagy kézzel is beírhatod a <code>/</code> jellel kezdődő útvonalat.
        </li>
      </ol>

      <h3>3. Színek és mértékegységek</h3>
      <ul>
        <li>
          A sorok színe a szabványos gépcsoportokra utal (például kék: tengelyek, lila: vezérlő, zöld: rendszerek), hogy
          hosszú listában is könnyebb legyen tájékozódni.
        </li>
        <li>
          <strong>Megjelenítési mértékegységek:</strong> a jobb oldali gombra kattintva minden szabványos gép-egységkódhoz
          (pl. <code>MILLIMETER</code>, <code>REVOLUTION/MINUTE</code>) megadhatsz rövid magyar vagy műszaki címkét (pl.{' '}
          <code>mm</code>, <code>rpm</code>). Ha üresen hagyod, az eredeti kód jelenik meg.
        </li>
      </ul>

      <Callout kind="warning" title="Eltérő mértékegység és védett törlés">
        Ha egy gép adatpontjának egysége eltér a katalógusban mentett jel egységétől, a felület figyelmeztetést ad, és
        nem írja felül a közös jelet — ilyenkor érdemes külön jelet felvenni. Olyan jel nem törölhető, amelyet még
        használ valamelyik séma vagy dashboard; séma pedig addig nem törölhető, amíg gép van hozzá rendelve.
      </Callout>
    </div>
  );
}

function EditorSection() {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        A <strong>Dashboard szerkesztő</strong> oldalon állíthatod össze, hogy egy adott gép Monitoring nézetében milyen
        adatok, milyen grafikonokkal és műszerekkel jelenjenek meg. Egy géphez több külön dashboardot is létrehozhatsz
        (például egy áttekintő és egy diagnosztikai nézetet).
      </p>
      <EditorGuideVisual />

      <h3>Dashboard létrehozása vagy másolása</h3>
      <ol>
        <li>Nyisd meg a <strong>Dashboard szerkesztő</strong> oldalt, és kattints a beállítani kívánt gépre.</li>
        <li>Kattints a <strong>Dashboard hozzáadása</strong> gombra.</li>
        <li>Add meg az új dashboard nevét.</li>
        <li>
          A <strong>Kiindulás</strong> listában választhatsz üres dashboardot, vagy átmásolhatod egy azonos sémájú gép
          már kész dashboardját (a másolás csak a célgépen is létező adatpontokat veszi át).
        </li>
      </ol>

      <h3>Panelek hozzáadása és testreszabása</h3>
      <ol>
        <li>Nyisd le a kívánt kategóriát (<strong>Állapot</strong>, <strong>Aktuális érték</strong>, <strong>Műszer</strong> vagy <strong>Grafikon</strong>), és kattints a <strong>Panel hozzáadása</strong> kártyára.</li>
        <li>Válaszd ki a <strong>Jel a katalógusból</strong> listából a megjelenítendő mérést (csak az adott géphez feloldható jelek jelennek meg).</li>
        <li>Opcionálisan adj egyedi <strong>Megjelenített név</strong>-et (üresen hagyva a katalógus nevét használja).</li>
        <li>
          Állítsd be a kategória speciális opcióit:
          <ul>
            <li><strong>Állapot</strong> nézetnél bekapcsolhatod az <strong>Állapotidősor megjelenítése</strong> kapcsolót, amely színes idővonalat rajzol az aktuális állapot alá.</li>
            <li><strong>Műszer</strong> nézetnél kötelező megadni a <strong>Minimum</strong> és <strong>Maximum</strong> értéket.</li>
            <li><strong>Grafikon</strong> nézetnél kiválaszthatod a <strong>Vonalszín</strong>-t.</li>
          </ul>
        </li>
        <li>Kattints a <strong>Módosítások átvétele</strong> gombra.</li>
        <li>A kártyákon lévő bal/jobb nyilakkal állíthatod a panelek megjelenési sorrendjét.</li>
        <li>Végül kattints a <strong>Dashboard mentése</strong> gombra, majd a <strong>Monitoring megnyitása</strong> gombbal rögtön meg is nézheted az eredményt.</li>
      </ol>

      <Callout kind="tip" title="Nincs adatgyűjtési szünet">
        A dashboardok mentése, átnevezése vagy törlése azonnali, és <strong>nem indítja újra az adatgyűjtőt</strong>.
      </Callout>
    </div>
  );
}

function AccessSection() {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>
        A rendszer három egyértelműen elhatárolt jogosultsági szinttel működik:
      </p>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Szerepkör</th>
              <th>Mit lát és mit tehet?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Megtekintő (Viewer / vendég)</strong></td>
              <td>Megnézheti a <strong>Kezdőlap</strong>, <strong>Géppark</strong> és <strong>Monitoring</strong> oldalakat, letölthet adatokat az <strong>Adatexport</strong> oldalon, és olvashatja a saját szintjéhez tartozó használati útmutatót.</td>
            </tr>
            <tr>
              <td><strong>KFGyR kezelő</strong></td>
              <td>Minden megtekintői jog mellett beállíthatja az <strong>Agentek és gépek</strong>, a <strong>Jelkatalógus</strong> és a <strong>Dashboard szerkesztő</strong> tartalmát, ugyanakkor nem módosíthatja a gyári Grafana-elrendezést.</td>
            </tr>
            <tr>
              <td><strong>Adminisztrátor</strong></td>
              <td>Teljes hozzáférés: kezeli a kezelői csapat tagjait a <strong>Jogosultságkezelés</strong> oldalon, valamint hozzáfér a plugin <strong>Relay kapcsolat</strong> beállításaihoz és a Grafana rendszeradminisztrációhoz.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <AccessGuideVisual />

      <h3>Kezelő felvétele vagy eltávolítása</h3>
      <ol>
        <li>Nyisd meg a Kezdőlapról a <strong>Jogosultságkezelés</strong> oldalt.</li>
        <li>A <strong>Felhasználó hozzáadása</strong> listából válaszd ki a bejelentkezett <em>Viewer</em> fiókot.</li>
        <li>Kattints a <strong>Hozzáadás</strong> gombra. Az új jog a felhasználó következő oldalbetöltésétől azonnal életbe lép.</li>
        <li>Jogosultság visszavonásához kattints az érintett név melletti <strong>Eltávolítás</strong> gombra, majd erősítsd meg.</li>
      </ol>

      <h3>Relay kapcsolat beállítási lap</h3>
      <p>
        A Grafana bővítmények között található <strong>KFGyR Monitoring → Relay kapcsolat</strong> fül mutatja az
        adatgyűjtő vezérlő elérési címét és kapcsolatát. Ha a telepítés központilag kezeli a kapcsolatot, az adatok itt
        csak megtekinthetők, viszont a teszt gombbal bármikor ellenőrizhető, hogy él-e az összeköttetés.
      </p>
    </div>
  );
}

function TasksSection({ access, goTo }: { access: Access; goTo: (id: string) => void }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <p>Gyors lépésgyűjtemény a leggyakoribb mindennapi kérdésekhez:</p>

      <div className={s.taskCard}>
        <h4>Hogyan nézzem vissza egy tegnapi vagy múlt heti műszak adatait?</h4>
        <ol>
          <li>Nyisd meg a <strong>Monitoring</strong> oldalt, és válaszd ki a gépet.</li>
          <li>Kattints a jobb felső sarokban az időválasztóra (alapból „Elmúlt 5 perc”), és állítsd be a kívánt napot és órát.</li>
          <li>Állítsd az automatikus frissítést kikapcsolt (<em>Off</em>) állásba, hogy az időablak ne ugorjon el nézelődés közben.</li>
        </ol>
      </div>

      <div className={s.taskCard}>
        <h4>Hogyan mentsem ki az adatokat magyar Excelbe?</h4>
        <ol>
          <li>Lépj az <ChapterLink id="adatexport" label="Adatexport" goTo={goTo} /> oldalra.</li>
          <li>Válaszd ki a gépet, az adatpontokat és az időszakot.</li>
          <li>A <strong>Formátum</strong> mezőben válaszd az <strong>Excelhez formázott CSV (pontosvesszővel)</strong> lehetőséget, majd kattints a <strong>CSV letöltése</strong> gombra.</li>
        </ol>
      </div>

      <div className={s.taskCard}>
        <h4>Miért látok „Nincs érték” vagy szaggatott vonalat egy grafikonon?</h4>
        <ul>
          <li>A gép jelenleg ki van kapcsolva vagy nem válaszol a hálózaton (ellenőrizd a felső <strong>Agent</strong> jelvényt).</li>
          <li>Ritkán változó jeleknél (például programnév vagy ritka állapotváltás) a kiválasztott 5 perces ablakban nem történt új adatváltozás; bővítsd az időablakot, vagy nézd meg a lap alján a <strong>Gyors adatpontnézegető</strong> táblázatot.</li>
        </ul>
      </div>

      {access.manage_plugin && (
        <>
          <div className={s.taskCard}>
            <h4>Milyen sorrendben kössek be egy teljesen új gépet?</h4>
            <ol>
              <li>Ha új géptípusról van szó, hozz létre neki egy sémát a <ChapterLink id="jelkatalogus" label="Jelkatalógus" goTo={goTo} /> oldalon (üresen vagy hasonló gép sémáját lemásolva).</li>
              <li>Az <ChapterLink id="agentek" label="Agentek és gépek" goTo={goTo} /> oldalon vedd fel az agentet (kézzel vagy <strong>Hálózati keresés</strong>-sel), nevezd el a gépet, rendeld hozzá a sémát, majd kattints a <strong>Mentés és alkalmazás</strong> gombra.</li>
              <li>Várj néhány másodpercet az első adatok beérkezésére, majd a <strong>Jelkatalógus</strong> oldalon az <strong>Új jel gépadatpontból</strong> gombbal kösd össze a gép tényleges adatpontjait a kívánt magyar jelnevekkel.</li>
              <li>A <ChapterLink id="dashboard-szerkeszto" label="Dashboard szerkesztő" goTo={goTo} /> oldalon hozz létre egy dashboardot a géphez (vagy másold le egy hasonló gépét), és mentsd el.</li>
            </ol>
          </div>

          <div className={s.taskCard}>
            <h4>A Hálózati keresés nem találja a gépet, mit tegyek?</h4>
            <ul>
              <li>Ellenőrizd, hogy a gép be van-e kapcsolva és ugyanazon a hálózaton van-e, mint az adatgyűjtő szerver.</li>
              <li>Ha a gép nem a szokásos portok egyikén (80, 443, 5000, 5001, 8080) vagy külön útvonalon érhető el, add meg a portot a kereső mezőben, vagy vedd fel a gépet kézzel az <strong>Agent hozzáadása</strong> gombbal.</li>
            </ul>
          </div>

          <div className={s.taskCard}>
            <h4>Miért nem engedi törölni a rendszer a jelet vagy a sémát?</h4>
            <p>
              Az adatok épsége érdekében a rendszer letiltja a törlést, amíg hivatkozás mutat rá. Jel törlése előtt
              vedd le a jelet az érintett dashboardokról és sémákból; séma törlése előtt válassz másik sémát az
              <strong>Agentek és gépek</strong> oldalon a hozzá rendelt gépeknek.
            </p>
          </div>
        </>
      )}

      {access.manage_access && (
        <div className={s.taskCard}>
          <h4>Hogyan adjak beállítási jogot egy új kollégának?</h4>
          <ol>
            <li>Kérd meg a kollégát, hogy regisztráljon vagy lépjen be egy saját fiókkal a Grafanába (az új fiókok automatikusan Megtekintő/Viewer jogot kapnak).</li>
            <li>Nyisd meg a <ChapterLink id="jogosultsagok" label="Jogosultságkezelés" goTo={goTo} /> oldalt, válaszd ki a nevét a listából, és kattints a <strong>Hozzáadás</strong> gombra.</li>
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
    summary: 'Mire való a rendszer, és mit tudsz elvégezni a jelenlegi hozzáféréseddel.',
    keywords: ['bevezetés', 'áttekintés', 'szerepkör', 'kezdés', 'jogosultság'],
    render: (access, goTo) => <IntroSection access={access} goTo={goTo} />,
  },
  {
    id: 'kezdolap',
    group: 'Bevezetés',
    title: 'A Kezdőlap és a navigáció használata',
    shortTitle: 'Kezdőlap',
    icon: 'home-alt',
    role: 'viewer',
    summary: 'A főmenü felépítése és visszalépés bármelyik oldalról.',
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
    summary: 'Az összes gép gyors áttekintése egy képernyőn állapot-színekkel és műszerekkel.',
    keywords: ['géppark', 'kártya', 'állapot', 'zöld', 'piros', 'sárga', 'műszer', 'tv'],
    render: (_access, goTo) => <FleetSection goTo={goTo} />,
  },
  {
    id: 'monitoring',
    group: 'Gépek figyelése és adatok',
    title: 'Részletes Monitoring nézet',
    shortTitle: 'Monitoring',
    icon: 'chart-line',
    role: 'viewer',
    summary: 'Élő és múltbeli gépkövetés, időablak választása, paneltípusok és gyors adatpont-táblázat.',
    keywords: ['monitoring', 'grafikon', 'idősor', 'állapotidősor', 'gyors adatpontnézegető', 'időablak', 'frissítés'],
    render: (access) => <MonitoringSection access={access} />,
  },
  {
    id: 'adatexport',
    group: 'Gépek figyelése és adatok',
    title: 'Adatok letöltése (Adatexport)',
    shortTitle: 'Adatexport',
    icon: 'download-alt',
    role: 'viewer',
    summary: 'Múltbeli mérések kimentése CSV vagy magyar Excel fájlba.',
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
    summary: 'Gépek hálózati megkeresése, bekötése, elnevezése, szüneteltetése és visszaállítása.',
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
    summary: 'Magyar jelnevek, gépsémák másolása és összekötése, valamint a mértékegységek testreszabása.',
    keywords: ['jelkatalógus', 'séma', 'mértékegység', 'másolás', 'hozzárendelés', 'színek'],
    render: () => <CatalogSection />,
  },
  {
    id: 'dashboard-szerkeszto',
    group: 'Rendszer beállítása',
    title: 'Dashboard szerkesztő',
    shortTitle: 'Dashboard szerkesztő',
    icon: 'sliders-v-alt',
    role: 'operator',
    summary: 'Gépenként több dashboard létrehozása, panelek felvétele, rendezése és másolása.',
    keywords: ['dashboard szerkesztő', 'panel', 'műszer', 'állapotidősor', 'vonalszín', 'sorrend'],
    render: () => <EditorSection />,
  },
  {
    id: 'jogosultsagok',
    group: 'Adminisztráció',
    title: 'Jogosultságkezelés és kapcsolat',
    shortTitle: 'Jogosultságkezelés',
    icon: 'users-alt',
    role: 'admin',
    summary: 'A három szerepkör, a KFGyR kezelők csapatának karbantartása és a Relay kapcsolat ellenőrzése.',
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
    summary: 'Gyors válaszok és lépésről lépésre receptek a mindennapi kérdésekhez.',
    keywords: ['gyakori', 'hiba', 'nincs adat', 'új gép', 'sorrend', 'excel', 'segítség'],
    render: (access, goTo) => <TasksSection access={access} goTo={goTo} />,
  },
];

export function visibleChapters(access: Access): GuideChapter[] {
  return guideChapters.filter((chapter) => canSeeRole(chapter.role, access));
}
