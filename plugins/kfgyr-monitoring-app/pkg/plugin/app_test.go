package plugin

import (
	"context"
	"encoding/json"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type capture struct{ response *backend.CallResourceResponse }

func (c *capture) Send(r *backend.CallResourceResponse) error { c.response = r; return nil }
func fixture(t *testing.T, handler http.HandlerFunc) *App {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	data, _ := json.Marshal(Settings{RunnerURL: server.URL, AdminOrgID: 1})
	instance, err := New(context.Background(), backend.AppInstanceSettings{JSONData: data, DecryptedSecureJSONData: map[string]string{"runnerToken": strings.Repeat("t", 48)}})
	if err != nil {
		t.Fatal(err)
	}
	return instance.(*App)
}
func admin() backend.PluginContext {
	return backend.PluginContext{OrgID: 1, User: &backend.User{Role: "Admin", Login: "monitoring-admin"}}
}
func TestEveryRouteEnforcesRoleAndOrganization(t *testing.T) {
	a := fixture(t, func(w http.ResponseWriter, r *http.Request) { t.Error("Unauthorized request reached runner") })
	for _, path := range []string{"config", "status", "probe", "rollback", "networks", "discovery", "discovery/" + strings.Repeat("a", 24)} {
		for _, pc := range []backend.PluginContext{{OrgID: 1}, {OrgID: 1, User: &backend.User{Role: "Viewer"}}, {OrgID: 2, User: &backend.User{Role: "Admin"}}} {
			sender := &capture{}
			err := a.CallResource(context.Background(), &backend.CallResourceRequest{Path: path, Method: "GET", PluginContext: pc}, sender)
			if err != nil || sender.response.Status != 403 {
				t.Fatalf("unauthorized %s request accepted", path)
			}
		}
	}
}
func TestProxyPreservesConflictAndKeepsTokenServerSide(t *testing.T) {
	a := fixture(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/config" || r.Header.Get("Authorization") != "Bearer "+strings.Repeat("t", 48) || r.Header.Get("X-KFGYR-Actor") != "monitoring-admin" {
			t.Error("proxy request incorrect")
		}
		w.WriteHeader(409)
		_, _ = w.Write([]byte(`{"message":"conflict"}`))
	})
	sender := &capture{}
	_ = a.CallResource(context.Background(), &backend.CallResourceRequest{Path: "config", Method: "PUT", Body: []byte(`{"config":{}}`), PluginContext: admin()}, sender)
	if sender.response.Status != 409 || strings.Contains(string(sender.response.Body), strings.Repeat("t", 48)) {
		t.Fatal("conflict or token isolation failed")
	}
}
func TestUnsafePathsAndLargeBodiesNeverReachRunner(t *testing.T) {
	a := fixture(t, func(w http.ResponseWriter, r *http.Request) { t.Error("unexpected upstream request") })
	for _, path := range []string{"../config", "discovery/../../config", "config?admin=true", "openapi.json"} {
		sender := &capture{}
		_ = a.CallResource(context.Background(), &backend.CallResourceRequest{Path: path, Method: "GET", PluginContext: admin()}, sender)
		if sender.response.Status != 404 {
			t.Fatal("unsafe path accepted")
		}
	}
	sender := &capture{}
	_ = a.CallResource(context.Background(), &backend.CallResourceRequest{Path: "config", Method: "PUT", Body: make([]byte, maxBody+1), PluginContext: admin()}, sender)
	if sender.response.Status != 413 {
		t.Fatal("oversized request accepted")
	}
}
func TestUpstreamAuthenticationFailureDoesNotLogOutGrafana(t *testing.T) {
	a := fixture(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_, _ = w.Write([]byte(`{"message":"Unauthorized"}`))
	})
	sender := &capture{}
	_ = a.CallResource(context.Background(), &backend.CallResourceRequest{Path: "status", Method: "GET", PluginContext: admin()}, sender)
	if sender.response.Status != 502 {
		t.Fatal("runner 401 was forwarded as a Grafana login failure")
	}
}
func TestUnconfiguredPluginStillLoads(t *testing.T) {
	instance, err := New(context.Background(), backend.AppInstanceSettings{})
	if err != nil {
		t.Fatal(err)
	}
	sender := &capture{}
	_ = instance.(*App).CallResource(context.Background(), &backend.CallResourceRequest{Path: "config", Method: "GET", PluginContext: admin()}, sender)
	if sender.response.Status != 503 {
		t.Fatal("missing settings not reported")
	}
}
