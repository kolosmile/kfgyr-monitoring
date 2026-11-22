package plugin

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	_ "modernc.org/sqlite"
)

const defaultOperatorTeam = "KFGyR kezelők"

type operatorAccess struct {
	teamName string
	db       *sql.DB
}

func newOperatorAccess() operatorAccess {
	teamName := strings.TrimSpace(os.Getenv("KFGYR_OPERATOR_TEAM_NAME"))
	if teamName == "" {
		teamName = defaultOperatorTeam
	}
	path := os.Getenv("KFGYR_GRAFANA_DB_PATH")
	if path == "" {
		dataDir := os.Getenv("GF_PATHS_DATA")
		if dataDir == "" {
			dataDir = "/var/lib/grafana"
		}
		path = filepath.Join(dataDir, "grafana.db")
	}

	// Grafana OSS stores teams and users in the same SQLite database. Read its
	// current memberships without persisting an organization admin credential.
	dsn := url.URL{Scheme: "file", Path: filepath.ToSlash(path), RawQuery: "mode=ro&_pragma=busy_timeout%281500%29"}
	db, err := sql.Open("sqlite", dsn.String())
	if err != nil {
		db = nil
	} else {
		db.SetMaxOpenConns(2)
	}
	return operatorAccess{teamName: teamName, db: db}
}

func (o operatorAccess) close() {
	if o.db != nil {
		_ = o.db.Close()
	}
}

func (o operatorAccess) isMember(ctx context.Context, orgID int64, user *backend.User) (bool, error) {
	if user.Role != "Viewer" || user.Login == "" || strings.EqualFold(user.Login, "anonymous") || o.teamName == "" {
		return false, nil
	}
	if o.db == nil {
		return false, errors.New("Grafana membership database unavailable")
	}
	var member bool
	err := o.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM team t
			JOIN team_member tm ON tm.team_id = t.id AND tm.org_id = t.org_id
			JOIN "user" u ON u.id = tm.user_id
			JOIN org_user ou ON ou.user_id = u.id AND ou.org_id = t.org_id
			WHERE t.org_id = ? AND t.name = ? AND u.login = ? AND ou.role = 'Viewer'
			  AND u.is_disabled = 0 AND u.is_service_account = 0
		)`, orgID, o.teamName, user.Login).Scan(&member)
	return member, err
}

type accessResponse struct {
	ManagePlugin bool   `json:"manage_plugin"`
	ManageAccess bool   `json:"manage_access"`
	TeamID       int64  `json:"team_id,omitempty"`
	TeamName     string `json:"team_name,omitempty"`
}

func (a *App) sendAccess(ctx context.Context, sender backend.CallResourceResponseSender, user *backend.User) error {
	isAdmin := user.Role == "Admin"
	result := accessResponse{ManagePlugin: isAdmin, ManageAccess: isAdmin}
	if isAdmin {
		result.TeamName = a.operators.teamName
		if a.operators.db != nil {
			// Admins keep access to their settings even before the team is provisioned.
			_ = a.operators.db.QueryRowContext(ctx, "SELECT id FROM team WHERE org_id = ? AND name = ?", a.orgID, result.TeamName).Scan(&result.TeamID)
		}
	} else {
		member, err := a.operators.isMember(ctx, a.orgID, user)
		if err != nil {
			return message(sender, 503, "A kezelői jogosultság nem ellenőrizhető.")
		}
		result.ManagePlugin = member
	}
	body, _ := json.Marshal(result)
	return sender.Send(&backend.CallResourceResponse{Status: 200, Body: body, Headers: map[string][]string{
		"Content-Type": {"application/json; charset=utf-8"}, "Cache-Control": {"no-store"},
	}})
}
