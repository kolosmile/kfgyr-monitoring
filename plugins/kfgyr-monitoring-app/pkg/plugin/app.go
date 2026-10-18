package plugin

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"gopkg.in/yaml.v3"
)

const maxBody = 1024 * 1024

var storeMu sync.Mutex
var revisionPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,80}$`)
var aliasPattern = regexp.MustCompile(`^[\pL\pN][\pL\pN_. -]{0,63}$`)
var idPattern = regexp.MustCompile(`^[a-zA-Z0-9_.:-]{1,128}$`)
var retentionPattern = regexp.MustCompile(`^[1-9][0-9]{0,3}\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?)$`)

type App struct {
	dir    string
	orgID  int64
	policy *Policy
}
type Manifest struct {
	Revision string `json:"revision"`
	SHA256   string `json:"sha256"`
}
type Snapshot struct {
	Revision string         `json:"revision"`
	Config   map[string]any `json:"config"`
	YAML     string         `json:"yaml"`
}
type requestError struct {
	status  int
	message string
}

func (e *requestError) Error() string { return e.message }
func invalid(message string) error    { return &requestError{400, message} }
func env(key, fallback string) string {
	if s := os.Getenv(key); s != "" {
		return s
	}
	return fallback
}

func New(_ context.Context, _ backend.AppInstanceSettings) (instancemgmt.Instance, error) {
	org, err := strconv.ParseInt(env("KFGYR_ADMIN_ORG_ID", "1"), 10, 64)
	if err != nil || org < 1 {
		return nil, errors.New("invalid KFGYR_ADMIN_ORG_ID")
	}
	policy, err := NewPolicy(env("KFGYR_AGENT_ALLOWED_HOSTS", "demo.mtconnect.org"), os.Getenv("KFGYR_AGENT_ALLOWED_NETWORKS"))
	if err != nil {
		return nil, err
	}
	return &App{dir: env("KFGYR_CONFIG_DIR", "/var/lib/kfgyr-monitoring"), orgID: org, policy: policy}, nil
}
func (a *App) Dispose() {}

func (a *App) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	user := req.PluginContext.User
	if user == nil || user.Role != "Admin" || req.PluginContext.OrgID != a.orgID {
		return respond(sender, 403, map[string]string{"message": "Ehhez a művelethez a monitoring szervezet Admin jogosultsága szükséges."})
	}
	if len(req.Body) > maxBody {
		return respond(sender, 413, map[string]string{"message": "Túl nagy kérés."})
	}
	var result any
	var err error
	switch strings.Trim(req.Path, "/") {
	case "config":
		if req.Method == "GET" {
			storeMu.Lock()
			result, err = a.load()
			storeMu.Unlock()
		} else if req.Method == "PUT" {
			var body struct {
				BaseRevision string         `json:"base_revision"`
				Config       map[string]any `json:"config"`
			}
			err = decode(req.Body, &body)
			if err == nil {
				result, err = a.save(body.BaseRevision, body.Config, user.Login)
			}
		} else {
			err = &requestError{405, "Nem támogatott metódus."}
		}
	case "status":
		if req.Method != "GET" {
			err = &requestError{405, "Nem támogatott metódus."}
			break
		}
		var content []byte
		content, err = os.ReadFile(filepath.Join(a.dir, "status.json"))
		if os.IsNotExist(err) {
			err = nil
			result = map[string]string{"state": "waiting", "message": "A runner még nem adott állapotjelzést."}
		} else if err == nil {
			var status map[string]any
			err = json.Unmarshal(content, &status)
			if stamp, ok := status["updated_unix"].(float64); ok && float64(time.Now().Unix())-stamp > 30 {
				status["state"] = "unavailable"
				status["message"] = "A runner állapotjelzése több mint 30 másodperce nem frissült."
			}
			result = status
		}
	case "probe":
		if req.Method != "POST" {
			err = &requestError{405, "Nem támogatott metódus."}
			break
		}
		var body struct {
			URL string `json:"url"`
		}
		err = decode(req.Body, &body)
		if err == nil {
			result, err = a.probe(ctx, body.URL)
		}
	case "rollback":
		if req.Method != "POST" {
			err = &requestError{405, "Nem támogatott metódus."}
			break
		}
		var body struct {
			BaseRevision string `json:"base_revision"`
			Revision     string `json:"revision"`
		}
		err = decode(req.Body, &body)
		if err == nil {
			var prior Snapshot
			storeMu.Lock()
			prior, err = a.loadRevision(body.Revision, "")
			storeMu.Unlock()
			if err == nil {
				result, err = a.save(body.BaseRevision, prior.Config, user.Login)
			}
		}
	default:
		err = &requestError{404, "Ismeretlen végpont."}
	}
	if err != nil {
		var re *requestError
		if errors.As(err, &re) {
			return respond(sender, re.status, map[string]string{"message": re.message})
		}
		backend.Logger.Error("monitoring operation failed", "path", req.Path, "error", err)
		return respond(sender, 500, map[string]string{"message": "A szerveroldali művelet sikertelen. Ellenőrizd a plugin naplóját."})
	}
	return respond(sender, 200, result)
}
func respond(sender backend.CallResourceResponseSender, status int, value any) error {
	body, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return sender.Send(&backend.CallResourceResponse{Status: status, Headers: map[string][]string{"Content-Type": {"application/json; charset=utf-8"}, "Cache-Control": {"no-store"}}, Body: body})
}
func decode(body []byte, value any) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		return invalid("Hibás JSON kérés.")
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return invalid("A kérés pontosan egy JSON dokumentum lehet.")
	}
	return nil
}

func (a *App) load() (Snapshot, error) {
	content, err := os.ReadFile(filepath.Join(a.dir, "desired.json"))
	if err != nil {
		return Snapshot{}, err
	}
	var m Manifest
	if err = json.Unmarshal(content, &m); err != nil {
		return Snapshot{}, err
	}
	return a.loadRevision(m.Revision, m.SHA256)
}
func (a *App) loadRevision(revision, checksum string) (Snapshot, error) {
	if !revisionPattern.MatchString(revision) {
		return Snapshot{}, invalid("Érvénytelen konfigurációverzió.")
	}
	content, err := os.ReadFile(filepath.Join(a.dir, "revisions", revision+".yaml"))
	if err != nil {
		return Snapshot{}, err
	}
	hash := sha256.Sum256(content)
	if checksum != "" && hex.EncodeToString(hash[:]) != checksum {
		return Snapshot{}, errors.New("configuration checksum mismatch")
	}
	var setup map[string]any
	if err = yaml.Unmarshal(content, &setup); err != nil {
		return Snapshot{}, err
	}
	return Snapshot{Revision: revision, Config: setup, YAML: string(content)}, nil
}
func (a *App) save(base string, setup map[string]any, actor string) (Snapshot, error) {
	storeMu.Lock()
	defer storeMu.Unlock()
	previous, err := a.load()
	if err != nil {
		return Snapshot{}, err
	}
	if previous.Revision != base {
		return Snapshot{}, &requestError{409, "A konfiguráció közben megváltozott. Töltsd újra az oldalt."}
	}
	if err = a.validate(setup, previous.Config); err != nil {
		return Snapshot{}, err
	}
	content, err := yaml.Marshal(setup)
	if err != nil {
		return Snapshot{}, err
	}
	oldContent, _ := yaml.Marshal(previous.Config)
	var runnerStatus map[string]any
	if state, readErr := os.ReadFile(filepath.Join(a.dir, "status.json")); readErr == nil {
		_ = json.Unmarshal(state, &runnerStatus)
	}
	if bytes.Equal(content, oldContent) && runnerStatus["failed_revision"] != previous.Revision {
		return previous, nil
	}
	var nonce [6]byte
	if _, err = rand.Read(nonce[:]); err != nil {
		return Snapshot{}, err
	}
	revision := time.Now().UTC().Format("20060102T150405") + "_" + hex.EncodeToString(nonce[:])
	if err = os.MkdirAll(filepath.Join(a.dir, "revisions"), 0770); err != nil {
		return Snapshot{}, err
	}
	if err = atomicWrite(filepath.Join(a.dir, "revisions", revision+".yaml"), content); err != nil {
		return Snapshot{}, err
	}
	audit, _ := json.Marshal(map[string]string{"revision": revision, "previous_revision": previous.Revision, "actor": actor, "created_at": time.Now().UTC().Format(time.RFC3339)})
	if err = atomicWrite(filepath.Join(a.dir, "revisions", revision+".json"), audit); err != nil {
		return Snapshot{}, err
	}
	hash := sha256.Sum256(content)
	manifest, _ := json.Marshal(Manifest{Revision: revision, SHA256: hex.EncodeToString(hash[:])})
	if err = atomicWrite(filepath.Join(a.dir, "desired.json"), manifest); err != nil {
		return Snapshot{}, err
	}
	backend.Logger.Info("monitoring configuration saved", "revision", revision, "actor", actor)
	return Snapshot{Revision: revision, Config: setup, YAML: string(content)}, nil
}
func atomicWrite(path string, content []byte) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".pending-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if err = f.Chmod(0660); err == nil {
		_, err = f.Write(content)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if err = os.Rename(name, path); err != nil {
		return err
	}
	if dir, e := os.Open(filepath.Dir(path)); e == nil {
		_ = dir.Sync()
		_ = dir.Close()
	}
	return nil
}
func object(value any) map[string]any    { result, _ := value.(map[string]any); return result }
func text(value any) string              { result, _ := value.(string); return result }
func list(value any) []any               { result, _ := value.([]any); return result }
func agents(config map[string]any) []any { return list(object(config["relay"])["agents"]) }
func validateRetention(value any) error {
	if value == nil || value == "" {
		return nil
	}
	if !retentionPattern.MatchString(text(value)) {
		return invalid("Érvénytelen megőrzési idő. Példa: 1week vagy 30days.")
	}
	return nil
}
func (a *App) validate(config, previous map[string]any) error {
	client := object(config["client"])
	relay := object(config["relay"])
	if client == nil || relay == nil || strings.TrimSpace(text(client["name"])) == "" {
		return invalid("A monitoring neve és a relay konfiguráció kötelező.")
	}
	if _, err := time.LoadLocation(text(client["timezone"])); err != nil {
		return invalid("Érvénytelen időzóna.")
	}
	if err := validateRetention(relay["retention"]); err != nil {
		return err
	}
	rawAgents, ok := relay["agents"].([]any)
	if !ok || len(rawAgents) > 100 {
		return invalid("Az agents mező legfeljebb 100 elemű lista lehet.")
	}
	old := map[string]map[string]any{}
	for _, value := range agents(previous) {
		p := object(value)
		old[text(p["alias"])] = p
	}
	seen := map[string]bool{}
	for _, value := range rawAgents {
		agent := object(value)
		alias := text(agent["alias"])
		if !aliasPattern.MatchString(alias) || seen[alias] {
			return invalid("Az agent alias legyen egyedi, 1–64 karakteres név, perjel és idézőjel nélkül.")
		}
		seen[alias] = true
		if _, err := a.policy.parse(text(agent["url"])); err != nil {
			return err
		}
		if ignore, exists := agent["ignore"]; exists {
			if _, ok := ignore.(bool); !ok {
				return invalid("Az ignore mező logikai érték lehet.")
			}
		}
		if err := validateRetention(agent["retention"]); err != nil {
			return err
		}
		var devices []any
		if val, exists := agent["devices"]; exists {
			var ok bool
			devices, ok = val.([]any)
			if !ok || len(devices) > 1000 {
				return invalid("A devices mező legfeljebb 1000 elemű lista lehet.")
			}
		}
		oldDevices := map[string]string{}
		for _, d := range list(old[alias]["devices"]) {
			dev := object(d)
			oldDevices[text(dev["id"])] = text(dev["alias"])
		}
		deviceIDs := map[string]bool{}
		deviceAliases := map[string]bool{}
		for _, d := range devices {
			dev := object(d)
			id := text(dev["id"])
			name := text(dev["alias"])
			if !idPattern.MatchString(id) || !aliasPattern.MatchString(name) || deviceIDs[id] || deviceAliases[name] {
				return invalid("Érvénytelen vagy ismétlődő eszközazonosító/alias.")
			}
			deviceIDs[id] = true
			deviceAliases[name] = true
			if before, exists := oldDevices[id]; exists && before != name {
				return invalid("Meglévő eszköz aliasa nem módosítható. Ez az adatbázisbeli elérési út része.")
			}
			if err := validateRetention(dev["retention"]); err != nil {
				return err
			}
			for _, item := range list(dev["dataitems"]) {
				if err := validateRetention(object(item)["retention"]); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

type Policy struct {
	hosts    map[string]bool
	networks []*net.IPNet
}

func NewPolicy(hosts, networks string) (*Policy, error) {
	p := &Policy{hosts: map[string]bool{}}
	for _, host := range strings.Split(hosts, ",") {
		if host = strings.TrimSpace(strings.ToLower(host)); host != "" {
			p.hosts[host] = true
		}
	}
	for _, subnet := range strings.Split(networks, ",") {
		if subnet = strings.TrimSpace(subnet); subnet != "" {
			_, network, err := net.ParseCIDR(subnet)
			if err != nil {
				return nil, fmt.Errorf("invalid agent CIDR: %w", err)
			}
			p.networks = append(p.networks, network)
		}
	}
	return p, nil
}
func (p *Policy) allowedIP(ip net.IP, namedHost bool) bool {
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() {
		return false
	}
	for _, network := range p.networks {
		if network.Contains(ip) {
			return true
		}
	}
	return namedHost && ip.IsGlobalUnicast() && !ip.IsPrivate()
}
func (p *Policy) parse(raw string) (*url.URL, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Hostname() == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return nil, invalid("HTTP(S) agent alap URL szükséges, jelszó, query és fragment nélkül.")
	}
	host := strings.ToLower(u.Hostname())
	if ip := net.ParseIP(host); ip != nil {
		if !p.allowedIP(ip, false) {
			return nil, invalid("Az agent IP-címe nincs az engedélyezett hálózatok között.")
		}
	} else if !p.hosts[host] {
		return nil, invalid("Az agent hostneve nincs a KFGYR_AGENT_ALLOWED_HOSTS engedélyezési listában. IP-cím is használható az engedélyezett hálózatokból.")
	}
	return u, nil
}
func (p *Policy) client() *http.Client {
	transport := &http.Transport{TLSHandshakeTimeout: 8 * time.Second, ResponseHeaderTimeout: 10 * time.Second, DisableKeepAlives: true}
	transport.DialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, err
		}
		for _, address := range ips {
			if p.allowedIP(address.IP, p.hosts[strings.ToLower(host)]) {
				conn, err := (&net.Dialer{Timeout: 7 * time.Second}).DialContext(ctx, network, net.JoinHostPort(address.IP.String(), port))
				if err == nil {
					return conn, nil
				}
			}
		}
		return nil, errors.New("no reachable address permitted by agent policy")
	}
	return &http.Client{Transport: transport, Timeout: 15 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return errors.New("redirects are not allowed") }}
}

type ProbeDevice struct {
	ID   string `xml:"id,attr" json:"id"`
	Name string `xml:"name,attr" json:"name"`
	UUID string `xml:"uuid,attr" json:"uuid"`
}

func (a *App) probe(ctx context.Context, raw string) (any, error) {
	u, err := a.policy.parse(raw)
	if err != nil {
		return nil, err
	}
	u.Path = strings.TrimRight(u.Path, "/") + "/probe"
	request, err := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if err != nil {
		return nil, err
	}
	response, err := a.policy.client().Do(request)
	if err != nil {
		return nil, &requestError{502, "Az agent nem érhető el, vagy a hálózati szabályok nem engedélyezik."}
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, &requestError{502, fmt.Sprintf("Az agent HTTP %d választ adott.", response.StatusCode)}
	}
	content, err := io.ReadAll(io.LimitReader(response.Body, 4*maxBody+1))
	if err != nil || len(content) > 4*maxBody {
		return nil, &requestError{502, "Az agent válasza túl nagy vagy nem olvasható."}
	}
	var document struct {
		XMLName xml.Name      `xml:"MTConnectDevices"`
		Devices []ProbeDevice `xml:"Devices>Device"`
	}
	if err := xml.Unmarshal(content, &document); err != nil || len(document.Devices) == 0 {
		return nil, &requestError{502, "A válasz nem érvényes MTConnect probe eszközlistával."}
	}
	return map[string]any{"devices": document.Devices}, nil
}
