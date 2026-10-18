package plugin

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"gopkg.in/yaml.v3"
)

func fixture(t *testing.T) *App {
	t.Helper()
	p, err := NewPolicy("demo.mtconnect.org", "192.168.88.0/24")
	if err != nil {
		t.Fatal(err)
	}
	a := &App{dir: t.TempDir(), orgID: 1, policy: p}
	if err := os.Mkdir(filepath.Join(a.dir, "revisions"), 0700); err != nil {
		t.Fatal(err)
	}
	content := []byte("client:\n  name: Demo\n  timezone: Europe/Budapest\nrelay:\n  agents:\n    - alias: PublicDemo\n      url: https://demo.mtconnect.org\n      retention: 1week\n      devices:\n        - id: d1\n          alias: Mazak\n")
	if err := os.WriteFile(filepath.Join(a.dir, "revisions", "initial.yaml"), content, 0600); err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256(content)
	body, _ := json.Marshal(Manifest{Revision: "initial", SHA256: hex.EncodeToString(hash[:])})
	if err := os.WriteFile(filepath.Join(a.dir, "desired.json"), body, 0600); err != nil {
		t.Fatal(err)
	}
	return a
}
func TestPolicyRejectsUnsafeEndpoints(t *testing.T) {
	p, _ := NewPolicy("demo.mtconnect.org", "192.168.88.0/24")
	for _, raw := range []string{"http://127.0.0.1", "http://169.254.169.254", "http://db:5432", "file:///etc/passwd", "https://user:password@demo.mtconnect.org", "https://demo.mtconnect.org?token=secret", "https://demo.mtconnect.org.attacker.example", "http://192.168.1.1"} {
		if _, err := p.parse(raw); err == nil {
			t.Errorf("accepted forbidden URL: %s", raw)
		}
	}
	for _, raw := range []string{"https://demo.mtconnect.org", "http://192.168.88.20:5000"} {
		if _, err := p.parse(raw); err != nil {
			t.Error(err)
		}
	}
}
func TestSaveAndOptimisticConcurrency(t *testing.T) {
	a := fixture(t)
	current, err := a.load()
	if err != nil {
		t.Fatal(err)
	}
	object(current.Config["client"])["name"] = "Changed"
	next, err := a.save(current.Revision, current.Config, "test-admin")
	if err != nil {
		t.Fatal(err)
	}
	if next.Revision == current.Revision {
		t.Fatal("revision did not change")
	}
	loaded, err := a.load()
	if err != nil || loaded.Revision != next.Revision {
		t.Fatalf("manifest not committed: %v", err)
	}
	if _, err := a.save(current.Revision, current.Config, "stale-admin"); err == nil {
		t.Fatal("stale writer was accepted")
	}
	data, _ := os.ReadFile(filepath.Join(a.dir, "revisions", next.Revision+".json"))
	var audit map[string]string
	_ = json.Unmarshal(data, &audit)
	if audit["actor"] != "test-admin" || audit["previous_revision"] != "initial" {
		t.Fatal("audit metadata missing")
	}
	if _, err := a.loadRevision("../desired", ""); err == nil {
		t.Fatal("path traversal accepted")
	}
	if err := os.WriteFile(filepath.Join(a.dir, "revisions", next.Revision+".yaml"), []byte("modified"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := a.load(); err == nil {
		t.Fatal("checksum mismatch ignored")
	}
}
func TestInvalidConfigurationDoesNotCommit(t *testing.T) {
	a := fixture(t)
	before, _ := a.load()
	for _, bad := range []string{"0days", "1week'; DELETE FROM raw.history; --"} {
		var config map[string]any
		_ = yaml.Unmarshal([]byte(before.YAML), &config)
		object(agents(config)[0])["retention"] = bad
		if _, err := a.save(before.Revision, config, "admin"); err == nil {
			t.Fatal("unsafe retention accepted")
		}
	}
	after, _ := a.load()
	if after.Revision != before.Revision {
		t.Fatal("invalid config changed desired revision")
	}
	object(list(object(agents(before.Config)[0])["devices"])[0])["alias"] = "Renamed"
	if _, err := a.save(before.Revision, before.Config, "admin"); err == nil {
		t.Fatal("existing device alias changed")
	}
}

type capture struct{ response *backend.CallResourceResponse }

func (c *capture) Send(r *backend.CallResourceResponse) error { c.response = r; return nil }
func TestEveryRouteEnforcesRoleAndOrganization(t *testing.T) {
	a := fixture(t)
	for _, path := range []string{"config", "status", "probe", "rollback"} {
		for _, pc := range []backend.PluginContext{{OrgID: 1}, {OrgID: 1, User: &backend.User{Role: "Viewer"}}, {OrgID: 2, User: &backend.User{Role: "Admin"}}} {
			sender := &capture{}
			err := a.CallResource(context.Background(), &backend.CallResourceRequest{Path: path, Method: "GET", PluginContext: pc}, sender)
			if err != nil || sender.response.Status != 403 {
				t.Fatalf("unauthorized %s request was not rejected", path)
			}
		}
	}
}
