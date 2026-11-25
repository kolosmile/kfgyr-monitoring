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
    textAlign: 'left',
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
    '& h3': { margin: 0, fontSize: 15.5, fontWeight: 600 },
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
              <td>Egy kiválasztott gép élő és visszakereshető nézete grafikonokkal, állapotokkal és adatpontlistával.</td>
            </tr>
            <tr>
              <td><ChapterLink id="adatexport" label="Adatexport" goTo={goTo} /></td>
              <td>Kiválasztott gépek adatpontjainak letöltése vesszős vagy Excelhez formázott, pontosvesszős CSV-fájlba.</td>
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
        A KFGyR oldalain, a Gépparkban és a Monitoringban a <UiTag label="Kezdőlap" /> gomb vezet vissza a főmenüre.
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
          A középső rész az első hat állapotpanel, az alsó sor az első három műszer utolsó értékét mutatja
          a panelnevekkel együtt. A Géppark a gép alapértelmezett dashboardjának panelsorrendjét követi.
        </li>
        <li>
          A kártya jobb alsó sarkában lévő <UiTag icon="external-link-alt" label="Megnyitás a Monitoringban" /> ikonra
          kattintva az adott gép alapértelmezett dashboardja nyílik meg a Monitoringban.
        </li>
      </ul>

      <h3>Az agent és a gép állapotjelzése</h3>
      <p>Az agent neve zöld, ha az agent válaszol, piros, ha nem érhető el, és szürke, ha az elérhetősége ismeretlen.</p>
      <p>Az egyes gépállapotok külön színjelzést kapnak.</p>
      <div className={s.badgeRow}>
        <Badge color="green" text="AVAILABLE / ACTIVE / NORMAL — rendben" />
        <Badge color="orange" text="WARNING — figyelmeztetés" />
        <Badge color="red" text="UNAVAILABLE / FAULT / ALARM — hiba vagy nem elérhető" />
      </div>

      <Callout kind="tip" title="Részletes trendek">
        A múltbeli grafikonok és a teljes adatpontlista a Monitoringban érhetők el. A használatukról az útmutató{' '}
        <ChapterLink id="monitoring" label="Monitoring" goTo={goTo} /> fejezete ad részleteket.
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
        A grafikonok és az időszakhoz kötött panelek kezdetben az elmúlt 5 percet mutatják. A nézet 5 másodpercenként frissül.
      </p>

      <h3>Gép és dashboard kiválasztása</h3>
      <ol>
        <li>A felső navigációs sávban először az <strong>Agent</strong>, majd a <strong>Gép</strong> választható ki.</li>
        <li>Gépváltáskor az alapértelmezett dashboard nyílik meg. A <strong>Dashboard</strong> választóban lehet másik nézetre váltani.</li>
        <li>Mobilon a gép nevére koppintva nyílik meg az agent-, gép- és dashboardválasztó.</li>
      </ol>

      <h3>Agent-elérhetőség jelzése</h3>
      <div className={s.badgeRow}>
        <Badge color="green" text="Agent elérhető" />
        <Badge color="red" text="Agent nem elérhető" />
        <Badge color="darkgrey" text="Agent elérhetősége ismeretlen" />
      </div>
      <p>
        A jelvény az agent élő válaszát ellenőrzi. Piros jelzésnél az agent nem érhető el. Szürke lehet akkor is,
        ha az agent válaszol, de a kiválasztott gép nem szerepel a válaszában. Mobilon a jelvény a választóablakban látható.
      </p>

      <h3>Időszak és paneltípusok</h3>
      <ul>
        <li>A jobb felső időválasztóval az adatmegőrzési időn belüli korábbi időszakok is vizsgálhatók. Az automatikus frissítés ugyanitt állítható.</li>
        <li><strong>Állapot:</strong> nagy szöveges kártya; ha engedélyezve van, alatta színes idővonal mutatja az állapotváltásokat.</li>
        <li><strong>Aktuális érték:</strong> az utoljára mért számérték a beállított mértékegységgel.</li>
        <li><strong>Műszer:</strong> az utolsó tárolt számérték félköríves skálán, a megadott minimum és maximum között.</li>
        <li><strong>Grafikon:</strong> idősoros görbe a kiválasztott időablakra.</li>
        <li>
          <strong>Gyors adatpontnézegető:</strong> a lap alján lévő kereshető táblázat a gép összes adatpontjának
          utolsó, az időablakon belüli értékét sorolja fel.
        </li>
      </ul>
      <p>Az Állapot, az Aktuális érték és a Műszer az utolsó tárolt értéket az időablakon kívülről is megjelenítheti.</p>

      {access.manage_plugin && (
        <Callout kind="tip" title="Közvetlen szerkesztés">
          A <UiTag icon="pen" label="Dashboard szerkesztése" /> az aktuális dashboard Panelszerkesztőjét nyitja meg.
          Ha a géphez még nincs dashboard, a <UiTag icon="plus" label="Dashboard hozzáadása" /> a létrehozó ablakhoz vezet.
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
        Az <strong>Adatexport</strong> oldalon CSV-fájlként tölthetők le a gépek korábbi mérései saját elemzéshez vagy
        Excelben való megnyitáshoz.
      </p>

      <h3>Letöltés lépései</h3>
      <ol>
        <li>A <strong>Gépek</strong> listában egy vagy több gép jelölhető ki (gépeléssel a lista szűrhető).</li>
        <li>
          Az <strong>Adatpontok</strong> mezőben kiválaszthatók a kívánt adatpontok. Az{' '}
          <UiTag label="Összes adatpont kijelölése" /> gomb minden elérhető adatpontot kijelöl.
        </li>
        <li>A <strong>Kezdőidő</strong> és a <strong>Végidő</strong> a helyi időzónában adható meg.</li>
        <li>
          A <strong>Sorkorlát</strong> (legfeljebb 100 000 sor) és a <strong>Formátum</strong> kiválasztása:
          <ul>
            <li><strong>CSV (vesszővel):</strong> általános adatfeldolgozáshoz.</li>
            <li><strong>Excelhez formázott CSV (pontosvesszővel):</strong> pontosvesszővel és Excelhez illesztett UTF-8 kódolással készül.</li>
          </ul>
        </li>
        <li>A <UiTag icon="download-alt" label="CSV letöltése" /> gombra kattintva indul el a fájl letöltése.</li>
        <li>Ha az Excel egyetlen oszlopban jeleníti meg az adatokat, a szöveg- vagy CSV-importnál a pontosvesszőt kell megadni elválasztóként.</li>
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

      <h3>Új agent keresése vagy kézi megadása</h3>
      <ul>
        <li>
          <strong>Hálózati kereséssel.</strong> A <UiTag icon="search" label="Hálózati keresés" /> ablakban ki kell választani
          a hálózati tartományt és a vizsgált portokat, majd a <UiTag label="Keresés indítása" /> gombot.
          A felvétel a találat melletti <UiTag label="Agent beállítása" /> gombbal folytatható.
        </li>
        <li>
          <strong>Kézzel.</strong> Az <UiTag icon="plus" label="Agent hozzáadása" /> ablakban megadható az egyedi név
          és az agent címe, a porttal és szükség esetén az URL-útvonallal együtt.
        </li>
      </ul>
      <h3>A gépek összerendelése és mentése</h3>
      <ol>
        <li>Ha a gépek listája még üres, a <UiTag icon="search" label="Kapcsolat és eszközkeresés" /> gombbal tölthető be.</li>
        <li>Minden megtalált gépnél megadható egy <strong>Megjelenítési név</strong>, és kiválasztható egy <strong>Séma</strong>.</li>
        <li>A <UiTag icon="check" label="Hozzáadás a listához" /> gombra kattintva előkészíthető a módosítás.</li>
        <li>Végül a lap alján megjelenő sávban a <UiTag label="Mentés és alkalmazás" /> gombra kattintva menthető és élesíthető a lista.</li>
      </ol>

      <Callout kind="warning" title="Kötelező sémaválasztás">
        Gép csak kiválasztott sémával menthető. Ha még nincs megfelelő séma, előbb a{' '}
        <ChapterLink id="jelkatalogus" label="Jelkatalógus" goTo={goTo} /> oldalon kell létrehozni.
      </Callout>

      <h3>Szüneteltetés, eltávolítás és visszaállítás</h3>
      <ul>
        <li>
          <strong>Szüneteltetés:</strong> a <UiTag icon="pen" label="Szerkesztés" /> ablakban az{' '}
          <strong>Agent engedélyezve</strong> kapcsoló kikapcsolásával, majd mentéssel állítható le az új adatok
          gyűjtése. A már tárolt múltbeli adatok megmaradnak.
        </li>
        <li>
          <strong>Eltávolítás:</strong> az <UiTag icon="trash-alt" label="Eltávolítás a listából" /> után a
          <strong> Mentés és alkalmazás</strong> összesítője felsorolja az érintett agenteket. A sikeres alkalmazás
          végleg törli a hozzájuk tartozó gépek mentett adatait és dashboardjait. A konfiguráció visszaállítása
          ezeket nem állítja helyre.
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
      <p>A <strong>Sémák</strong> kártyán a <strong>Hozzárendelve</strong> lista mutatja, mely gépek használják az aktív
        sémát. A <strong>Csak a hozzárendelt jelek</strong> jelölőnégyzet a mentett útvonallal rendelkező jelekre szűkíti
        a táblázatot. Asztali nézetben a keresők és a hozzáadási lehetőségek a görgethető sorok fölött maradnak.
        Ha van elég találat, a lista legalább öt sor magas. A széleken látható halványítás jelzi, merre van még további sor.</p>
      <p>A gépadatpontok legördülő listájában útvonalra és gépi névre (például <code>Srpm</code>) is kereshetsz.
        A sématáblázatban a hozzárendelt útvonal jelenik meg.</p>
      <p>Az <strong>Ellenőrzés gépen</strong> kártyán kiválaszthatsz egy gépet, és láthatod, hány hozzárendelés
        oldható fel a mentett adatpontjai alapján. A <strong>Csak az eltérések</strong> kapcsoló a sárgával jelölt
        sorokat mutatja. Ha több gép használja a sémát, egyedi eltéréshez klónozd, majd ellenőrizd a célgépen.</p>
      <ul>
        <li>
          <strong>Meglévő jel.</strong> Az aktív sémában a jel sorának jobb oldalán az{' '}
          <UiTag icon="plus" label="Adatpont hozzárendelése" /> gombbal választható ki a gép és az adatpont.
          Kézzel is megadható a gépen belüli, <code>/</code> jellel kezdődő útvonal.
        </li>
        <li>
          <strong>Kiindulás gépadatpontból.</strong> A <UiTag icon="plus" label="Gépadatpont felvétele" /> ablakban először
          a gépet és egy szabad adatpontot válassz. A <strong>Meglévő jel</strong> opció egy katalógusjelhez rendeli az
          útvonalat az aktív sémában. Ha a jelnek már van útvonala, mentés előtt látszik, melyiket cseréled le.
          Az <strong>Új jel</strong> opció nevet, azonosítót és mértékegységet javasol.
        </li>
        <li>
          <strong>Új jel hozzárendelés nélkül.</strong> A <UiTag icon="plus" label="Jel hozzáadása" /> gombbal előre is
          felvehető jel. A <strong>Jelazonosító</strong> létrehozás után nem módosítható.
        </li>
      </ul>

      <h3>Színjelölés és megjelenítési mértékegységek</h3>
      <ul>
        <li>A színezett jelnevek és útvonalak szabványos komponenságat jelölnek, például tengelyeket, vezérlőt vagy rendszereket.</li>
        <li>
          A <UiTag icon="calculator-alt" label="Megjelenítési mértékegységek" /> gombra kattintva megnyíló ablakban a gép
          nyers kódjaihoz (pl. <code>REVOLUTION/MINUTE</code>) rövid, olvasható felirat (pl. <code>rpm</code>) adható
          meg.
        </li>
      </ul>

      <Callout kind="warning" title="Védett törlés és eltérő mértékegység">
        Gépből választott, eltérő mértékegységű adatpontnál a rendszer figyelmeztet, és nem írja felül a jel mentett
        egységét. Sémában vagy dashboardon használt jel, illetve géphez rendelt séma nem törölhető a hivatkozások
        eltávolításáig.
      </Callout>
    </div>
  );
}

function EditorSection({ goTo }: { goTo: (id: string) => void }) {
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
        <li>Másoláskor az előnézet kiírja, hány panel vihető át, és felsorolja a kimaradó panelek nevét és típusát.</li>
        <li>A <UiTag label="Létrehozás" /> gomb menti a dashboardot és megnyitja a Panelszerkesztőt.</li>
      </ol>

      <h3>Az alapértelmezett dashboard kiválasztása</h3>
      <p>
        A gép első dashboardja automatikusan alapértelmezett lesz. A <strong>Dashboardok</strong> listában a kitöltött,
        sárga csillag jelöli az alapértelmezett nézetet. Egy másik kártya körvonalas csillagára kattintva azonnal menthető
        a választás. A Géppark ezt a nézetet használja, és a Monitoringban gépváltáskor is ez nyílik meg.
      </p>

      <h3>Panelek beállítása és mentése</h3>
      <ol>
        <li>A kívánt nézetcsoport (<strong>Állapot</strong>, <strong>Aktuális érték</strong>, <strong>Műszer</strong> vagy <strong>Grafikon</strong>) lenyitása után a <UiTag icon="plus" label="Panel hozzáadása" /> kártyára kattintva vehető fel új panel.</li>
        <li>A <strong>Jel a katalógusból</strong> listában az adott gép sémájában hozzárendelt, a gépen ténylegesen elérhető adatponttal rendelkező jelek választhatók. A panelhez egyedi név is megadható.</li>
        <li>
          A nézet opcióinak beállítása:
          <ul>
            <li><strong>Állapot:</strong> az <strong>Állapotidősor megjelenítése</strong> kapcsolóval színes idővonal adható az állapotkártya alá.</li>
            <li><strong>Műszer:</strong> kötelező megadni a <strong>Minimum</strong> és <strong>Maximum</strong> értéket.</li>
            <li><strong>Grafikon:</strong> választható <strong>Vonalszín</strong>.</li>
          </ul>
        </li>
        <li>A <UiTag label="Módosítások átvétele" /> gombra kattintva a panel bekerül a nézetbe, majd a kártyák nyilaival a panelek sorrendje rendezhető.</li>
        <li>A <UiTag icon="save" label="Dashboard mentése" /> gombra kattintva menthető a beállítás; az eredmény a <UiTag icon="chart-line" label="Monitoring megnyitása" /> gombra kattintva tekinthető meg.</li>
      </ol>

      <Callout kind="warning" title="Elérhetetlen adatpontok">
        A sárga keret jelöli az érintett kategóriákat és paneleket. A panelben másik jelet választhatsz, vagy a
        {' '}<ChapterLink id="jelkatalogus" label="Jelkatalógusban" goTo={goTo} /> javíthatod a gép sémájában a
        jel adatpont-hozzárendelését.
      </Callout>

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
        <li>A <UiTag icon="plus" label="Hozzáadás" /> gombbal adható meg a jogosultság.</li>
        <li>A jogosultság visszavonásához a név mellett az <UiTag icon="trash-alt" label="Eltávolítás" /> gombot kell választani, majd megerősíteni.</li>
      </ol>

      <h3>Relay kapcsolat beállítása</h3>
      <p>
        A Grafana bővítmény beállításainál a <strong>KFGyR Monitoring → Relay kapcsolat</strong> fülön ellenőrizhető a
        háttérkapcsolat állapota és tesztelhető az összeköttetés. A kezelt telepítésen a címet és a tokent
        a telepítési beállítások kezelik.
      </p>
    </div>
  );
}

function TasksSection({ access, goTo }: { access: Access; goTo: (id: string) => void }) {
  const s = useStyles2(getStyles);
  return (
    <div className={s.body}>
      <div className={s.taskBlock}>
        <h3>Korábbi műszak adatainak visszanézése</h3>
        <ol>
          <li>A <strong>Monitoring</strong> oldalon a kívánt gép és dashboard kiválasztása.</li>
          <li>A jobb felső időválasztóban a műszak pontos kezdő- és végidejének megadása.</li>
          <li>A műszak adatainak ellenőrzése a grafikonon, a bekapcsolt állapotidősoron vagy a Gyors adatpontnézegetőben.</li>
        </ol>
        <p>Relatív időtartomány használatakor az automatikus frissítés kikapcsolásával (<em>Off</em>) rögzíthető az aktuális nézet.</p>
      </div>

      <div className={s.taskBlock}>
        <h3>Adatok megnyitása Excelben</h3>
        <ol>
          <li>A Kezdőlapról az <strong>Adatexport</strong> megnyitása, majd a gépek, adatpontok és az időszak kiválasztása.</li>
          <li>Az <strong>Excelhez formázott CSV (pontosvesszővel)</strong> formátum kiválasztása.</li>
          <li>A <UiTag icon="download-alt" label="CSV letöltése" /> gomb kiválasztása és a fájl megnyitása Excelben.</li>
          <li>Ha minden adat egy oszlopba kerül, a fájl újraimportálása pontosvesszős elválasztással.</li>
        </ol>
        <p>Az UTC-időbélyegekről és a sorkorlátról az útmutató <ChapterLink id="adatexport" label="Adatexport" goTo={goTo} /> fejezete ad részleteket.</p>
      </div>

      <div className={s.taskBlock}>
        <h3>Hiányzó érték vagy szaggatott grafikon</h3>
        <ul>
          <li>A piros jelvény azt jelenti, hogy az agent nem érhető el. Egy zöld jelvény mellett is lehet hiányzó minta.</li>
          <li>Ritkán változó adatpontnál érdemes hosszabb időszakot választani. A <strong>Gyors adatpontnézegető</strong> csak a kiválasztott időszakban keres mintát.</li>
          <li>Ha az állapotkártyán még látható érték, az lehet a korábban tárolt utolsó minta.</li>
        </ul>
      </div>

      {access.manage_plugin && (
        <>
          <div className={s.taskBlock}>
            <h3>Új gép bekötésének ajánlott sorrendje</h3>
            <ol>
              <li>Meglévő gépséma kiválasztása, vagy új séma létrehozása a <strong>Jelkatalógusban</strong>.</li>
              <li>Az <strong>Agentek és gépek</strong> oldalon új agent felvétele hálózati kereséssel vagy kézzel. Már felvett agentnél a <strong>Szerkesztés</strong> megnyitása.</li>
              <li>A gép elnevezése és a séma hozzárendelése az agent szerkesztőablakában.</li>
              <li>A módosítás listába tétele, majd a <UiTag label="Mentés és alkalmazás" /> kiválasztása a főoldalon.</li>
              <li>Az adatpontok beolvasása után a <UiTag icon="plus" label="Gépadatpont felvétele" /> ablakban a szabad adatponthoz meglévő jelet választhatsz, vagy újat hozhatsz létre.</li>
              <li>A gép dashboardjának létrehozása és mentése a <strong>Dashboard szerkesztőben</strong>.</li>
            </ol>
            <p>A felvétel és a mentés részletei az útmutató <ChapterLink id="agentek" label="Agentek és gépek" goTo={goTo} /> fejezetében olvashatók.</p>
          </div>

          <div className={s.taskBlock}>
            <h3>A hálózati keresés nem találja az agentet</h3>
            <ul>
              <li>Ellenőrizendő, hogy az agent fut-e, és a relay felől elérhető-e az engedélyezett hálózaton.</li>
              <li>A port hozzáadható a <strong>Vizsgált portok</strong> listájához. Külön URL-útvonalnál az <UiTag icon="plus" label="Agent hozzáadása" /> ablakban adható meg a teljes cím.</li>
              <li>A kézzel megadott cím a <UiTag icon="search" label="Kapcsolat és eszközkeresés" /> gombbal ellenőrizhető.</li>
            </ul>
          </div>

          <div className={s.taskBlock}>
            <h3>Egy jel nem választható a Panelszerkesztőben</h3>
            <ul>
              <li>Az <strong>Agentek és gépek</strong> oldalon ellenőrizhető, melyik séma tartozik a géphez.</li>
              <li>A <strong>Jelkatalógusban</strong> ennél a sémánál kell ellenőrizni a jel adatpont-hozzárendelését.</li>
              <li>A jel csak akkor jelenik meg a listában, ha a hozzárendelt adatpontot a rendszer már beolvasta az adott gépről.</li>
            </ul>
          </div>

          <div className={s.taskBlock}>
            <h3>A Gépparkban látható értékek módosítása</h3>
            <ol>
              <li>A <strong>Dashboard szerkesztőben</strong> a megfelelő gép kiválasztása.</li>
              <li>A Gépparkhoz használni kívánt dashboard kijelölése a kártya csillagával.</li>
              <li>A kijelölt dashboard megnyitása, majd az első hat állapot és az első három műszer sorrendjének beállítása a kártyák nyilaival.</li>
              <li>A <UiTag icon="save" label="Dashboard mentése" /> gomb kiválasztása.</li>
            </ol>
          </div>

          <div className={s.taskBlock}>
            <h3>Jel vagy séma nem törölhető</h3>
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
          <h3>Kezelői jogosultság adása új kollégának</h3>
          <ol>
            <li>Ellenőrizendő, hogy a kollégának van-e <strong>Viewer</strong> fiókja a Grafana megfelelő szervezetében.</li>
            <li>A Kezdőlapról a <strong>Jogosultságkezelés</strong> megnyitása és a felhasználó kiválasztása.</li>
            <li>A <UiTag icon="plus" label="Hozzáadás" /> gomb kiválasztása.</li>
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
    title: 'A Géppark áttekintése',
    shortTitle: 'Géppark',
    icon: 'apps',
    role: 'viewer',
    summary: 'Gépkártyák állapotszínekkel és műszerekkel.',
    keywords: ['géppark', 'kártya', 'állapot', 'zöld', 'piros', 'sárga', 'műszer'],
    render: (_access, goTo) => <FleetSection goTo={goTo} />,
  },
  {
    id: 'monitoring',
    group: 'Gépek figyelése és adatok',
    title: 'A Monitoring részletes nézete',
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
    summary: 'Múltbeli mérések letöltése vesszős vagy Excelhez formázott CSV-fájlba.',
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
    render: (_access, goTo) => <EditorSection goTo={goTo} />,
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
    keywords: ['gyakori', 'hiba', 'nincs adat', 'új gép', 'excel', 'géppark', 'alapértelmezett', 'nem választható jel'],
    render: (access, goTo) => <TasksSection access={access} goTo={goTo} />,
  },
];

export function visibleChapters(access: Access): GuideChapter[] {
  return guideChapters.filter((chapter) => canSeeRole(chapter.role, access));
}
