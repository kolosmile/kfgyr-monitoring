package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
)

const maxBody = 1024 * 1024

var jobPath = regexp.MustCompile(`^discovery/[a-f0-9]{24}$`)

type Settings struct {
	RunnerURL  string `json:"runnerUrl"`
	AdminOrgID int64  `json:"adminOrgId"`
}
type App struct {
	orgID       int64
	runnerURL   string
	token       string
	client      *http.Client
	configError string
}

func New(_ context.Context, settings backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	config := Settings{AdminOrgID: 1}
	a := &App{orgID: 1, client: &http.Client{Timeout: 20 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return errors.New("runner redirects are not allowed") }}}
	if len(settings.JSONData) > 0 && json.Unmarshal(settings.JSONData, &config) != nil {
		a.configError = "A relay kapcsolat beállítása hibás."
	}
	if value := os.Getenv("KFGYR_ADMIN_ORG_ID"); value != "" {
		if id, err := strconv.ParseInt(value, 10, 64); err == nil {
			config.AdminOrgID = id
		}
	}
	if config.AdminOrgID < 1 {
		config.AdminOrgID = 1
	}
	a.orgID = config.AdminOrgID
	a.token = settings.DecryptedSecureJSONData["runnerToken"]
	u, err := url.Parse(config.RunnerURL)
	if err != nil || u.Hostname() == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" || len(a.token) < 32 {
		a.configError = "Állítsd be a runner API-címét és tokenjét a plugin Relay kapcsolat beállításainál."
	} else {
		a.runnerURL = strings.TrimRight(u.String(), "/")
	}
	return a, nil
}
func (a *App) Dispose() {
	if a.client != nil {
		a.client.CloseIdleConnections()
	}
}

func allowed(path, method string) bool {
	switch path {
	case "config":
		return method == "GET" || method == "PUT"
	case "status", "networks":
		return method == "GET"
	case "probe", "rollback":
		return method == "POST"
	case "discovery":
		return method == "POST" || method == "GET"
	}
	return jobPath.MatchString(path) && (method == "GET" || method == "DELETE")
}

func (a *App) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	user := req.PluginContext.User
	if user == nil || user.Role != "Admin" || req.PluginContext.OrgID != a.orgID {
		return message(sender, 403, "Ehhez a művelethez a monitoring szervezet Admin jogosultsága szükséges.")
	}
	if len(req.Body) > maxBody {
		return message(sender, 413, "Túl nagy kérés.")
	}
	path := strings.Trim(req.Path, "/")
	if !allowed(path, req.Method) {
		return message(sender, 404, "Ismeretlen végpont vagy nem támogatott művelet.")
	}
	if a.configError != "" {
		return message(sender, 503, a.configError)
	}
	upstream, err := http.NewRequestWithContext(ctx, req.Method, a.runnerURL+"/v1/"+path, bytes.NewReader(req.Body))
	if err != nil {
		return message(sender, 502, "A relay kapcsolat beállítása hibás.")
	}
	upstream.Header.Set("Authorization", "Bearer "+a.token)
	upstream.Header.Set("Content-Type", "application/json")
	upstream.Header.Set("X-KFGYR-Actor", user.Login)
	response, err := a.client.Do(upstream)
	if err != nil {
		return message(sender, 502, "A relay-runner nem érhető el. Ellenőrizd a Relay kapcsolat beállításait.")
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 4*maxBody+1))
	if err != nil || len(body) > 4*maxBody || !json.Valid(body) {
		return message(sender, 502, "A runner válasza nem olvasható vagy túl nagy.")
	}
	if response.StatusCode == 401 || response.StatusCode == 403 {
		return message(sender, 502, "A runner elutasította a hitelesítést. Ellenőrizd a runner API-tokenjét.")
	}
	return sender.Send(&backend.CallResourceResponse{Status: response.StatusCode, Body: body, Headers: map[string][]string{"Content-Type": {"application/json; charset=utf-8"}, "Cache-Control": {"no-store"}}})
}
func message(sender backend.CallResourceResponseSender, status int, text string) error {
	body, _ := json.Marshal(map[string]string{"message": text})
	return sender.Send(&backend.CallResourceResponse{Status: status, Body: body, Headers: map[string][]string{"Content-Type": {"application/json; charset=utf-8"}, "Cache-Control": {"no-store"}}})
}
