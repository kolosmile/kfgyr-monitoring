import React, { useEffect, useState } from 'react';
import { getBackendSrv, PluginPage } from '@grafana/runtime';
import { Alert, Badge, Button, Combobox, ConfirmModal, Field, Spinner, useStyles2 } from '@grafana/ui';
import { HomeLink } from '../components/HomeLink';
import { MenuPageTitle } from '../components/MenuPageTitle';
import { getStyles } from '../components/styles';
import { menu } from '../navigation/menu';
import { errorText } from '../types';

type OrgUser = { userId: number; login: string; name: string; role: string };
type Member = { userId: number; login: string; name?: string };

const userLabel = (user: Member) => user.name && user.name !== user.login
  ? `${user.name} (${user.login})` : user.login;

async function loadTeam(teamId: number) {
  const backend = getBackendSrv();
  const [members, users] = await Promise.all([
    backend.get<Member[]>(`/api/teams/${teamId}/members`),
    backend.get<OrgUser[]>('/api/org/users'),
  ]);
  return { members, users };
}

export function AccessPage({ teamId, teamName }: { teamId?: number; teamName: string }) {
  const styles = useStyles2(getStyles);
  const [team, setTeam] = useState<Awaited<ReturnType<typeof loadTeam>>>();
  const [candidate, setCandidate] = useState<number | null>(null);
  const [removeMember, setRemoveMember] = useState<Member>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!teamId) {
      return;
    }
    let active = true;
    setTeam(undefined);
    setError('');
    loadTeam(teamId).then((result) => {
      if (active) {
        setTeam(result);
      }
    }).catch((err) => {
      if (active) {
        setError(errorText(err));
      }
    });
    return () => { active = false; };
  }, [teamId]);

  const viewers = team?.users.filter((user) => user.role === 'Viewer') ?? [];
  const members = team?.members.filter((member) => viewers.some((user) => user.userId === member.userId)) ?? [];
  const available = viewers.filter((user) => !members.some((member) => member.userId === user.userId));

  async function changeMember(userId: number, remove: boolean) {
    if (!teamId || saving) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const backend = getBackendSrv();
      const path = `/api/teams/${teamId}/members`;
      if (remove) {
        await backend.delete(`${path}/${userId}`);
      } else {
        await backend.post(path, { userId });
      }
      setCandidate(null);
      setRemoveMember(undefined);
      setTeam(await loadTeam(teamId));
    } catch (err) {
      setRemoveMember(undefined);
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PluginPage pageNav={menu.access} renderTitle={() => null}>
      <div className={styles.page}>
        <MenuPageTitle item={menu.access} />
        <div className={styles.form}>
          <div><HomeLink /></div>
          {error && <Alert severity="error" title="A kezelői csapat nem frissíthető">{error}</Alert>}
          {!teamId && <Alert severity="warning" title="A kezelői csapat nem található">
            A management telepítő hozza létre a(z) {teamName} Grafana-csapatot.
          </Alert>}
          {teamId && !team && !error && <div role="status"><Spinner /> Csapattagok betöltése…</div>}
          {team && (
            <section className={styles.formCard} aria-labelledby="kfgyr-operator-team">
              <h3 id="kfgyr-operator-team">{teamName}</h3>
              <Field label="Felhasználó hozzáadása" htmlFor="kfgyr-operator-member">
                <Combobox id="kfgyr-operator-member" isClearable value={candidate} disabled={saving}
                  options={available.map((user) => ({ value: user.userId, label: userLabel(user) }))}
                  noOptionsMessage="Nincs hozzáadható Viewer fiók."
                  onChange={(option) => setCandidate(option?.value ?? null)} />
              </Field>
              <div className={styles.actions}>
                <Button type="button" icon="plus" disabled={candidate === null || saving}
                  onClick={() => candidate !== null && changeMember(candidate, false)}>Hozzáadás</Button>
              </div>
              {!members.length && <p className={styles.muted}>Még nincs kezelői csapattag.</p>}
              {members.map((member) => (
                <div key={member.userId} className={styles.formFooter}>
                  <span>{userLabel(member)}</span>
                  <div className={styles.actions}>
                    <Badge text="KFGyR kezelő" color="blue" />
                    <Button type="button" icon="trash-alt" fill="outline" variant="destructive" disabled={saving}
                      onClick={() => setRemoveMember(member)}>Eltávolítás</Button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
      {removeMember && <ConfirmModal isOpen title="Kezelő eltávolítása"
        body={`A(z) „${userLabel(removeMember)}” fiók elveszíti KFGyR kezelői hozzáférését.`}
        confirmText="Eltávolítás" dismissText="Mégse" confirmVariant="destructive" disabled={saving}
        onConfirm={() => changeMember(removeMember.userId, true)} onDismiss={() => setRemoveMember(undefined)} />}
    </PluginPage>
  );
}
