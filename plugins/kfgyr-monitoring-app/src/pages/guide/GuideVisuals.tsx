import React from 'react';
import { css } from '@emotion/css';
import type { GrafanaTheme2 } from '@grafana/data';
import { Badge, Icon, useStyles2 } from '@grafana/ui';
import type { Access } from '../../access';

type LegendItem = { n: number; label: string; text: string };

const getStyles = (theme: GrafanaTheme2) => {
  const accent = theme.isDark ? '#ff9830' : '#d45b00';
  const accentSoft = theme.isDark ? 'rgba(255, 152, 48, 0.12)' : 'rgba(212, 91, 0, 0.08)';
  const frameBorder = theme.colors.border.medium;
  return {
    figure: css({
      margin: '18px 0 22px',
      border: `1px solid ${frameBorder}`,
      borderRadius: 10,
      background: theme.colors.background.secondary,
      overflow: 'hidden',
    }),
    captionBar: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '9px 14px',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      fontSize: 12,
      fontWeight: 600,
      color: theme.colors.text.secondary,
    }),
    canvas: css({
      padding: 14,
      display: 'grid',
      gap: 10,
    }),
    legend: css({
      margin: 0,
      padding: '12px 14px',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      listStyle: 'none',
      display: 'grid',
      gap: 7,
      fontSize: 13,
      lineHeight: 1.45,
    }),
    legendItem: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
    }),
    pin: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: accent,
      color: '#ffffff',
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1,
      boxShadow: `0 0 0 2px ${theme.colors.background.primary}`,
    }),
    spot: css({
      position: 'relative',
      border: `1.5px dashed ${accent}`,
      background: accentSoft,
      borderRadius: 8,
      padding: 10,
      display: 'grid',
      gap: 8,
    }),
    spotInline: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 8px',
      border: `1.5px solid ${accent}`,
      borderRadius: 6,
      background: theme.colors.background.primary,
      fontSize: 12,
      fontWeight: 500,
    }),
    row: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 8,
    }),
    stack: css({ display: 'grid', gap: 6 }),
    panel: css({
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: 8,
      background: theme.colors.background.primary,
      padding: 10,
      display: 'grid',
      gap: 6,
    }),
    menuCard: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '7px 10px',
      borderRadius: 8,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      fontSize: 13,
      fontWeight: 500,
    }),
    sectionTitle: css({
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: theme.colors.text.secondary,
    }),
    twoCol: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 10,
    }),
    threeCol: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: 8,
    }),
    stateGrid: css({
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 6,
      fontSize: 12,
      fontWeight: 600,
    }),
    ok: css({ color: theme.colors.success.text }),
    warn: css({ color: theme.colors.warning.text }),
    err: css({ color: theme.colors.error.text }),
    muted: css({ color: theme.colors.text.secondary, fontSize: 12 }),
    axisBar: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '6px 8px',
      borderRadius: 6,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      fontSize: 12,
    }),
    branchAxis: css({ color: theme.isDark ? '#8dbcf5' : '#255a9b', fontWeight: 600 }),
    branchCtrl: css({ color: theme.isDark ? '#cbb3f4' : '#70409f', fontWeight: 600 }),
    miniChart: css({
      height: 46,
      borderRadius: 6,
      border: `1px solid ${theme.colors.border.weak}`,
      background: `linear-gradient(180deg, ${theme.colors.primary.transparent} 0%, transparent 100%)`,
      display: 'flex',
      alignItems: 'flex-end',
      padding: '0 8px 6px',
      fontSize: 11,
      color: theme.colors.text.secondary,
    }),
    fakeInput: css({
      padding: '5px 8px',
      borderRadius: 4,
      border: `1px solid ${theme.colors.border.medium}`,
      background: theme.colors.background.primary,
      fontSize: 12,
      color: theme.colors.text.primary,
    }),
    fakeButton: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '5px 10px',
      borderRadius: 4,
      background: theme.colors.primary.main,
      color: theme.colors.primary.contrastText,
      fontSize: 12,
      fontWeight: 600,
    }),
    fakeButtonSec: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '5px 10px',
      borderRadius: 4,
      border: `1px solid ${theme.colors.border.medium}`,
      background: theme.colors.background.secondary,
      color: theme.colors.text.primary,
      fontSize: 12,
      fontWeight: 500,
    }),
  };
};

function Pin({ n }: { n: number }) {
  const s = useStyles2(getStyles);
  return (
    <span className={s.pin} aria-hidden="true">
      {n}
    </span>
  );
}

function VisualFrame({ title, children, legend }: { title: string; children: React.ReactNode; legend: LegendItem[] }) {
  const s = useStyles2(getStyles);
  return (
    <figure className={s.figure}>
      <figcaption className={s.captionBar}>
        <span>{title}</span>
        <span>Jelölt felületrészlet</span>
      </figcaption>
      <div className={s.canvas}>{children}</div>
      <ol className={s.legend}>
        {legend.map((item) => (
          <li key={item.n} className={s.legendItem}>
            <Pin n={item.n} />
            <div>
              <strong>{item.label}:</strong> {item.text}
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function HomeGuideVisual({ access }: { access: Access }) {
  const s = useStyles2(getStyles);
  const legend: LegendItem[] = [
    { n: 1, label: 'Eszközök csoport', text: 'Minden felhasználó számára nyitott: élő gépfigyelés, géppark-áttekintő és CSV-letöltés.' },
  ];
  if (access.manage_plugin) {
    legend.push({
      n: 2,
      label: 'Beállítások csoport',
      text: 'Csak KFGyR kezelők és adminisztrátorok látják: gépek bekötése, dashboardok és jelnevek beállítása.',
    });
  }
  if (access.manage_access) {
    legend.push({
      n: 3,
      label: 'Jogosultságkezelés',
      text: 'Kizárólag adminisztrátor számára látható kártya a kezelői csapat tagjainak felvételéhez.',
    });
  }
  const docsPin = access.manage_access ? 4 : access.manage_plugin ? 3 : 2;
  legend.push({
    n: docsPin,
    label: 'Dokumentáció',
    text: 'Ezt a beépített használati útmutatót nyitja meg.',
  });

  return (
    <VisualFrame title="Kezdőlap — főmenü elrendezése" legend={legend}>
      <div className={s.spot}>
        <div className={s.row}>
          <span className={s.sectionTitle}>Eszközök</span>
          <Pin n={1} />
        </div>
        <div className={s.threeCol}>
          <div className={s.menuCard}><span><Icon name="chart-line" /> Monitoring</span><Icon name="angle-right" /></div>
          <div className={s.menuCard}><span><Icon name="apps" /> Géppark</span><Icon name="angle-right" /></div>
          <div className={s.menuCard}><span><Icon name="download-alt" /> Adatexport</span><Icon name="angle-right" /></div>
        </div>
      </div>
      {access.manage_plugin && (
        <div className={s.spot}>
          <div className={s.row}>
            <span className={s.sectionTitle}>Beállítások</span>
            <Pin n={2} />
          </div>
          <div className={s.twoCol}>
            <div className={s.menuCard}><span><Icon name="plug" /> Agentek és gépek</span><Icon name="angle-right" /></div>
            <div className={s.menuCard}><span><Icon name="sliders-v-alt" /> Dashboard szerkesztő</span><Icon name="angle-right" /></div>
            <div className={s.menuCard}><span><Icon name="sitemap" /> Jelkatalógus</span><Icon name="angle-right" /></div>
            {access.manage_access && (
              <div className={s.spotInline}>
                <Pin n={3} />
                <Icon name="users-alt" />
                <span>Jogosultságkezelés</span>
              </div>
            )}
          </div>
        </div>
      )}
      <div className={s.spot}>
        <div className={s.row}>
          <span className={s.sectionTitle}>Dokumentáció</span>
          <Pin n={docsPin} />
        </div>
        <div className={s.menuCard}><span><Icon name="book-open" /> Használati útmutató</span><Icon name="angle-right" /></div>
      </div>
    </VisualFrame>
  );
}

export function FleetGuideVisual() {
  const s = useStyles2(getStyles);
  return (
    <VisualFrame
      title="Géppark — egy gépkártya elemei"
      legend={[
        { n: 1, label: 'Agent címke', text: 'Megmutatja, melyik adatgyűjtő kapcsolaton keresztül érkezik a gép adata.' },
        { n: 2, label: 'Gép neve', text: 'A berendezés beállított megjelenítési neve.' },
        { n: 3, label: 'Megnyitás a Monitoringban', text: 'Közvetlenül megnyitja a gép részletes Monitoring nézetét.' },
        { n: 4, label: 'Állapotok (max. 6 db)', text: 'Az alapértelmezett dashboard állapotértékei színnel jelezve (zöld: rendben, piros: hiba/nem elérhető).' },
        { n: 5, label: 'Műszerek (max. 3 db)', text: 'Félköríves mutatók az aktuális főbb mérőszámokkal és mértékegységekkel.' },
      ]}
    >
      <div className={s.panel} style={{ maxWidth: 360 }}>
        <div className={s.row}>
          <div className={s.stack}>
            <div className={s.spotInline}><Pin n={1} /><Badge color="blue" text="Műhely-1" /></div>
            <div className={s.spotInline}><Pin n={2} /><strong>CNC-01 Megmunkáló</strong></div>
          </div>
          <div className={s.spotInline}><Pin n={3} /><Icon name="external-link-alt" /></div>
        </div>
        <div className={s.spot}>
          <div className={s.row}><span className={s.muted}>Állapotok</span><Pin n={4} /></div>
          <div className={s.stateGrid}>
            <span className={s.ok}>AVAILABLE</span>
            <span className={s.ok}>ACTIVE</span>
            <span className={s.warn}>WARNING</span>
            <span className={s.err}>UNAVAILABLE</span>
          </div>
        </div>
        <div className={s.spot}>
          <div className={s.row}><span className={s.muted}>Műszerek</span><Pin n={5} /></div>
          <div className={s.threeCol}>
            <div className={s.panel}><strong>2 400 rpm</strong><span className={s.muted}>Főorsó</span></div>
            <div className={s.panel}><strong>42 %</strong><span className={s.muted}>Terhelés</span></div>
            <div className={s.panel}><strong>850 mm/perc</strong><span className={s.muted}>Előtolás</span></div>
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

export function MonitoringGuideVisual({ canEdit }: { canEdit: boolean }) {
  const s = useStyles2(getStyles);
  const legend: LegendItem[] = [
    { n: 1, label: 'Kezdőlap', text: 'Visszalépés a főmenüre.' },
    { n: 2, label: 'Agent / Gép / Dashboard választó', text: 'Itt válthatsz műhelyegységet, gépet és a géphez tartozó nézetet (pl. Áttekintés).' },
    { n: 3, label: 'Agent elérhetősége', text: 'Élő visszajelzés arról, hogy a gép adatforrása válaszol-e (zöld: elérhető, piros: nem elérhető).' },
    { n: 4, label: 'Időszak és automatikus frissítés', text: 'A felső sávban állítható a visszanézett időablak (alapértelmezetten az elmúlt 5 perc) és az 5 másodperces frissítés.' },
    { n: 5, label: 'Panelek és Gyors adatpontnézegető', text: 'Fent az állapotok, állapotidősorok, műszerek és grafikonok; legalul az összes adatpont kereshető táblázata.' },
  ];
  if (canEdit) {
    legend.push({
      n: 6,
      label: 'Dashboard szerkesztése',
      text: 'Közvetlen ugrás az éppen nézett gép dashboardjának szerkesztőjébe.',
    });
  }

  return (
    <VisualFrame title="KFGyR · Monitoring — felső navigáció és elrendezés" legend={legend}>
      <div className={s.panel}>
        <div className={s.row}>
          <div className={s.row}>
            <span className={s.spotInline}><Pin n={1} /><Icon name="home-alt" /> Kezdőlap</span>
            {canEdit && (
              <span className={s.spotInline}><Pin n={6} /><Icon name="pen" /> Dashboard szerkesztése</span>
            )}
            <span className={s.spotInline}><Pin n={2} /> Agent · Gép · Dashboard</span>
            <span className={s.spotInline}><Pin n={3} /><Badge color="green" text="Agent elérhető" /></span>
          </div>
          <span className={s.spotInline}><Pin n={4} /> Elmúlt 5 perc · 5s</span>
        </div>
      </div>
      <div className={s.spot}>
        <div className={s.row}>
          <span className={s.sectionTitle}>Állapot · Aktuális érték · Műszer · Grafikon · Gyors adatpontnézegető</span>
          <Pin n={5} />
        </div>
        <div className={s.threeCol}>
          <div className={s.panel}><span className={s.muted}>Programállapot</span><strong className={s.ok}>ACTIVE</strong></div>
          <div className={s.panel}><span className={s.muted}>Főorsó fordulatszám</span><strong>2 400 rpm</strong></div>
          <div className={s.miniChart}>Idősor grafikon · 5 perces trend</div>
        </div>
      </div>
    </VisualFrame>
  );
}

export function ExportGuideVisual() {
  const s = useStyles2(getStyles);
  return (
    <VisualFrame
      title="Adatexport — CSV-letöltés lépései"
      legend={[
        { n: 1, label: 'Gépek kiválasztása', text: 'Egy vagy több gép megjelölése név szerint keresve.' },
        { n: 2, label: 'Adatpontok kijelölése', text: 'A kiválasztott gépek mért jelei; az Összes adatpont kijelölése gombbal egy kattintással választhatók.' },
        { n: 3, label: 'Kezdőidő és Végidő', text: 'A böngésző helyi idejében megadható intervallum (a letöltött fájlban UTC-időbélyeg szerepel).' },
        { n: 4, label: 'Sorkorlát és Formátum', text: 'Legfeljebb 100 000 sor egy letöltésben; magyar Excelhez az „Excelhez formázott CSV (pontosvesszővel)” ajánlott.' },
        { n: 5, label: 'CSV letöltése', text: 'Elindítja a lekérdezést és letölti a fájlt a böngészőből.' },
      ]}
    >
      <div className={s.twoCol}>
        <div className={s.panel}>
          <div className={s.spot}>
            <div className={s.row}><strong>Gépek</strong><Pin n={1} /></div>
            <div className={s.fakeInput}>CNC-01, Eszterga-2</div>
          </div>
          <div className={s.spot}>
            <div className={s.row}><strong>Adatpontok</strong><Pin n={2} /></div>
            <div className={s.fakeInput}>Főorsó fordulatszám, X pozíció</div>
            <span className={s.fakeButtonSec}>Összes adatpont kijelölése</span>
          </div>
        </div>
        <div className={s.panel}>
          <div className={s.spot}>
            <div className={s.row}><strong>Időszak (helyi idő)</strong><Pin n={3} /></div>
            <div className={s.fakeInput}>Kezdőidő → Végidő</div>
          </div>
          <div className={s.spot}>
            <div className={s.row}><strong>Sorkorlát és Formátum</strong><Pin n={4} /></div>
            <div className={s.fakeInput}>10 000 sor · Excelhez formázott CSV (;)</div>
          </div>
          <div className={s.row} style={{ justifyContent: 'flex-end' }}>
            <span className={s.spotInline}><Pin n={5} /><span className={s.fakeButton}><Icon name="download-alt" /> CSV letöltése</span></span>
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

export function AgentsGuideVisual() {
  const s = useStyles2(getStyles);
  return (
    <VisualFrame
      title="Agentek és gépek — kapcsolatok felvétele és alkalmazása"
      legend={[
        { n: 1, label: 'Állapotsáv', text: 'Jelzi, hogy az adatgyűjtő fut-e, és hány agent, illetve gép van beállítva.' },
        { n: 2, label: 'Hálózati keresés', text: 'Automatikusan megkeresi a helyi hálózaton válaszoló gépeket (legfeljebb /24 tartományon).' },
        { n: 3, label: 'Agent hozzáadása', text: 'Kézi felvételhez, ha ismert a gép vagy adatgyűjtő webcíme (URL / IP és port).' },
        { n: 4, label: 'Agentkártya és gépek sémája', text: 'Itt látható az élő elérhetőség, a Szerkesztés gombnál pedig megadható a gép neve és a kötelező séma.' },
        { n: 5, label: 'Mentés és alkalmazás sáv', text: 'Módosítás után alul jelenik meg: jóváhagyáskor menti a listát és újraindítja az adatgyűjtőt.' },
      ]}
    >
      <div className={s.panel}>
        <div className={s.row}>
          <div className={s.spotInline}><Pin n={1} /><Badge color="green" text="Relay fut" /> <span>2 agent · 3 eszköznév</span></div>
          <div className={s.row}>
            <span className={s.spotInline}><Pin n={2} /><span className={s.fakeButtonSec}><Icon name="search" /> Hálózati keresés</span></span>
            <span className={s.spotInline}><Pin n={3} /><span className={s.fakeButton}><Icon name="plus" /> Agent hozzáadása</span></span>
          </div>
        </div>
      </div>
      <div className={s.spot}>
        <div className={s.row}>
          <div>
            <strong>Műhely-1</strong> <Badge color="blue" text="Engedélyezve" /> <Badge color="green" text="Elérhető" />
          </div>
          <div className={s.row}>
            <Pin n={4} />
            <span className={s.fakeButtonSec}><Icon name="pen" /> Szerkesztés</span>
          </div>
        </div>
        <div className={s.muted}>Gépek: CNC-01 (Séma: Marógép alap) · Eszterga-2 (Séma: Eszterga)</div>
      </div>
      <div className={s.spot}>
        <div className={s.row}>
          <span><strong>Nem mentett módosítások</strong> — 1 módosított agent</span>
          <div className={s.row}>
            <Pin n={5} />
            <span className={s.fakeButtonSec}>Elvetés</span>
            <span className={s.fakeButton}>Mentés és alkalmazás</span>
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

export function CatalogGuideVisual() {
  const s = useStyles2(getStyles);
  return (
    <VisualFrame
      title="Jelkatalógus — közös magyar jelnevek, sémák és egységek"
      legend={[
        { n: 1, label: 'Jelek és Adatpontok kereső', text: 'Külön szűrőmező a magyar jelnevekre és a gépben szereplő adatpont-útvonalakra.' },
        { n: 2, label: 'Új jel felvétele', text: 'Felvehető kézzel („Jel hozzáadása”) vagy egy beolvasott gép adatpontjaiból választva („Új jel gépadatpontból”).' },
        { n: 3, label: 'Jel ↔ Adatpont összekötés', text: 'A sémához tartozó gépen belüli útvonalak színjelöléssel (kék: tengelyek, lila: vezérlő stb.) és ceruza/kuka ikonnal.' },
        { n: 4, label: 'Sémák kezelése', text: 'Aktív séma kiválasztása, új séma létrehozása üresen vagy meglévő séma másolásával, átnevezés és törlés.' },
        { n: 5, label: 'Megjelenítési mértékegységek', text: 'A gép nyers egységkódjaihoz (pl. REVOLUTION/MINUTE) itt adható rövid, olvasható felirat (pl. rpm).' },
      ]}
    >
      <div className={s.twoCol}>
        <div className={s.panel}>
          <div className={s.spot}>
            <div className={s.row}><strong>Jelek | Adatpontok</strong><Pin n={1} /></div>
            <div className={s.twoCol}>
              <div className={s.fakeInput}>Jel keresése…</div>
              <div className={s.fakeInput}>Adatpont keresése…</div>
            </div>
          </div>
          <div className={s.spotInline}>
            <Pin n={2} />
            <span className={s.fakeButtonSec}>+ Jel hozzáadása</span>
            <span className={s.fakeButtonSec}>+ Új jel gépadatpontból</span>
          </div>
          <div className={s.spot}>
            <div className={s.row}><span className={s.muted}>Összekapcsolt sorok</span><Pin n={3} /></div>
            <div className={s.axisBar}>
              <span className={s.branchAxis}>X tengely pozíció</span>
              <Icon name="arrow-right" />
              <span className={s.branchAxis}>/Axes/Linear[X]/Position</span>
            </div>
            <div className={s.axisBar}>
              <span className={s.branchCtrl}>Programállapot</span>
              <Icon name="arrow-right" />
              <span className={s.branchCtrl}>/Controller/Path/Execution</span>
            </div>
          </div>
        </div>
        <div className={s.panel}>
          <div className={s.spot}>
            <div className={s.row}><strong>Sémák</strong><Pin n={4} /></div>
            <div className={s.fakeInput}>Aktív séma: Megmunkáló központ</div>
            <div className={s.row}>
              <span className={s.fakeButton}>+ Új séma</span>
              <span className={s.fakeButtonSec}>Átnevezés</span>
            </div>
          </div>
          <div className={s.spotInline}>
            <Pin n={5} />
            <span className={s.fakeButtonSec}><Icon name="calculator-alt" /> Megjelenítési mértékegységek</span>
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

export function EditorGuideVisual() {
  const s = useStyles2(getStyles);
  return (
    <VisualFrame
      title="Dashboard szerkesztő — panelek összeállítása gépenként"
      legend={[
        { n: 1, label: 'Dashboard címe és átnevezése', text: 'Egy géphez több dashboard is tartozhat; a ceruza ikonnal átnevezhető.' },
        { n: 2, label: 'Négy nézetcsoport', text: 'Lenyitható csoportok: Állapot (opcionális Állapotidősorral), Aktuális érték, Műszer és Grafikon.' },
        { n: 3, label: 'Panelkártya műveletek', text: 'Minden panelnél elérhető a szerkesztés, a sorrendet állító bal/jobb nyilak és az eltávolítás.' },
        { n: 4, label: 'Monitoring megnyitása és Mentés', text: 'A Dashboard mentése azonnal érvényesül, és nem állítja le az adatgyűjtést.' },
      ]}
    >
      <div className={s.panel}>
        <div className={s.row}>
          <div className={s.spotInline}><Pin n={1} /><strong>Áttekintés</strong> <Icon name="pen" /> <Badge color="blue" text="CNC-01" /></div>
          <span className={s.fakeButtonSec}>Vissza a dashboardokhoz</span>
        </div>
      </div>
      <div className={s.spot}>
        <div className={s.row}><strong>Panelszerkesztő (4 kategória)</strong><Pin n={2} /></div>
        <div className={s.twoCol}>
          <div className={s.panel}>
            <div className={s.row}><strong><Icon name="toggle-on" /> Állapot</strong><Icon name="angle-down" /></div>
            <div className={s.spot}>
              <div className={s.row}><span>Programállapot</span><Pin n={3} /></div>
              <div className={s.row}>
                <span className={s.muted}>← → sorrend</span>
                <span className={s.muted}><Icon name="pen" /> <Icon name="trash-alt" /></span>
              </div>
            </div>
          </div>
          <div className={s.panel}>
            <div className={s.row}><strong><Icon name="chart-line" /> Grafikon</strong><Icon name="angle-right" /></div>
            <div className={s.muted}>+ Panel hozzáadása (választható színnel)</div>
          </div>
        </div>
      </div>
      <div className={s.spot}>
        <div className={s.row}>
          <span className={s.fakeButtonSec}><Icon name="chart-line" /> Monitoring megnyitása</span>
          <div className={s.row}>
            <Pin n={4} />
            <span className={s.fakeButton}><Icon name="save" /> Dashboard mentése</span>
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

export function AccessGuideVisual() {
  const s = useStyles2(getStyles);
  return (
    <VisualFrame
      title="Jogosultságkezelés — kezelői csapat karbantartása"
      legend={[
        { n: 1, label: 'Viewer fiók kiválasztása és Hozzáadás', text: 'A legördülő listában csak az aktív, Megtekintő (Viewer) szerepű fiókok jelennek meg.' },
        { n: 2, label: 'Aktív kezelők listája', text: 'A felvett munkatársak kezelhetik a gépeket és dashboardokat, de az Eltávolítás gombbal bármikor visszavonható a joguk.' },
      ]}
    >
      <div className={s.panel}>
        <div className={s.spot}>
          <div className={s.row}><strong>KFGyR kezelők — Felhasználó hozzáadása</strong><Pin n={1} /></div>
          <div className={s.row}>
            <div className={s.fakeInput} style={{ flex: 1 }}>Kovács Anna (kovacs.anna)</div>
            <span className={s.fakeButton}><Icon name="plus" /> Hozzáadás</span>
          </div>
        </div>
        <div className={s.spot}>
          <div className={s.row}>
            <span>Kovács Anna (kovacs.anna) <Badge color="blue" text="KFGyR kezelő" /></span>
            <div className={s.row}>
              <Pin n={2} />
              <span className={s.fakeButtonSec}><Icon name="trash-alt" /> Eltávolítás</span>
            </div>
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}
